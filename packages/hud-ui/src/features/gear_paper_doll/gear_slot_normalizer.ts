import type {
  BenchCraftSuggestion,
  GearHygieneIssue,
  Poe2RuneHintItem,
  SupportedGameId,
  TargetItemSetSummary,
  TargetItemSlotSummary,
} from "@exile-hud/core";

export type CoreGearSlotKey =
  | "weapon1"
  | "weapon2"
  | "helmet"
  | "body"
  | "amulet"
  | "ring1"
  | "ring2"
  | "gloves"
  | "belt"
  | "boots";

export type ConsumableSlotKey =
  | "flask1"
  | "flask2"
  | "flask3"
  | "flask4"
  | "flask5"
  | "charm1"
  | "charm2"
  | "charm3";

export type PaperDollSlotKey = CoreGearSlotKey | ConsumableSlotKey;

export type FlaskVisualKind =
  | "life"
  | "mana"
  | "hybrid"
  | "quicksilver"
  | "granite"
  | "jade"
  | "silver"
  | "utility";

export type CharmVisualKind = "cold" | "fire" | "lightning" | "bleed" | "chaos" | "gold" | "utility";

export interface SlotAnchoredAlerts {
  hygiene: GearHygieneIssue[];
  crafts: BenchCraftSuggestion[];
  runes: Poe2RuneHintItem[];
  totalCount: number;
}

export interface NormalizedPaperDollModel {
  primarySlots: Partial<Record<PaperDollSlotKey, TargetItemSlotSummary>>;
  weaponSwapSlots: { weapon1?: TargetItemSlotSummary; weapon2?: TargetItemSlotSummary };
  hasWeaponSet2: boolean;
  extras: Array<{ key: string; slot: TargetItemSlotSummary }>;
  alertsBySlot: Partial<Record<PaperDollSlotKey, SlotAnchoredAlerts>>;
  unanchoredAlerts: SlotAnchoredAlerts;
  populatedCount: number;
}

const CORE_SLOT_PATTERNS: ReadonlyArray<[RegExp, CoreGearSlotKey]> = [
  [/^(?:weapon\s*1|main\s*hand|weapon)$/i, "weapon1"],
  [/^(?:off\s*hand\s*1?|offhand\s*1?|weapon\s*2|shield)$/i, "weapon2"],
  [/^(?:helmet|helm)\s*1?$/i, "helmet"],
  [/^(?:body\s*armour|bodyarmour|body)\s*1?$/i, "body"],
  [/^amulet\s*1?$/i, "amulet"],
  [/^(?:ring\s*1|ring|left\s*ring)$/i, "ring1"],
  [/^(?:ring\s*2|right\s*ring)$/i, "ring2"],
  [/^gloves\s*1?$/i, "gloves"],
  [/^belt\s*1?$/i, "belt"],
  [/^boots\s*1?$/i, "boots"],
];

const INDEXED_OFFICIAL_SLOT_REGEX =
  /^(?:helm1|bodyarmour1|gloves1|boots1|belt1|amulet1|offhand[12]|lifeflask1|manaflask1|beltcharm[1-3])$/i;

