import type { BenchCraftCategory, BenchEquipSlot } from "@exile-hud/game-data";
import type { GggItemModRecord, GggModEntry } from "./equipped_resistance_estimator.js";

export const SLOT_PREFERENCE_ORDER: readonly BenchEquipSlot[] = [
  "Gloves",
  "Boots",
  "Helm",
  "Belt",
  "BodyArmour",
  "Ring",
  "Ring2",
  "Amulet",
  "Offhand",
];

const CRAFTABLE_SLOT_SET = new Set<string>(SLOT_PREFERENCE_ORDER);

export const SLOT_DISPLAY_LABEL: Record<BenchEquipSlot, string> = {
  Helm: "Helm",
  BodyArmour: "Body Armour",
  Gloves: "Gloves",
  Boots: "Boots",
  Belt: "Belt",
  Amulet: "Amulet",
  Ring: "Left Ring",
  Ring2: "Right Ring",
  Offhand: "Shield",
};

const PREFIX_PATTERNS: readonly RegExp[] = [
  /to maximum (?:Life|Mana|Energy Shield)\b/i,
  /increased (?:Armour|Evasion|Energy Shield|Movement Speed|Physical Damage|Spell Damage|Fire Damage|Cold Damage|Lightning Damage|Chaos Damage|Elemental Damage|Minion Damage)/i,
  /Adds \d+ to \d+ .* Damage/i,
  /to Level of .* Skill Gems/i,
  /increased Rarity of Items found/i,
  /Reflects \d+ Physical Damage/i,
];

const SUFFIX_PATTERNS: readonly RegExp[] = [
  /to (?:Fire|Cold|Lightning|Chaos|all Elemental|Fire and Cold|Cold and Lightning|Fire and Lightning|Fire and Chaos|Cold and Chaos|Lightning and Chaos) Resistances?\b/i,
  /to (?:Strength|Dexterity|Intelligence|all Attributes|Strength and Dexterity|Strength and Intelligence|Dexterity and Intelligence)\b/i,
  /increased (?:Attack Speed|Cast Speed|Critical Strike|Global Critical Strike|Stun and Block Recovery|Flask|Life Regeneration|Mana Regeneration)/i,
  /Regenerate .* Life per second/i,
  /to Accuracy Rating/i,
  /Life gained on Kill|Mana gained on Kill/i,
  /Reduced Attribute Requirements/i,
];

const CATEGORY_DETECTORS: ReadonlyArray<[BenchCraftCategory, RegExp]> = [
  ["fire_res", /to Fire Resistance\b/i],
  ["cold_res", /to Cold Resistance\b/i],
  ["lightning_res", /to Lightning Resistance\b/i],
  ["chaos_res", /to Chaos Resistance\b|(?:Fire|Cold|Lightning) and Chaos Resistances\b/i],
  ["fire_cold_res", /to Fire and Cold Resistances\b/i],
  ["cold_lightning_res", /to Cold and Lightning Resistances\b/i],
  ["fire_lightning_res", /to Fire and Lightning Resistances\b/i],
  ["all_ele_res", /to all Elemental Resistances\b/i],
  ["movement_speed", /increased Movement Speed\b/i],
  ["life", /to maximum Life\b/i],
  ["strength", /to Strength\b/i],
  ["dexterity", /to Dexterity\b/i],
  ["intelligence", /to Intelligence\b/i],
  ["all_attributes", /to all Attributes\b/i],
];

export interface CraftableSlotInspection {
  slot: BenchEquipSlot;
  rarity: "magic" | "rare";
  effectiveIlvl: number;
  craftedModCount: number;
  openPrefix: boolean;
  openSuffix: boolean;
  existingCategories: Set<BenchCraftCategory>;
}

function cleanModEntryText(entry: GggModEntry): string {
  const raw = typeof entry === "string" ? entry : entry?.description ?? "";
  return raw.replace(/\[(?:[^\]|]+\|)?([^\]]+)\]/g, "$1").trim();
}

function isCraftedFlaggedEntry(entry: GggModEntry): boolean {
  return typeof entry === "object" && entry !== null && entry.flags?.crafted === true;
}

function getRequiredLevel(item: GggItemModRecord): number {
  const req = item.requirements?.find((r) => r.name === "Level");
  const raw = req?.values?.[0]?.[0];
  return raw ? Number.parseInt(raw, 10) || 1 : 1;
}

function toModArray(raw: GggModEntry[] | GggModEntry | undefined): GggModEntry[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function detectExistingCategories(lines: string[]): Set<BenchCraftCategory> {
  const found = new Set<BenchCraftCategory>();
  for (const text of lines) {
    for (const [category, pattern] of CATEGORY_DETECTORS) {
      if (pattern.test(text)) found.add(category);
    }
  }
  return found;
}

/** Inspects equipped armour/jewellery/shield slots for rarity, ilvl, existing crafts, and affix headroom. */
export function inspectCraftableGearSlots(
  items: GggItemModRecord[],
  characterLevel: number,
): CraftableSlotInspection[] {
  const results: CraftableSlotInspection[] = [];
  for (const item of items) {
    if (!CRAFTABLE_SLOT_SET.has(item.inventoryId)) continue;
    const slot = item.inventoryId as BenchEquipSlot;
    if (slot === "Offhand") {
      const isShield =
        item.properties?.some((p) => p.name === "Chance to Block") ||
        /shield|buckler/i.test(`${item.baseType ?? ""} ${item.typeLine}`);
      if (!isShield) continue;
    }
    if (item.frameType === 0 || (item.frameType !== undefined && item.frameType >= 3)) continue;

    const rarity: "magic" | "rare" = item.frameType === 1 ? "magic" : "rare";
    const explicitAll = toModArray(item.explicitMods);
    const craftedMods = toModArray(item.craftedMods);
    const craftedModCount = craftedMods.length + explicitAll.filter(isCraftedFlaggedEntry).length;

    const nonCraftedEntries = [
      ...explicitAll.filter((e) => !isCraftedFlaggedEntry(e)),
      ...toModArray(item.fracturedMods),
    ];
    const texts = nonCraftedEntries.map(cleanModEntryText).filter(Boolean);
    let prefixCount = 0;
    let suffixCount = 0;
    for (const text of texts) {
      if (PREFIX_PATTERNS.some((re) => re.test(text))) prefixCount += 1;
      else if (SUFFIX_PATTERNS.some((re) => re.test(text))) suffixCount += 1;
    }

    const maxTotal = rarity === "magic" ? 2 : 6;
    const maxPerSide = rarity === "magic" ? 1 : 3;
    const totalMods = nonCraftedEntries.length + craftedModCount;

    results.push({
      slot,
      rarity,
      effectiveIlvl: item.ilvl ?? Math.max(characterLevel, getRequiredLevel(item)),
      craftedModCount,
      openPrefix: totalMods < maxTotal && prefixCount < maxPerSide,
      openSuffix: totalMods < maxTotal && suffixCount < maxPerSide,
      existingCategories: detectExistingCategories(texts),
    });
  }

  return results.sort(
    (a, b) => SLOT_PREFERENCE_ORDER.indexOf(a.slot) - SLOT_PREFERENCE_ORDER.indexOf(b.slot),
  );
}
