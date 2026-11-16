import type {
  GameAdapter,
  TwinkArchetypeId,
  TwinkCatalogItem,
  TwinkEquipCategory,
} from "@exile-hud/game-data";
import type { HudSessionSnapshot, TargetItemSlotSummary } from "../protocol/session_room_wire_protocol.js";
import { detectTwinkArchetype } from "./twink_archetype_detector.js";

export type TwinkBracketId = "lv_1" | "lv_4_9" | "lv_10_16" | "lv_18_24" | "lv_28_plus";

export interface RecommendedTwinkItem {
  id: string;
  itemName: string;
  baseType: string;
  slot: TwinkEquipCategory;
  levelReq: number;
  iconUrl: string | null;
  summaryEn: string;
  summaryPtBr: string;
  keyMods: string[];
  equipped: boolean;
  inPobPlan: boolean;
  classPreferred: boolean;
}

export interface TwinkLevelBracket {
  id: TwinkBracketId;
  label: string;
  minLevel: number;
  maxLevel: number;
  items: RecommendedTwinkItem[];
}

export interface TwinkGearTimeline {
  detectedArchetype: TwinkArchetypeId;
  effectiveArchetype: TwinkArchetypeId;
  activeBracketId: TwinkBracketId;
  brackets: TwinkLevelBracket[];
  totalRecommendedCount: number;
  equippedCount: number;
  stashRegex: string;
}

interface BracketSpec {
  id: TwinkBracketId;
  label: string;
  minLevel: number;
  maxLevel: number;
}

const BRACKET_SPECS: readonly BracketSpec[] = [
  { id: "lv_1", label: "Lv 1", minLevel: 1, maxLevel: 3 },
  { id: "lv_4_9", label: "Lv 4–9", minLevel: 4, maxLevel: 9 },
  { id: "lv_10_16", label: "Lv 10–16", minLevel: 10, maxLevel: 16 },
  { id: "lv_18_24", label: "Lv 18–25", minLevel: 17, maxLevel: 26 },
  { id: "lv_28_plus", label: "Lv 28+", minLevel: 27, maxLevel: 67 },
];

const HOLLOW_PALM_BLOCKED_SLOTS = new Set<TwinkEquipCategory>(["Weapon", "Offhand", "Gloves"]);

function resolveBracketId(levelReq: number): TwinkBracketId {
  const clamped = Math.max(1, levelReq);
  for (const spec of BRACKET_SPECS) {
    if (clamped >= spec.minLevel && clamped <= spec.maxLevel) return spec.id;
  }
  return "lv_28_plus";
}

function mapPobSlotToCategory(slotName: string, baseType: string): TwinkEquipCategory | null {
  const s = slotName.trim().toLowerCase();
  if (!s || s.includes("swap") || s.includes("flask")) return null;
  if (s.includes("helmet")) return "Helmet";
  if (s.includes("body")) return "Body Armour";
  if (s.includes("glove")) return "Gloves";
  if (s.includes("boot")) return "Boots";
  if (s.includes("belt")) return "Belt";
  if (s.includes("amulet")) return "Amulet";
  if (s.includes("ring")) return "Ring";
  if (s.includes("jewel")) return "Jewel";
  if (s === "weapon 1") return "Weapon";
  if (s === "weapon 2") {
    return /quiver|shield|buckler|spirit shield|tower shield|kite shield/i.test(baseType) ? "Offhand" : "Weapon";
  }
  return null;
}

function buildItemStashToken(itemName: string): string {
  const cleaned = itemName.toLowerCase().replace(/^the\s+/i, "").trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 6);
  const first = words[0]!;
  if (first.length >= 5 && !first.endsWith("'s") && first !== "replica") {
    return first.slice(0, 7);
  }
  const span = Math.min(cleaned.length, first.length + 2);
  const slice = cleaned.slice(0, span).trim();
  return slice.includes(" ") ? `"${slice}"` : slice;
}

/** Builds a compact PoE Stash search regex (<= maxLength chars) for unequipped twink items. */
export function buildTwinkStashRegex(items: readonly RecommendedTwinkItem[], maxLength = 240): string {
  const seen = new Set<string>();
  let result = "";
  for (const item of items) {
    if (item.equipped) continue;
    const token = buildItemStashToken(item.itemName);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const candidate = result ? `${result}|${token}` : token;
    if (candidate.length > maxLength) break;
    result = candidate;
  }
  return result;
}

function buildEquippedSet(snapshot: HudSessionSnapshot): Set<string> {
  const set = new Set<string>();
  for (const name of snapshot.equippedItemNames ?? []) {
    const norm = name.trim().toLowerCase();
    if (norm) set.add(norm);
  }
  for (const itemSet of snapshot.itemSets ?? []) {
    for (const slot of itemSet.slots) {
      if (slot.verifiedEquipped && slot.itemName.trim()) {
        set.add(slot.itemName.trim().toLowerCase());
      }
    }
  }
  return set;
}

function collectPobLevelingUniques(snapshot: HudSessionSnapshot): Map<string, TargetItemSlotSummary> {
  const map = new Map<string, TargetItemSlotSummary>();
  for (const itemSet of snapshot.itemSets ?? []) {
    for (const slot of itemSet.slots) {
      if (slot.rarity !== "unique" || slot.levelReq > 67) continue;
      if (!mapPobSlotToCategory(slot.slotName, slot.baseType)) continue;
      const key = slot.itemName.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, slot);
    }
  }
  return map;
}