function resolveNamedSlot(
  rawSlotName: string,
  gameId: SupportedGameId,
  primarySlots: Partial<Record<PaperDollSlotKey, TargetItemSlotSummary>>,
  hasOfficialIndexedIds: boolean,
): { kind: "primary"; key: PaperDollSlotKey } | { kind: "swap"; key: "weapon1" | "weapon2" } | { kind: "extra" } {
  const name = rawSlotName.trim();
  if (!name || /abyssal|jewel|ring\s*3/i.test(name)) return { kind: "extra" };
  if (/^weapon\s*1\s*swap$/i.test(name)) return { kind: "swap", key: "weapon1" };
  if (/^(?:weapon\s*2\s*swap|off\s*hand\s*2|offhand\s*2)$/i.test(name)) return { kind: "swap", key: "weapon2" };
  if (hasOfficialIndexedIds && /^weapon2$/i.test(name)) return { kind: "swap", key: "weapon1" };

  for (const [pattern, key] of CORE_SLOT_PATTERNS) {
    if (pattern.test(name)) return { kind: "primary", key };
  }

  const flaskMatch = /^flask\s*([1-5])$/i.exec(name);
  if (flaskMatch?.[1]) {
    return { kind: "primary", key: `flask${flaskMatch[1]}` as ConsumableSlotKey };
  }
  if (/^life\s*flask\s*1?$/i.test(name)) return { kind: "primary", key: "flask1" };
  if (/^mana\s*flask\s*1?$/i.test(name)) {
    if (gameId === "poe2") return { kind: "primary", key: "flask2" };
    const open = (["flask5", "flask4", "flask3", "flask2", "flask1"] as const).find((k) => !primarySlots[k]);
    return { kind: "primary", key: open ?? "flask5" };
  }

  const charmMatch = /^(?:belt\s*)?charm\s*([1-3])$/i.exec(name);
  if (charmMatch?.[1]) {
    return { kind: "primary", key: `charm${charmMatch[1]}` as ConsumableSlotKey };
  }

  return { kind: "extra" };
}

function emptyAlerts(): SlotAnchoredAlerts {
  return { hygiene: [], crafts: [], runes: [], totalCount: 0 };
}

function pushAlert<K extends "hygiene" | "crafts" | "runes">(
  alertsBySlot: Partial<Record<PaperDollSlotKey, SlotAnchoredAlerts>>,
  unanchored: SlotAnchoredAlerts,
  targetKey: PaperDollSlotKey | null,
  bucket: K,
  value: SlotAnchoredAlerts[K][number],
): void {
  const dest = targetKey ? (alertsBySlot[targetKey] ??= emptyAlerts()) : unanchored;
  (dest[bucket] as Array<SlotAnchoredAlerts[K][number]>).push(value);
  dest.totalCount += 1;
}

function resolveHygieneSlotKey(
  issue: GearHygieneIssue,
  primarySlots: Partial<Record<PaperDollSlotKey, TargetItemSlotSummary>>,
  gameId: SupportedGameId,
): PaperDollSlotKey | null {
  if (issue.slot === "boots") return "boots";
  if (issue.slot === "weapon") return "weapon1";
  if (issue.slot === "links") return "body";
  if (issue.slot === "flask") {
    const flaskKeys: ConsumableSlotKey[] =
      gameId === "poe2" ? ["flask1", "flask2"] : ["flask1", "flask2", "flask3", "flask4", "flask5"];
    const lowerMsg = `${issue.id} ${issue.message}`.toLowerCase();
    for (const fk of flaskKeys) {
      const slot = primarySlots[fk];
      if (!slot) continue;
      if (lowerMsg.includes(slot.baseType.toLowerCase()) || lowerMsg.includes(slot.itemName.toLowerCase())) {
        return fk;
      }
    }
    return "flask1";
  }
  return null;
}

function resolveBenchSlotKey(rawSlot: string): PaperDollSlotKey | null {
  const trimmed = rawSlot.trim();
  for (const [pattern, key] of CORE_SLOT_PATTERNS) {
    if (pattern.test(trimmed)) return key;
  }
  return null;
}

function resolveRuneHintSlotKey(
  slotHint: string,
  primarySlots: Partial<Record<PaperDollSlotKey, TargetItemSlotSummary>>,
): PaperDollSlotKey | null {
  const candidates: CoreGearSlotKey[] = [];
  if (/helm/i.test(slotHint)) candidates.push("helmet");
  if (/body|armour|chest/i.test(slotHint)) candidates.push("body");
  if (/weapon|staff|bow|wand|sceptre/i.test(slotHint)) candidates.push("weapon1");
  if (/offhand|shield|focus/i.test(slotHint)) candidates.push("weapon2");
  if (/glove/i.test(slotHint)) candidates.push("gloves");
  if (/boot/i.test(slotHint)) candidates.push("boots");
  if (candidates.length === 0) return null;
  return candidates.find((k) => Boolean(primarySlots[k])) ?? candidates[0]!;
}

