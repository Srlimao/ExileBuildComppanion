import type { HudContextMode, WidgetId } from "@exile-hud/core";
import type { HudAccentPresetId, HudAppearanceMode } from "../theme/theme_tokens_and_palettes.js";
import type { HudLocale } from "./locale_storage_and_types.js";

export interface HudShellAndTreeMessages {
  modes: Record<HudContextMode | "AUTO", string>;
  theme: {
    triggerLabel: string;
    triggerTitle: string;
    themeButton: string;
    languageLabel: string;
    surfaceLabel: string;
    accentLabel: string;
    customHexLabel: string;
    modes: Record<HudAppearanceMode, string>;
    swatches: Record<Exclude<HudAccentPresetId, "custom">, string>;
  };
  deathBanner: { slainPrefix: string; subtextPrefix: string; dismiss: string };
  standby: {
    eyebrow: string;
    previewButton: string;
    totalRunTimePaused: string;
    campaignCheckpoints: string;
    actSplitTimes: string;
    actLabel: (act: number) => string;
  };
  grid: {
    editingPrefix: string;
    layoutSuffix: string;
    addWidget: string;
    customizeTitle: (modeLabel: string) => string;
    savedForViewport: (formFactor: string) => string;
    resetDefaults: string;
    active: string;
    add: string;
    widgetCatalog: Record<WidgetId, { label: string; description: string }>;
  };
  tree: {
    autoLevel: (level: number) => string;
    allocLabel: string;
    bracketLabel: (count: number) => string;
    earlierLabel: (count: number) => string;
    searchPlaceholder: string;
    fitBracket: string;
    nextPoint: string;
    ascendancy: string;
    futurePath: string;
    legendAllocated: string;
    legendNewBracket: string;
    legendEarlier: string;
    legendRespec: string;
    legendMastery: string;
    zoomIn: string;
    zoomOut: string;
    closeInspector: string;
    nodeKinds: Record<"keystone" | "mastery" | "notable" | "jewel" | "passive", string>;
    pobChosenMastery: string;
    allocated: string;
    unallocatedAway: (pts: number) => string;
    respecTarget: string;
    nextPriorityTargets: string;
    sync: string;
    allTargetsAllocated: string;
    newBadge: string;
    earlierBadge: string;
    ptShort: string;
    bracketMasteries: (count: number) => string;
    respecNodes: (count: number) => string;
  };
}

