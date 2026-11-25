export interface NormalizedBuildPassive {
  rawId: string;
  minLevel: number;
  maxLevel: number;
  hasExplicitInterval: boolean;
  weaponSet: 0 | 1 | 2;
  note?: string;
}

export interface NormalizedBuildSupport {
  rawId: string;
  minLevel: number;
  maxLevel: number;
  hasExplicitInterval: boolean;
  note?: string;
}

export interface NormalizedBuildSkill {
  rawId: string;
  minLevel: number;
  maxLevel: number;
  hasExplicitInterval: boolean;
  weaponSet: 0 | 1 | 2;
  note?: string;
  supports: NormalizedBuildSupport[];
}

export interface NormalizedBuildInventorySlot {
  slotKey: string;
  slotLabel: string;
  uniqueName?: string;
  baseType?: string;
  minLevel: number;
  maxLevel: number;
  hasExplicitInterval: boolean;
  note?: string;
}

export interface NormalizedPoe2BuildDocument {
  name: string;
  author?: string;
  link?: string;
  description?: string;
  ascendancy?: string;
  passives: NormalizedBuildPassive[];
  skills: NormalizedBuildSkill[];
  inventorySlots: NormalizedBuildInventorySlot[];
}

const SLOT_LABEL_MAP: Record<string, string> = {
  weapon: "Weapon 1", weapon1: "Weapon 1", weapon_1: "Weapon 1",
  offhand: "Weapon 2", offhand1: "Weapon 2", offhand_1: "Weapon 2",
  offhand2: "Weapon 2 Swap", offhand_2: "Weapon 2 Swap",
  weapon2: "Weapon 2", weapon_2: "Weapon 2",
  helm: "Helmet", helm1: "Helmet", helmet: "Helmet", helmet1: "Helmet",
  bodyarmour: "Body Armour", bodyarmour1: "Body Armour", body_armour: "Body Armour", body_armour_1: "Body Armour",
  gloves: "Gloves", gloves1: "Gloves",
  boots: "Boots", boots1: "Boots",
  amulet: "Amulet", amulet1: "Amulet",
  belt: "Belt", belt1: "Belt",
  ring: "Ring 1", ring1: "Ring 1", ring_1: "Ring 1",
  ring2: "Ring 2", ring_2: "Ring 2",
  ring3: "Ring 3", ring_3: "Ring 3",
  flask1: "Flask 1", lifeflask: "Life Flask", lifeflask1: "Life Flask",
  flask2: "Flask 2", manaflask: "Mana Flask", manaflask1: "Mana Flask",
  charm1: "Charm 1", charm2: "Charm 2", charm3: "Charm 3",
  beltcharm1: "Charm 1", beltcharm2: "Charm 2", beltcharm3: "Charm 3",
};

const OFFICIAL_INDEXED_SLOT_REGEX = /^(?:helm1|body_?armour_?1|gloves1|boots1|belt1|amulet1|offhand_?[12]|lifeflask1|manaflask1|beltcharm[1-3])$/;

function clampLevel(val: unknown, fallback: number): number {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(1, Math.round(num)));
}

function normalizeWeaponSet(raw: unknown): 0 | 1 | 2 {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (num === 1) return 1;
  if (num === 2) return 2;
  return 0;
}

/** Strips GGG in-game planner markup tags while preserving readable inner text and line breaks. */
export function stripPoeBuildMarkup(raw: string): string {
  let out = String(raw ?? "");
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/<[^>\r\n]+>\{([^{}]*)\}/g, "$1")
      .replace(/<\/?(?:bold|italic|red|blue|green|gold|yellow|white|grey|silver|bronze|unique|magic|rare|rgb\([^)]*\)|size:[^>]*)>/gi, "");
    if (next === out) break;
    out = next;
  }
  return out
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1] !== ""))
    .join("\n")
    .trim();
}

/** Parses `.build` `level_interval` values (`number`, `[min]`, `[min, max]`, or omitted). */
export function parseLevelInterval(raw: unknown): {
  minLevel: number;
  maxLevel: number;
  hasExplicitInterval: boolean;
} {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const minLevel = clampLevel(raw, 1);
    return { minLevel, maxLevel: 100, hasExplicitInterval: minLevel > 1 };
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const minLevel = clampLevel(raw[0], 1);
    const maxLevel = raw.length > 1 ? Math.max(minLevel, clampLevel(raw[1], 100)) : 100;
    return {
      minLevel,
      maxLevel,
      hasExplicitInterval: !(minLevel <= 1 && maxLevel >= 100),
    };
  }
  return { minLevel: 1, maxLevel: 100, hasExplicitInterval: false };
}

/** Maps raw GGG `inventory_id` / community `slot` keys into display slot labels. */
export function normalizeSlotLabel(rawSlot: string, hasOfficialIndexedIds = false): string {
  const trimmed = rawSlot.trim();
  if (!trimmed) return "Gear Slot";
  const key = trimmed.toLowerCase().replace(/\s+/g, "");
  if (hasOfficialIndexedIds && /^weapon_?2$/.test(key)) return "Weapon 1 Swap";
  return SLOT_LABEL_MAP[key] ?? trimmed;
}

/** Detects whether a raw text payload is an official/community PoE 2 `.build` JSON document. */
export function isPoe2BuildJsonString(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const obj = parsed as Record<string, unknown>;
    return (
      Array.isArray(obj.passives) ||
      Array.isArray(obj.skills) ||
      Array.isArray(obj.inventory_slots) ||
      (typeof obj.name === "string" && typeof obj.ascendancy === "string")
    );
  } catch {
    return false;
  }
}

