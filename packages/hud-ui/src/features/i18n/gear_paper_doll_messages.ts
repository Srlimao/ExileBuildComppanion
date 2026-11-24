import type { PaperDollSlotKey } from "../gear_paper_doll/gear_slot_normalizer.js";

export interface GearPaperDollMessages {
  paperDollView: string;
  listView: string;
  targetBadge: string;
  emptySlot: string;
  noTargetItem: string;
  weaponSetAria: string;
  charmsLabel: string;
  jewelsLabel: string;
  lifeFlaskShort: string;
  manaFlaskShort: string;
  socketsLabel: string;
  runeSocketsLabel: string;
  closeTooltip: string;
  tapSlotHint: string;
  slotShortLabels: Record<PaperDollSlotKey, string>;
}

export const PT_BR_GEAR_PAPER_DOLL_MESSAGES: GearPaperDollMessages = {
  paperDollView: "Grade",
  listView: "Lista",
  targetBadge: "Alvo",
  emptySlot: "Vazio",
  noTargetItem: "Nenhum item alvo definido para este slot neste set.",
  weaponSetAria: "Alternar Conjunto de Armas I ou II",
  charmsLabel: "Talismãs",
  jewelsLabel: "Joias",
  lifeFlaskShort: "Vida",
  manaFlaskShort: "Mana",
  socketsLabel: "Sockets",
  runeSocketsLabel: "Runas",
  closeTooltip: "Fechar detalhes do item",
  tapSlotHint: "Toque ou passe o mouse para detalhes",
  slotShortLabels: {
    weapon1: "Arma 1",
    weapon2: "Arma 2",
    helmet: "Elmo",
    body: "Peitoral",
    amulet: "Amuleto",
    ring1: "Anel 1",
    ring2: "Anel 2",
    gloves: "Luvas",
    belt: "Cinto",
    boots: "Botas",
    flask1: "Flask 1",
    flask2: "Flask 2",
    flask3: "Flask 3",
    flask4: "Flask 4",
    flask5: "Flask 5",
    charm1: "Talismã 1",
    charm2: "Talismã 2",
    charm3: "Talismã 3",
  },
};

export const EN_GEAR_PAPER_DOLL_MESSAGES: GearPaperDollMessages = {
  paperDollView: "Paper-Doll",
  listView: "List",
  targetBadge: "Target",
  emptySlot: "Empty",
  noTargetItem: "No target item set for this slot in the active set.",
  weaponSetAria: "Switch Weapon Set I or II",
  charmsLabel: "Charms",
  jewelsLabel: "Jewels",
  lifeFlaskShort: "Life",
  manaFlaskShort: "Mana",
  socketsLabel: "Links",
  runeSocketsLabel: "Runes",
  closeTooltip: "Close item details",
  tapSlotHint: "Hover or tap slot for details",
  slotShortLabels: {
    weapon1: "Wpn 1",
    weapon2: "Wpn 2",
    helmet: "Helm",
    body: "Body",
    amulet: "Amulet",
    ring1: "Ring 1",
    ring2: "Ring 2",
    gloves: "Gloves",
    belt: "Belt",
    boots: "Boots",
    flask1: "Flask 1",
    flask2: "Flask 2",
    flask3: "Flask 3",
    flask4: "Flask 4",
    flask5: "Flask 5",
    charm1: "Charm 1",
    charm2: "Charm 2",
    charm3: "Charm 3",
  },
};
