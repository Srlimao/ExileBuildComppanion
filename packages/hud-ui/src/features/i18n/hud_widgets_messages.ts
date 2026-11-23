import type { HudLocale } from "./locale_storage_and_types.js";
import {
  EN_ASCENDANCY_ORDER_MESSAGES,
  PT_BR_ASCENDANCY_ORDER_MESSAGES,
  type AscendancyOrderWidgetMessages,
} from "./ascendancy_order_widget_messages.js";
import {
  EN_TWINK_GEAR_MESSAGES,
  PT_BR_TWINK_GEAR_MESSAGES,
  type TwinkGearWidgetMessages,
} from "./twink_gear_widget_messages.js";

export interface HudWidgetsMessages {
  actStepsTitle: (act: number) => string;
  pendingOnly: string;
  showAllEarlier: (count: number) => string;
  showAll: string;
  plusOneSkill: string;
  trial: string;
  allActStepsComplete: (act: number) => string;
  cleanupBacklog: string;
  openCount: (count: number) => string;
  actWord: string;
  book: string;
  noSkippedBacklog: string;
  zoneLayout: string;
  linearZoneHint: string;
  seedLabel: (index: number) => string;
  layoutAlt: (area: string, index: number) => string;
  townPickupGems: string;
  hideDone: string;
  doneCount: (count: number) => string;
  bag: string;
  swap: string;
  freeQuest: string;
  allActGemsAcquired: string;
  noPendingGems: string;
  linksTitle: string;
  groupsCount: (count: number) => string;
  missingAura: string;
  fullTree: string;
  nextNotables: string;
  allNotablesAllocated: string;
  vendorRegex: string;
  autoPcSync: string;
  manual: string;
  pushToPc: string;
  copied: string;
  copy: string;
  resistances: string;
  actTargets: string;
  liveGear: string;
  fire: string;
  cold: string;
  light: string;
  chaos: string;
  benchCraft: string;
  gearAndFlasks: string;
  slotsAndAlerts: (slotsCount: number | null, alertsCount: number) => string;
  benchPrefix: string;
  gearLooksGood: string;
  noItemsInSet: string;
  equipped: string;
  runTimer: string;
  live: string;
  paused: string;
  checkpointsLabel: string;
  labCompass: string;
  importJson: string;
  hidePaste: string;
  paste: string;
  pastePlaceholder: string;
  load: string;
  noDailyLabJson: string;
  izaroPhases: string;
  campaignTrials: string;
  ascendancyOrder: AscendancyOrderWidgetMessages;
  twinkGear: TwinkGearWidgetMessages;
}

const PT_BR_WIDGETS: HudWidgetsMessages = {
  actStepsTitle: (act) => `Passos do Ato ${act}`,
  pendingOnly: "Apenas pendentes",
  showAllEarlier: (count) => `Mostrar tudo (${count} anteriores)`,
  showAll: "Mostrar tudo",
  plusOneSkill: "+1 Ponto",
  trial: "Trial",
  allActStepsComplete: (act) => `Todos os passos do Ato ${act} concluídos`,
  cleanupBacklog: "Pendências",
  openCount: (count) => `${count} abertas`,
  actWord: "Ato",
  book: "Livro",
  noSkippedBacklog: "Nenhum livro de ponto ou Trial do Lab pendente.",
  zoneLayout: "Layout da Zona",
  linearZoneHint: "Zona linear ou cidade — siga os marcadores de missão e saída abaixo.",
  seedLabel: (i) => `Variante ${i}`,
  layoutAlt: (area, i) => `Layout de ${area} variante ${i}`,
  townPickupGems: "Cidade · Gemas",
  hideDone: "Ocultar feitas",
  doneCount: (count) => `${count} feitas`,
  bag: "Mochila",
  swap: "Swap",
  freeQuest: "grátis quest",
  allActGemsAcquired: "Todas as gemas do Ato adquiridas",
  noPendingGems: "Nenhuma gema pendente neste Ato ou build carregada.",
  linksTitle: "Links",
  groupsCount: (count) => `${count} grupos`,
  missingAura: "Aura Ausente",
  fullTree: "Árvore Completa",
  nextNotables: "Próximos Notables",
  allNotablesAllocated: "Todos os notables alvo já alocados.",
  vendorRegex: "Regex de Vendor",
  autoPcSync: "Sync Auto PC",
  manual: "Manual",
  pushToPc: "Enviar p/ PC",
  copied: "Copiado",
  copy: "Copiar",
  resistances: "Resistências",
  actTargets: "Metas do Ato",
  liveGear: "Gear Atual",
  fire: "Fogo",
  cold: "Gelo",
  light: "Raio",
  chaos: "Caos",
  benchCraft: "Bancada de Craft",
  gearAndFlasks: "Gear e Flasks",
  slotsAndAlerts: (slots, alerts) =>
    `${slots !== null ? `${slots} slots · ` : ""}${alerts} ${alerts === 1 ? "alerta" : "alertas"}`,
  benchPrefix: "Bancada:",
  gearLooksGood: "Botas, flasks e armas estão adequados.",
  noItemsInSet: "Nenhum slot de item preenchido neste set.",
  equipped: "Equipado",
  runTimer: "Cronômetro",
  live: "AO VIVO",
  paused: "PAUSADO",
  checkpointsLabel: "Etapas",
  labCompass: "Bússola do Lab",
  importJson: "Importar JSON",
  hidePaste: "Ocultar",
  paste: "Colar",
  pastePlaceholder: "Cole o JSON diário do PoELab...",
  load: "Carregar",
  noDailyLabJson: "Nenhum JSON diário do PoELab carregado — importe de poelab.com para rastrear salas pelo",
  izaroPhases: "Fases do Izaro",
  campaignTrials: "Trials da Campanha",
  ascendancyOrder: PT_BR_ASCENDANCY_ORDER_MESSAGES,
  twinkGear: PT_BR_TWINK_GEAR_MESSAGES,
};