/** Matches direct `http(s)://.../*.build` file URLs (ignoring query/fragment parameters). */
export function isDirectBuildFileUrl(raw: string): boolean {
  return /^https?:\/\/[^\s]+\.build(?:[?#][^\s]*)?$/i.test(raw.trim());
}

/** Formats author/link/description metadata into clean Build Notes text. */
export function formatPoe2BuildMetadataNotes(doc: NormalizedPoe2BuildDocument): string {
  const sections: string[] = [];
  if (doc.description) sections.push(doc.description);
  const metaLines: string[] = [];
  if (doc.author) metaLines.push(`Author: ${doc.author}`);
  if (doc.link) metaLines.push(`Link: ${doc.link}`);
  if (metaLines.length > 0) sections.push(metaLines.join("\n"));
  return sections.join("\n\n").trim();
}

/** Normalizes GGG `.build` JSON and common community aliases into a strict typed shape. */
export function normalizePoe2BuildDocument(rawJson: Record<string, any>): NormalizedPoe2BuildDocument {
  const rawPassives: unknown[] = Array.isArray(rawJson.passives) ? rawJson.passives : [];
  const passives: NormalizedBuildPassive[] = [];
  for (const item of rawPassives) {
    if (typeof item === "string" || typeof item === "number") {
      const rawId = String(item).trim();
      if (rawId) passives.push({ rawId, minLevel: 1, maxLevel: 100, hasExplicitInterval: false, weaponSet: 0 });
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const rawId = String(obj.id ?? obj.key ?? obj.node_id ?? "").trim();
      if (!rawId) continue;
      const interval = parseLevelInterval(obj.level_interval);
      const note = stripPoeBuildMarkup(String(obj.additional_text ?? obj.note ?? ""));
      passives.push({
        rawId,
        ...interval,
        weaponSet: normalizeWeaponSet(obj.weapon_set),
        ...(note ? { note } : {}),
      });
    }
  }

  const rawSkills: unknown[] = Array.isArray(rawJson.skills) ? rawJson.skills : [];
  const skills: NormalizedBuildSkill[] = [];
  for (const item of rawSkills) {
    if (typeof item === "string") {
      const rawId = item.trim();
      if (rawId) {
        skills.push({ rawId, minLevel: 1, maxLevel: 100, hasExplicitInterval: false, weaponSet: 0, supports: [] });
      }
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const rawId = String(obj.id ?? obj.key ?? obj.skill ?? "").trim();
      if (!rawId) continue;
      const interval = parseLevelInterval(obj.level_interval);
      const note = stripPoeBuildMarkup(String(obj.additional_text ?? obj.note ?? ""));
      const rawSupports = Array.isArray(obj.support_skills)
        ? obj.support_skills
        : Array.isArray(obj.supports)
          ? obj.supports
          : [];
      const supports: NormalizedBuildSupport[] = [];
      for (const sup of rawSupports) {
        if (typeof sup === "string") {
          const sId = sup.trim();
          if (sId) supports.push({ rawId: sId, minLevel: 1, maxLevel: 100, hasExplicitInterval: false });
        } else if (sup && typeof sup === "object") {
          const sObj = sup as Record<string, unknown>;
          const sId = String(sObj.id ?? sObj.key ?? sObj.skill ?? "").trim();
          if (!sId) continue;
          const sInterval = parseLevelInterval(sObj.level_interval);
          const sNote = stripPoeBuildMarkup(String(sObj.additional_text ?? sObj.note ?? ""));
          supports.push({ rawId: sId, ...sInterval, ...(sNote ? { note: sNote } : {}) });
        }
      }
      skills.push({
        rawId,
        ...interval,
        weaponSet: normalizeWeaponSet(obj.weapon_set),
        ...(note ? { note } : {}),
        supports,
      });
    }
  }

  const rawSlots: unknown[] = Array.isArray(rawJson.inventory_slots) ? rawJson.inventory_slots : [];
  const hasOfficialIndexedIds = rawSlots.some(
    (item) =>
      item &&
      typeof item === "object" &&
      OFFICIAL_INDEXED_SLOT_REGEX.test(
        String((item as Record<string, unknown>).inventory_id ?? (item as Record<string, unknown>).slot ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ""),
      ),
  );
  const inventorySlots: NormalizedBuildInventorySlot[] = [];
  for (const item of rawSlots) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const slotKey = String(obj.inventory_id ?? obj.slot ?? "").trim();
    const note = stripPoeBuildMarkup(String(obj.additional_text ?? obj.note ?? ""));
    const uniqueName = String(obj.unique_name ?? obj.item_name ?? "").trim();
    const baseType = String(obj.base_type ?? "").trim();
    if (!slotKey && !uniqueName && !note) continue;
    const interval = parseLevelInterval(obj.level_interval);
    inventorySlots.push({
      slotKey: slotKey || "Gear",
      slotLabel: normalizeSlotLabel(slotKey, hasOfficialIndexedIds),
      ...(uniqueName ? { uniqueName } : {}),
      ...(baseType ? { baseType } : {}),
      ...interval,
      ...(note ? { note } : {}),
    });
  }

  const name = stripPoeBuildMarkup(String(rawJson.name ?? "").trim()) || "Imported PoE 2 Build";
  const author = stripPoeBuildMarkup(String(rawJson.author ?? "")) || undefined;
  const link = typeof rawJson.link === "string" && rawJson.link.trim() ? rawJson.link.trim() : undefined;
  const description = stripPoeBuildMarkup(String(rawJson.description ?? "")) || undefined;
  const ascendancy = typeof rawJson.ascendancy === "string" ? rawJson.ascendancy.trim() : undefined;

  return { name, author, link, description, ascendancy, passives, skills, inventorySlots };
}
