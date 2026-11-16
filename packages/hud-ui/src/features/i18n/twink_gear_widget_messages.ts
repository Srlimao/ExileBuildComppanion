import type { TwinkArchetypeId } from "@exile-hud/game-data";

export interface TwinkGearWidgetMessages {
  title: string;
  copyStashRegex: string;
  copiedRegex: string;
  autoLabel: (archetypeLabel: string) => string;
  archetypes: Record<TwinkArchetypeId, string>;
  currentBracket: string;
  earlierBracket: string;
  upcomingBracket: string;
  equipped: string;
  pobBadge: string;
  hollowPalmNotice: string;
  noItems: string;
  lvShort: (level: number) => string;
  basePrefix: string;
  itemsCount: (equipped: number, total: number) => string;
}

export const PT_BR_TWINK_GEAR_MESSAGES: TwinkGearWidgetMessages = {
  title: "Gear de Twink",
  copyStashRegex: "Copiar Regex Stash",
  copiedRegex: "Copiado",
  autoLabel: (arch) => `Auto (${arch})`,
  archetypes: {
    spell: "Spell",
    bow: "Bow",
    melee: "Melee",
    minion: "Minion",
    hollow_palm: "Hollow Palm",
  },
  currentBracket: "ATUAL",
  earlierBracket: "Anterior",
  upcomingBracket: "Próximo",
  equipped: "Equipado",
  pobBadge: "PoB",
  hollowPalmNotice: "Hollow Palm (Unencumbered): Weapon, Offhand e Gloves omitidos.",
  noItems: "Nenhum item de twink encontrado para este filtro.",
  lvShort: (lv) => `Nv ${lv}`,
  basePrefix: "Base:",
  itemsCount: (equipped, total) => `${equipped}/${total}`,
};

export const EN_TWINK_GEAR_MESSAGES: TwinkGearWidgetMessages = {
  title: "Twink Gear",
  copyStashRegex: "Copy Stash Regex",
  copiedRegex: "Copied",
  autoLabel: (arch) => `Auto (${arch})`,
  archetypes: {
    spell: "Spell",
    bow: "Bow",
    melee: "Melee",
    minion: "Minion",
    hollow_palm: "Hollow Palm",
  },
  currentBracket: "CURRENT",
  earlierBracket: "Earlier",
  upcomingBracket: "Up Next",
  equipped: "Equipped",
  pobBadge: "PoB",
  hollowPalmNotice: "Hollow Palm (Unencumbered): Weapon, Offhand & Gloves omitted.",
  noItems: "No twink items matched this filter.",
  lvShort: (lv) => `Lv ${lv}`,
  basePrefix: "Base:",
  itemsCount: (equipped, total) => `${equipped}/${total}`,
};