function toRecommendedFromCatalog(
  item: TwinkCatalogItem,
  characterClass: string,
  equippedSet: Set<string>,
  pobMap: Map<string, TargetItemSlotSummary>,
): RecommendedTwinkItem {
  const key = item.itemName.trim().toLowerCase();
  const pobMatch = pobMap.get(key);
  const classPreferred = Boolean(item.preferredClasses?.includes(characterClass));
  return {
    id: item.id,
    itemName: item.itemName,
    baseType: item.baseType,
    slot: item.slot,
    levelReq: item.levelReq,
    iconUrl: item.iconPath,
    summaryEn: item.summaryEn,
    summaryPtBr: item.summaryPtBr,
    keyMods: item.keyMods,
    equipped: equippedSet.has(key) || Boolean(pobMatch?.verifiedEquipped),
    inPobPlan: Boolean(pobMatch),
    classPreferred,
  };
}

/** Builds a level-bracketed twink gear timeline tailored to class, level, archetype, and PoB uniques. */
export function buildTwinkGearTimeline(params: {
  snapshot: HudSessionSnapshot;
  adapter: GameAdapter;
  archetypeOverride?: TwinkArchetypeId | null;
}): TwinkGearTimeline {
  const { snapshot, adapter, archetypeOverride } = params;
  const detectedArchetype = detectTwinkArchetype({
    characterClass: snapshot.characterClass,
    ascendancyName: snapshot.ascendancyName,
    linkGroups: snapshot.linkGroups,
    itemSets: snapshot.itemSets,
    equippedItemNames: snapshot.equippedItemNames,
  });
  const effectiveArchetype = archetypeOverride ?? detectedArchetype;
  const equippedSet = buildEquippedSet(snapshot);
  const pobMap = collectPobLevelingUniques(snapshot);

  const items: RecommendedTwinkItem[] = [];
  const includedNames = new Set<string>();

  for (const cat of adapter.getTwinkGearCatalog()) {
    const matchesArchetype = cat.archetypes.includes("universal") || cat.archetypes.includes(effectiveArchetype);
    if (!matchesArchetype) continue;
    if (effectiveArchetype === "hollow_palm" && HOLLOW_PALM_BLOCKED_SLOTS.has(cat.slot)) continue;
    includedNames.add(cat.itemName.trim().toLowerCase());
    items.push(toRecommendedFromCatalog(cat, snapshot.characterClass, equippedSet, pobMap));
  }

  for (const [lowerName, slot] of pobMap.entries()) {
    if (includedNames.has(lowerName)) continue;
    const mappedSlot = mapPobSlotToCategory(slot.slotName, slot.baseType);
    if (!mappedSlot) continue;
    if (effectiveArchetype === "hollow_palm" && HOLLOW_PALM_BLOCKED_SLOTS.has(mappedSlot)) continue;
    includedNames.add(lowerName);
    const levelReq = Math.max(1, slot.levelReq);
    const summary = slot.mods[0] ?? slot.baseType;
    items.push({
      id: `pob-${lowerName.replace(/[^a-z0-9]+/g, "-")}`,
      itemName: slot.itemName,
      baseType: slot.baseType,
      slot: mappedSlot,
      levelReq,
      iconUrl: adapter.resolveOfficialUniqueIconUrl(slot.itemName),
      summaryEn: summary,
      summaryPtBr: summary,
      keyMods: slot.mods.length > 0 ? slot.mods : [slot.baseType],
      equipped: equippedSet.has(lowerName) || Boolean(slot.verifiedEquipped),
      inPobPlan: true,
      classPreferred: true,
    });
  }

  const buckets = new Map<TwinkBracketId, RecommendedTwinkItem[]>(BRACKET_SPECS.map((s) => [s.id, []]));
  for (const item of items) {
    buckets.get(resolveBracketId(item.levelReq))?.push(item);
  }

  const brackets: TwinkLevelBracket[] = BRACKET_SPECS.map((spec) => {
    const bucketItems = buckets.get(spec.id) ?? [];
    bucketItems.sort(
      (a, b) =>
        a.levelReq - b.levelReq ||
        Number(b.inPobPlan) - Number(a.inPobPlan) ||
        Number(b.classPreferred) - Number(a.classPreferred) ||
        a.itemName.localeCompare(b.itemName),
    );
    return { ...spec, items: bucketItems };
  }).filter((b) => b.items.length > 0);

  const level = Math.max(1, snapshot.characterLevel);
  let activeBracketId: TwinkBracketId = brackets[0]?.id ?? "lv_1";
  for (const b of brackets) {
    if (b.minLevel <= level) activeBracketId = b.id;
  }

  const orderedItems = brackets.flatMap((b) => b.items);
  return {
    detectedArchetype,
    effectiveArchetype,
    activeBracketId,
    brackets,
    totalRecommendedCount: orderedItems.length,
    equippedCount: orderedItems.filter((i) => i.equipped).length,
    stashRegex: buildTwinkStashRegex(orderedItems),
  };
}