/** Normalizes a PoB / .build ItemSet and its active alerts into a shared PoE 1 & PoE 2 paper-doll model. */
export function normalizeItemSetToPaperDoll(params: {
  itemSet: TargetItemSetSummary | null;
  gameId: SupportedGameId;
  hygiene: GearHygieneIssue[];
  crafts: BenchCraftSuggestion[];
  runes: Poe2RuneHintItem[];
}): NormalizedPaperDollModel {
  const primarySlots: Partial<Record<PaperDollSlotKey, TargetItemSlotSummary>> = {};
  const weaponSwapSlots: { weapon1?: TargetItemSlotSummary; weapon2?: TargetItemSlotSummary } = {};
  const extras: Array<{ key: string; slot: TargetItemSlotSummary }> = [];

  const itemSlots = params.itemSet?.slots ?? [];
  const hasOfficialIndexedIds = itemSlots.some((s) =>
    INDEXED_OFFICIAL_SLOT_REGEX.test(s.slotName.trim().toLowerCase().replace(/\s+/g, "")),
  );

  for (const slot of itemSlots) {
    const resolved = resolveNamedSlot(slot.slotName, params.gameId, primarySlots, hasOfficialIndexedIds);
    if (resolved.kind === "primary" && !primarySlots[resolved.key]) {
      primarySlots[resolved.key] = slot;
    } else if (resolved.kind === "swap" && !weaponSwapSlots[resolved.key]) {
      weaponSwapSlots[resolved.key] = slot;
    } else {
      extras.push({ key: `extra_${extras.length}_${slot.itemId}`, slot });
    }
  }

  const alertsBySlot: Partial<Record<PaperDollSlotKey, SlotAnchoredAlerts>> = {};
  const unanchoredAlerts = emptyAlerts();

  for (const issue of params.hygiene) {
    pushAlert(alertsBySlot, unanchoredAlerts, resolveHygieneSlotKey(issue, primarySlots, params.gameId), "hygiene", issue);
  }
  for (const craft of params.crafts) {
    pushAlert(alertsBySlot, unanchoredAlerts, resolveBenchSlotKey(craft.slot), "crafts", craft);
  }
  for (const rune of params.runes) {
    pushAlert(alertsBySlot, unanchoredAlerts, resolveRuneHintSlotKey(rune.slotHint, primarySlots), "runes", rune);
  }

  return {
    primarySlots,
    weaponSwapSlots,
    hasWeaponSet2: Boolean(weaponSwapSlots.weapon1 || weaponSwapSlots.weapon2),
    extras,
    alertsBySlot,
    unanchoredAlerts,
    populatedCount: params.itemSet?.slots.length ?? 0,
  };
}

/** Classifies a PoE 1/2 flask slot into a visual liquid color category. */
export function classifyFlaskVisualKind(slot: TargetItemSlotSummary | null | undefined): FlaskVisualKind {
  if (!slot) return "utility";
  const text = `${slot.slotName} ${slot.baseType} ${slot.itemName}`.toLowerCase();
  if (text.includes("hybrid")) return "hybrid";
  if (text.includes("life")) return "life";
  if (text.includes("mana")) return "mana";
  if (text.includes("quicksilver")) return "quicksilver";
  if (text.includes("granite")) return "granite";
  if (text.includes("jade")) return "jade";
  if (text.includes("silver")) return "silver";
  return "utility";
}

/** Classifies a PoE 2 charm slot into an elemental/ailment tint category. */
export function classifyCharmVisualKind(slot: TargetItemSlotSummary | null | undefined): CharmVisualKind {
  if (!slot) return "utility";
  const text = `${slot.baseType} ${slot.itemName} ${slot.mods.join(" ")}`.toLowerCase();
  if (/thawing|freeze|chill|sapphire/.test(text)) return "cold";
  if (/dousing|ignite|ruby/.test(text)) return "fire";
  if (/grounding|shock|topaz/.test(text)) return "lightning";
  if (/staunching|bleed|corrupted blood/.test(text)) return "bleed";
  if (/amethyst|antidote|poison|chaos/.test(text)) return "chaos";
  if (/golden|rarity/.test(text)) return "gold";
  return "utility";
}
