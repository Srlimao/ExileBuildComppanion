import type { BuildCatalogSource, BuildGoalTag, BuildPlaystyleTag } from "@exile-hud/core";
import type { HudLocale } from "./locale_storage_and_types.js";

export interface DesktopBuildFinderMessages {
  findBuildBtn: string;
  findBuildTooltip: string;
  windowTitle: string;
  stepLabels: readonly [string, string, string];
  skipToAllBtn: string;
  backBtn: string;
  nextTagsBtn: string;
  showMatchingBuildsBtn: (count: number) => string;
  closeBtn: string;
  anyClassTitle: string;
  anyClassSubtitle: string;
  anyAscendancyOption: string;
  classStepTitle: string;
  classStepSubtitle: string;
  tagsStepTitle: string;
  tagsStepSubtitle: string;
  playstyleSectionTitle: string;
  goalSectionTitle: string;
  pobReadyOnlyLabel: string;
  pobReadyOnlyHint: string;
  resultsStepTitle: string;
  searchPlaceholder: string;
  allSourcesLabel: string;
  sortLabel: string;
  sortOptions: Record<"recommended" | "updated" | "popular", string>;
  pobReadyBadge: string;
  guideOnlyBadge: string;
  importBuildBtn: string;
  importingBuildBtn: string;
  openGuideBtn: string;
  buildsFoundCount: (count: number) => string;
  freshnessUpdatedLabel: (patch: string, league: string) => string;
  catalogLoadingMsg: string;
  catalogOfflineTitle: string;
  catalogOfflineHint: string;
  retryBtn: string;
  noMatchesTitle: string;
  noMatchesHint: string;
  resetFiltersBtn: string;
  handoffLoadedNotice: (title: string) => string;
  playstyleLabels: Record<BuildPlaystyleTag, string>;
  goalLabels: Record<BuildGoalTag, string>;
  sourceLabels: Record<BuildCatalogSource, string>;
}

const EN_MESSAGES: DesktopBuildFinderMessages = {
  findBuildBtn: "Find Build",
  findBuildTooltip: "Browse curated community builds by class and playstyle",
  windowTitle: "Find Build",
  stepLabels: ["1. Class", "2. Tags", "3. Builds"],
  skipToAllBtn: "Skip to All Builds",
  backBtn: "Back",
  nextTagsBtn: "Next: Playstyle & Tags",
  showMatchingBuildsBtn: (count) => `Show ${count} Matching Builds`,
  closeBtn: "Close",
  anyClassTitle: "Any Class",
  anyClassSubtitle: "Browse builds across all classes",
  anyAscendancyOption: "Any Ascendancy",
  classStepTitle: "Choose your preferred class",
  classStepSubtitle: "Pick a base class or drill into a specific ascendancy to narrow the catalog.",
  tagsStepTitle: "Pick playstyle & campaign goals",
  tagsStepSubtitle: "Select one or more playstyles and goals, or leave blank to see all.",
  playstyleSectionTitle: "Playstyle",
  goalSectionTitle: "Goal & Mode",
  pobReadyOnlyLabel: "PoB-Ready Only",
  pobReadyOnlyHint: "Filter to builds with 1-click Path of Building import",
  resultsStepTitle: "Recommended Builds",
  searchPlaceholder: "Search skill, build title, or author...",
  allSourcesLabel: "All Sources",
  sortLabel: "Sort",
  sortOptions: {
    recommended: "Recommended",
    updated: "Recently Updated",
    popular: "Most Popular",
  },
  pobReadyBadge: "1-Click PoB",
  guideOnlyBadge: "Guide / Planner",
  importBuildBtn: "Import Build",
  importingBuildBtn: "Loading PoB...",
  openGuideBtn: "Open Guide",
  buildsFoundCount: (count) => `${count} build${count === 1 ? "" : "s"}`,
  freshnessUpdatedLabel: (patch, league) =>
    [patch, league].filter(Boolean).join(" · ") || "Live Catalog",
  catalogLoadingMsg: "Loading community build catalog...",
  catalogOfflineTitle: "Could not reach Build Catalog relay",
  catalogOfflineHint: "Check your internet connection or Relay URL in the Connect tab.",
  retryBtn: "Retry",
  noMatchesTitle: "No builds matched your filters",
  noMatchesHint: "Try clearing a tag filter or turning off PoB-Ready Only.",
  resetFiltersBtn: "Reset Filters",
  handoffLoadedNotice: (title) => `Loaded "${title}" from Build Finder — review sets & save.`,
  playstyleLabels: {
    melee: "Melee",
    caster: "Caster",
    ranged: "Bow / Ranged",
    minion: "Minion",
    totem_brand: "Totem / Brand",
    trap_mine: "Trap / Mine",
    dot_rf: "DoT / RF",
    trigger: "Trigger / CoC",
  },
  goalLabels: {
    league_starter: "League Start",
    endgame: "Endgame",
    bosser: "Bosser",
    mapper: "Mapper",
    ssf_friendly: "SSF",
    hc_friendly: "Hardcore",
    budget: "Budget",
  },
  sourceLabels: {
    maxroll: "Maxroll",
    poebuilds: "PoEBuilds.cc",
    poeforum: "PoE Forum",
  },
};