const EN_WIDGETS: HudWidgetsMessages = {
  actStepsTitle: (act) => `Act ${act} Steps`,
  pendingOnly: "Pending only",
  showAllEarlier: (count) => `Show all (${count} earlier)`,
  showAll: "Show all",
  plusOneSkill: "+1 Skill",
  trial: "Trial",
  allActStepsComplete: (act) => `All Act ${act} steps complete`,
  cleanupBacklog: "Cleanup Backlog",
  openCount: (count) => `${count} open`,
  actWord: "Act",
  book: "Book",
  noSkippedBacklog: "No skipped skill books or Lab trials.",
  zoneLayout: "Zone Layout",
  linearZoneHint: "Linear / Town zone — follow quest & exit direction markers below.",
  seedLabel: (i) => `Seed ${i}`,
  layoutAlt: (area, i) => `${area} layout seed ${i}`,
  townPickupGems: "Town Pickup · Gems",
  hideDone: "Hide done",
  doneCount: (count) => `${count} done`,
  bag: "Bag",
  swap: "Swap",
  freeQuest: "free quest",
  allActGemsAcquired: "All Act gems acquired",
  noPendingGems: "No pending Act gems or build gems loaded.",
  linksTitle: "Links",
  groupsCount: (count) => `${count} groups`,
  missingAura: "Missing Aura",
  fullTree: "Full Tree",
  nextNotables: "Next Notables",
  allNotablesAllocated: "All target notables allocated.",
  vendorRegex: "Vendor Regex",
  autoPcSync: "Auto-PC Sync",
  manual: "Manual",
  pushToPc: "Push to PC",
  copied: "Copied",
  copy: "Copy",
  resistances: "Resistances",
  actTargets: "Act Targets",
  liveGear: "Live Gear",
  fire: "Fire",
  cold: "Cold",
  light: "Light",
  chaos: "Chaos",
  benchCraft: "Bench Craft",
  gearAndFlasks: "Gear & Flasks",
  slotsAndAlerts: (slots, alerts) => `${slots !== null ? `${slots} slots · ` : ""}${alerts} alerts`,
  benchPrefix: "Bench:",
  gearLooksGood: "Boots, flasks, and weapon tiers look good.",
  noItemsInSet: "No item slots populated in this set.",
  equipped: "Equipped",
  runTimer: "Run Timer",
  live: "LIVE",
  paused: "PAUSED",
  checkpointsLabel: "Checkpoints",
  labCompass: "Lab Compass",
  importJson: "Import JSON",
  hidePaste: "Hide Paste",
  paste: "Paste",
  pastePlaceholder: "Paste PoELab daily JSON...",
  load: "Load",
  noDailyLabJson: "No daily PoELab JSON loaded yet — import from poelab.com to auto-track rooms by",
  izaroPhases: "Izaro Phases",
  campaignTrials: "Campaign Trials",
  ascendancyOrder: EN_ASCENDANCY_ORDER_MESSAGES,
  twinkGear: EN_TWINK_GEAR_MESSAGES,
};

export const HUD_WIDGET_MESSAGES: Record<HudLocale, HudWidgetsMessages> = {
  "pt-BR": PT_BR_WIDGETS,
  en: EN_WIDGETS,
};