const PT_BR_SHELL_AND_TREE: HudShellAndTreeMessages = {
  modes: { FIELD: "CAMPO", TOWN: "CIDADE", LAB: "LAB", TREE: "ÁRVORE", STANDBY: "ESPERA", AUTO: "AUTO" },
  theme: {
    triggerLabel: "Tema e aparência",
    triggerTitle: "Aparência e cor de destaque",
    themeButton: "Tema",
    languageLabel: "Idioma",
    surfaceLabel: "Superfície",
    accentLabel: "Destaque",
    customHexLabel: "Hex Personalizado",
    modes: { oled: "OLED", "soft-dark": "Suave", light: "Claro" },
    swatches: {
      chalk: "Giz",
      gold: "Ouro Exilado",
      crimson: "Carmesim Vaal",
      cyan: "Ciano Mana",
      viridian: "Viridiano",
      amethyst: "Ametista",
    },
  },
  deathBanner: {
    slainPrefix: "Abatido — Pegue o Portal de volta para",
    subtextPrefix: "Entrada na cidade via Ressuscitar na Cidade; progresso de combate ancorado em",
    dismiss: "Dispensar",
  },
  standby: {
    eyebrow: "Espera · Aguardando PathOfExile.exe",
    previewButton: "Pré-visualizar HUD Ativa",
    totalRunTimePaused: "Tempo Total da Run (Pausado)",
    campaignCheckpoints: "Etapas da Campanha",
    actSplitTimes: "Tempos por Ato",
    actLabel: (act) => `Ato ${act}`,
  },
  grid: {
    editingPrefix: "Editando layout de",
    layoutSuffix: "",
    addWidget: "Adicionar Widget",
    customizeTitle: (modeLabel) => `Personalizar Widgets de ${modeLabel}`,
    savedForViewport: (ff) => `Salvo especificamente para a tela ${ff}`,
    resetDefaults: "Restaurar Padrões",
    active: "Ativo",
    add: "Adicionar",
    widgetCatalog: {
      zone_layout: { label: "Mapa da Zona", description: "Variantes de layout e direção na bússola" },
      active_checklist: { label: "Checklist Ativo", description: "Passos da zona, missões e progresso automático" },
      vendor_shopping: { label: "Vendor e Gemas", description: "Gemas de quest vs vendor e orçamento Atos 1–3" },
      socket_links: { label: "Sockets e Links", description: "Links alvo, alertas de suporte e auras" },
      passive_tree: { label: "Árvore Passiva", description: "Notables pendentes do PoB e contador de Respec" },
      regex_sync: { label: "Regex de Vendor", description: "Sincronização de Regex com a área de transferência do PC" },
      deferred_backlog: { label: "Pendências", description: "Livros de skill e Trials do Lab ignorados" },
      resistance_cap: { label: "Resistências", description: "Resistências equipadas vs meta do Ato e Kitava" },
      gear_hygiene: { label: "Gear e Flasks", description: "Botas 0% MS, nível de flasks e armas" },
      run_timer: { label: "Cronômetro", description: "Tempo total, parciais por Ato e ritmo" },
      lab_compass: { label: "Bússola do Lab", description: "Rastreador diário do PoELab, Trials e Izaro" },
    },
  },
  tree: {
    autoLevel: (lv) => `Auto (Nv ${lv})`,
    allocLabel: "Aloc.",
    bracketLabel: (n) => `+${n} Etapa`,
    earlierLabel: (n) => `${n} Anteriores`,
    searchPlaceholder: "Buscar nós ou atributos (ex: Fire, Life, Mastery)...",
    fitBracket: "Ajustar Etapa",
    nextPoint: "Próximo Ponto",
    ascendancy: "Ascendência",
    futurePath: "Caminho Futuro",
    legendAllocated: "Alocado",
    legendNewBracket: "Nova Etapa",
    legendEarlier: "Anterior",
    legendRespec: "Respec",
    legendMastery: "Mastery",
    zoomIn: "Aumentar zoom",
    zoomOut: "Diminuir zoom",
    closeInspector: "Fechar inspetor",
    nodeKinds: { keystone: "Keystone", mastery: "Mastery", notable: "Notable", jewel: "Jewel Socket", passive: "Passiva" },
    pobChosenMastery: "Mastery Escolhida no PoB",
    allocated: "Alocado",
    unallocatedAway: (pts) => `Não alocado · ${pts} ${pts === 1 ? "ponto" : "pontos"} de distância`,
    respecTarget: "Alvo de Respec",
    nextPriorityTargets: "Próximos Alvos Prioritários",
    sync: "Sincronizar",
    allTargetsAllocated: "Todas as keystones, notables e masteries desta etapa estão alocadas.",
    newBadge: "NOVO",
    earlierBadge: "ANTERIOR",
    ptShort: "pt",
    bracketMasteries: (n) => `Masteries da Etapa (${n})`,
    respecNodes: (n) => `Nós para Respec (${n})`,
  },
};