const PT_BR_MESSAGES: DesktopBuildFinderMessages = {
  findBuildBtn: "Buscar Build",
  findBuildTooltip: "Explorar builds da comunidade por classe e estilo de jogo",
  windowTitle: "Buscar Build",
  stepLabels: ["1. Classe", "2. Tags", "3. Builds"],
  skipToAllBtn: "Ver Todas as Builds",
  backBtn: "Voltar",
  nextTagsBtn: "Avançar: Estilo e Tags",
  showMatchingBuildsBtn: (count) => `Mostrar ${count} Builds`,
  closeBtn: "Fechar",
  anyClassTitle: "Qualquer Classe",
  anyClassSubtitle: "Explorar builds de todas as classes",
  anyAscendancyOption: "Qualquer Ascendancy",
  classStepTitle: "Escolha sua classe preferida",
  classStepSubtitle: "Selecione uma classe base ou filtre por ascendancy para refinar o catálogo.",
  tagsStepTitle: "Estilo de jogo e objetivos",
  tagsStepSubtitle: "Selecione os estilos e objetivos desejados ou deixe vazio para ver tudo.",
  playstyleSectionTitle: "Estilo de Jogo",
  goalSectionTitle: "Objetivo e Modo",
  pobReadyOnlyLabel: "Somente com PoB",
  pobReadyOnlyHint: "Mostrar apenas builds com importação 1-clique do Path of Building",
  resultsStepTitle: "Builds Recomendadas",
  searchPlaceholder: "Buscar skill, nome da build ou autor...",
  allSourcesLabel: "Todas as Fontes",
  sortLabel: "Ordenar",
  sortOptions: {
    recommended: "Recomendadas",
    updated: "Atualizadas Recentemente",
    popular: "Mais Populares",
  },
  pobReadyBadge: "PoB 1-Clique",
  guideOnlyBadge: "Guia / Planner",
  importBuildBtn: "Importar Build",
  importingBuildBtn: "Carregando PoB...",
  openGuideBtn: "Abrir Guia",
  buildsFoundCount: (count) => `${count} build${count === 1 ? "" : "s"}`,
  freshnessUpdatedLabel: (patch, league) =>
    [patch, league].filter(Boolean).join(" · ") || "Catálogo Online",
  catalogLoadingMsg: "Carregando catálogo de builds da comunidade...",
  catalogOfflineTitle: "Não foi possível conectar ao catálogo",
  catalogOfflineHint: "Verifique sua conexão ou a Relay URL na aba Conectar.",
  retryBtn: "Tentar Novamente",
  noMatchesTitle: "Nenhuma build encontrada com esses filtros",
  noMatchesHint: "Tente remover uma tag ou desativar 'Somente com PoB'.",
  resetFiltersBtn: "Limpar Filtros",
  handoffLoadedNotice: (title) => `"${title}" carregada do Buscador — confira os sets e salve.`,
  playstyleLabels: {
    melee: "Melee",
    caster: "Caster / Magia",
    ranged: "Arco / Ranged",
    minion: "Minion / Lacaios",
    totem_brand: "Totem / Brand",
    trap_mine: "Trap / Mina",
    dot_rf: "DoT / RF",
    trigger: "Trigger / CoC",
  },
  goalLabels: {
    league_starter: "League Start",
    endgame: "Endgame",
    bosser: "Bosser",
    mapper: "Mapper",
    ssf_friendly: "SSF",
    hc_friendly: "Hardcore",
    budget: "Barata / Budget",
  },
  sourceLabels: {
    maxroll: "Maxroll",
    poebuilds: "PoEBuilds.cc",
    poeforum: "Fórum PoE",
  },
};

export const DESKTOP_BUILD_FINDER_MESSAGES: Record<HudLocale, DesktopBuildFinderMessages> = {
  en: EN_MESSAGES,
  "pt-BR": PT_BR_MESSAGES,
};
