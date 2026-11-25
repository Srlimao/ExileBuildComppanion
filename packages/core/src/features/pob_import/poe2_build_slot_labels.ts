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
  charm: "Charm 1", charm1: "Charm 1", charm2: "Charm 2", charm3: "Charm 3",
  beltcharm1: "Charm 1", beltcharm2: "Charm 2", beltcharm3: "Charm 3",
  trinket: "Charm 1", trinket1: "Charm 1", trinket2: "Charm 2", trinket3: "Charm 3",
};

const OFFICIAL_INDEXED_SLOT_REGEX =
  /^(?:helm1|body_?armour_?1|gloves1|boots1|belt1|amulet1|offhand_?[12]|lifeflask1|manaflask1|beltcharm[1-3]|trinket[1-3]?)$/;

export interface Poe2SlotLabelContext {
  hasOfficialIndexedIds: boolean;
  minTrinketSlotX?: number;
}

/** Detects official GGG indexed inventory IDs and Trinket `slot_x` baseline across raw `.build` slots. */
export function detectPoe2SlotLabelContext(rawSlots: readonly unknown[]): Poe2SlotLabelContext {
  let hasOfficialIndexedIds = false;
  let minTrinketSlotX: number | undefined;
  for (const item of rawSlots) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawKey = String(obj.inventory_id ?? obj.slot ?? "").trim().toLowerCase().replace(/\s+/g, "");
    if (OFFICIAL_INDEXED_SLOT_REGEX.test(rawKey)) hasOfficialIndexedIds = true;
    const sx = typeof obj.slot_x === "number" && Number.isFinite(obj.slot_x) ? obj.slot_x : undefined;
    if (rawKey.startsWith("trinket") && sx !== undefined) {
      minTrinketSlotX = minTrinketSlotX === undefined ? sx : Math.min(minTrinketSlotX, sx);
    }
  }
  return { hasOfficialIndexedIds, minTrinketSlotX };
}

/** Maps raw GGG `inventory_id` / community `slot` keys (with optional `slot_x` offset) into display slot labels. */
export function normalizeSlotLabel(
  rawSlot: string,
  hasOfficialIndexedIds = false,
  slotX?: number,
  minTrinketSlotX?: number,
): string {
  const trimmed = rawSlot.trim();
  if (!trimmed) return "Gear Slot";
  const key = trimmed.toLowerCase().replace(/\s+/g, "");
  if (hasOfficialIndexedIds && /^weapon_?2$/.test(key)) return "Weapon 1 Swap";
  if ((key === "flask1" || key === "flask") && typeof slotX === "number" && slotX >= 0 && slotX <= 4) {
    return `Flask ${slotX + 1}`;
  }
  if (/^(?:beltcharm1?|charm1?|trinket1?)$/.test(key) && typeof slotX === "number") {
    if (key.startsWith("trinket") && typeof minTrinketSlotX === "number" && minTrinketSlotX >= 2 && slotX >= 2 && slotX <= 4) {
      return `Charm ${slotX - 1}`;
    }
    if (slotX >= 0 && slotX <= 2) {
      return `Charm ${slotX + 1}`;
    }
  }
  return SLOT_LABEL_MAP[key] ?? trimmed;
}