const EN_SHELL_AND_TREE: HudShellAndTreeMessages = {
  modes: { FIELD: "FIELD", TOWN: "TOWN", LAB: "LAB", TREE: "TREE", STANDBY: "STANDBY", AUTO: "AUTO" },
  theme: {
    triggerLabel: "Theme and appearance settings",
    triggerTitle: "Appearance & Accent Color",
    themeButton: "Theme",
    languageLabel: "Language",
    surfaceLabel: "Surface",
    accentLabel: "Accent",
    customHexLabel: "Custom Hex",
    modes: { oled: "OLED", "soft-dark": "Soft", light: "Light" },
    swatches: {
      chalk: "Chalk",
      gold: "Exile Gold",
      crimson: "Vaal Crimson",
      cyan: "Mana Cyan",
      viridian: "Viridian",
      amethyst: "Amethyst",
    },
  },
  deathBanner: {
    slainPrefix: "Slain — Take Portal Back to",
    subtextPrefix: "Town entered via Resurrect in Town; combat progression anchored to",
    dismiss: "Dismiss",
  },
  standby: {
    eyebrow: "Standby · Waiting for PathOfExile.exe",
    previewButton: "Preview Active HUD",
    totalRunTimePaused: "Total Run Time (Paused)",
    campaignCheckpoints: "Campaign Checkpoints",
    actSplitTimes: "Act Split Times",
    actLabel: (act) => `Act ${act}`,
  },
  grid: {
    editingPrefix: "Editing",
    layoutSuffix: "layout",
    addWidget: "Add Widget",
    customizeTitle: (modeLabel) => `Customize ${modeLabel} Widgets`,
    savedForViewport: (ff) => `Saved specifically for ${ff} viewport`,
    resetDefaults: "Reset Defaults",
    active: "Active",
    add: "Add",
    widgetCatalog: {
      zone_layout: { label: "Zone Layout", description: "Exile-UI map seed variants & compass direction" },
      active_checklist: { label: "Active Checklist", description: "Zone steps, quest objectives & soft-progress" },
      vendor_shopping: { label: "Vendor & Gems", description: "Quest vs vendor gems & Act 1-3 currency budget" },
      socket_links: { label: "Socket & Links", description: "Target links, unlinked support & aura alerts" },
      passive_tree: { label: "Passive Tree", description: "Unallocated PoB notables & respec counter" },
      regex_sync: { label: "Vendor Regex", description: "Live PC clipboard regex sync & re-push" },
      deferred_backlog: { label: "Cleanup Backlog", description: "Skipped skill books & Lab trials" },
      resistance_cap: { label: "Resistances", description: "Live ele/chaos vs Act & Kitava targets" },
      gear_hygiene: { label: "Gear & Flasks", description: "0% MS boots, flask tier & weapon alerts" },
      run_timer: { label: "Run Timer", description: "Total timer, Act splits & pace delta" },
      lab_compass: { label: "Lab Compass", description: "Daily PoELab room tracker, Trials & Izaro" },
    },
  },
  tree: {
    autoLevel: (lv) => `Auto (Lv ${lv})`,
    allocLabel: "Alloc",
    bracketLabel: (n) => `+${n} Bracket`,
    earlierLabel: (n) => `${n} Earlier`,
    searchPlaceholder: "Search nodes or stats (e.g. Fire, Life, Mastery)...",
    fitBracket: "Fit Bracket",
    nextPoint: "Next Point",
    ascendancy: "Ascendancy",
    futurePath: "Future Path",
    legendAllocated: "Allocated",
    legendNewBracket: "New Bracket",
    legendEarlier: "Earlier",
    legendRespec: "Respec",
    legendMastery: "Mastery",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    closeInspector: "Close Inspector",
    nodeKinds: { keystone: "Keystone", mastery: "Mastery", notable: "Notable", jewel: "Jewel Socket", passive: "Passive" },
    pobChosenMastery: "PoB Chosen Mastery",
    allocated: "Allocated",
    unallocatedAway: (pts) => `Unallocated · ${pts} pt${pts === 1 ? "" : "s"} away`,
    respecTarget: "Respec Target",
    nextPriorityTargets: "Next Priority Targets",
    sync: "Sync",
    allTargetsAllocated: "All keystones, notables & masteries in this bracket are allocated.",
    newBadge: "NEW",
    earlierBadge: "EARLIER",
    ptShort: "pt",
    bracketMasteries: (n) => `Bracket Masteries (${n})`,
    respecNodes: (n) => `Respec Nodes (${n})`,
  },
};

export const HUD_SHELL_AND_TREE_MESSAGES: Record<HudLocale, HudShellAndTreeMessages> = {
  "pt-BR": PT_BR_SHELL_AND_TREE,
  en: EN_SHELL_AND_TREE,
};
