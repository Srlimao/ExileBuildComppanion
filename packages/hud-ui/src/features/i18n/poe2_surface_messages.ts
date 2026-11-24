import type { Poe2GemKind, Poe2PermanentBonusReward } from "@exile-hud/game-data";
import type { SupportedGameId, WidgetId } from "@exile-hud/core";
import type { HudLocale } from "./locale_storage_and_types.js";

export interface Poe2SurfaceMessages {
  gameSwitchAria: string;
  gameShortLabels: Record<SupportedGameId, string>;
  gameFullLabels: Record<SupportedGameId, string>;
  oauthPendingTitle: string;
  oauthPendingBody: string;
  lootFilterLeagueBadge: (version: string) => string;
  filterFolderHint: string;
  pobMismatchNotice: (detectedGameLabel: string, activeGameLabel: string) => string;
  loadingPassiveTree: string;
  weaponSetAll: string;
  weaponSet1: string;
  weaponSet2: string;
  weaponSetBadge: (setNum: 1 | 2) => string;
  uncutGemsTitle: string;
  spiritBudgetLabel: (unlocked: number, required: number, guaranteed: number) => string;
  spiritDeficitHint: (shortfall: number) => string;
  spiritReadyHint: string;
  gemKindLabels: Record<Poe2GemKind, string>;
  uncutTierBadge: (tier: number) => string;
  spiritCostBadge: (cost: number) => string;
  noPendingUncutGems: string;
  skillSocketsTitle: string;
  jewellerTierLabel: (supportCount: number) => string;
  noSupportGems: string;
  skillSocketsNote: string;
  permanentBonusesTitle: string;
  permanentBonusesCount: (done: number, total: number) => string;
  showAllBonuses: string;
  stageBonusesOnly: string;
  bonusTypeLabels: Record<Poe2PermanentBonusReward["bonusType"], string>;
  ascendancyTrialsTitle: string;
  sekhemasTitle: string;
  sekhemasTip: string;
  chaosTitle: string;
  chaosTip: string;
  trialMilestonesHeading: string;
  trialTiers: Record<1 | 2 | 3 | 4, string>;
  zoneLandmarksTitle: string;
  exitDirectionsLabel: string;
  bossTipLabel: string;
  noZoneLandmarksHint: string;
  resPenaltyBadge: (penalty: number) => string;
  runeSocketsHeading: string;
  runeSlotPrefix: string;
  vendorRegexHint: string;
  standbyEyebrow: string;
  stageSummary: (stageLabel: string, level: number, charClass: string) => string;
  stageStepsTitle: (stageLabel: string) => string;
  allStageStepsComplete: (stageLabel: string) => string;
  launchPoe2Demo: string;
  demoGameToggleTitle: string;
  widgetCatalogOverrides: Partial<Record<WidgetId, { label: string; description: string }>>;
}

const PT_BR_POE2: Poe2SurfaceMessages = {
  gameSwitchAria: "Selecionar jogo ativo (PoE 1 ou PoE 2)",
  gameShortLabels: { poe1: "PoE 1", poe2: "PoE 2" },
  gameFullLabels: { poe1: "Path of Exile 1", poe2: "Path of Exile 2" },
  oauthPendingTitle: "Sync de personagem PoE 2 aguarda GGG OAuth 2.1",
  oauthPendingBody:
    "A GGG bloqueia consultas públicas sem OAuth no PoE 2. O monitoramento ao vivo via Client.txt e rastreamento heurístico permanecem 100% ativos.",
  lootFilterLeagueBadge: (version) => `PoE 2 EA · NeverSink v${version}`,
  filterFolderHint: "Documentos\\My Games\\Path of Exile 2",
  pobMismatchNotice: (detected, active) =>
    `Este código parece ser de ${detected}, mas a biblioteca ativa é ${active}. Troque no seletor do topo se quiser salvá-lo no outro jogo.`,
  loadingPassiveTree: "Carregando árvore passiva de PoE 2...",
  weaponSetAll: "Todos",
  weaponSet1: "Conjunto 1",
  weaponSet2: "Conjunto 2",
  weaponSetBadge: (setNum) => `Conjunto de Armas ${setNum}`,
  uncutGemsTitle: "Gemas Brutas e Espírito",
  spiritBudgetLabel: (unlocked, required, guaranteed) =>
    `Espírito: ${unlocked}/${required} req (campanha ${guaranteed})`,
  spiritDeficitHint: (shortfall) => `Faltam +${shortfall} Espírito (use cetro/bônus de campanha)`,
  spiritReadyHint: "Reserva de Espírito coberta pelos bônus da campanha",
  gemKindLabels: { skill: "Habilidade", spirit: "Espírito", support: "Suporte", meta: "Meta" },
  uncutTierBadge: (tier) => `Bruta T${tier}`,
  spiritCostBadge: (cost) => `${cost} Esp`,
  noPendingUncutGems: "Todas as Gemas Brutas desta etapa estão prontas.",
  skillSocketsTitle: "Sockets de Gemas (Joalheiro)",
  jewellerTierLabel: (supportCount) => {
    if (supportCount >= 5) return "Joalheiro Perfeito (5 Sup)";
    if (supportCount === 4) return "Joalheiro Maior (4 Sup)";
    if (supportCount === 3) return "Joalheiro Menor (3 Sup)";
    return "Base (2 Sup)";
  },
  noSupportGems: "Sem gemas de suporte vinculadas",
  skillSocketsNote: "No PoE 2, suportes são encaixados na própria Gema de Habilidade (sem cores R/G/B em equipamentos).",
  permanentBonusesTitle: "Bônus Permanentes da Etapa",
  permanentBonusesCount: (done, total) => `${done}/${total}`,
  showAllBonuses: "Ver Todos",
  stageBonusesOnly: "Só Etapa",
  bonusTypeLabels: {
    spirit: "Espírito",
    resistance: "Res",
    life: "Vida",
    weapon_set_points: "+2 Arma",
    choice: "Escolha",
    attribute: "Atrib",
    charm: "Talismã",
  },
  ascendancyTrialsTitle: "Provações da Ascendência",
  sekhemasTitle: "Provação das Sekhemas (Ato 2)",
  sekhemasTip: "Derrote Balbala na Passagem do Traidor · Proteja a Honra, priorize relíquias de Resistência à Honra e salas curtas.",
  chaosTitle: "Provação do Caos (Ato 3)",
  chaosTip: "Ultimatum Quimérico nas Terras Pantanosas · Escolha modificadores de arena leves e conclua 4 salas.",
  trialMilestonesHeading: "Marcos das Provações",
  trialTiers: {
    1: "1ª Provação · Sekhemas",
    2: "2ª Provação · Caos",
    3: "3ª Provação · Piso 3 / 7 Salas",
    4: "4ª Provação · Pináculo",
  },
  zoneLandmarksTitle: "Pontos de Referência da Zona",
  exitDirectionsLabel: "Saídas",
  bossTipLabel: "Dica de Chefe",
  noZoneLandmarksHint: "Zona linear ou sem referências catalogadas — siga as bordas e o minimapa.",
  resPenaltyBadge: (penalty) => `Penalidade PoE 2 ${penalty}%`,
  runeSocketsHeading: "Runas e Núcleos de Alma",
  runeSlotPrefix: "Encaixe",
  vendorRegexHint: "Filtro PoE 2: Velocidade de Movimento / +Nível de Gemas / Espírito / Slots",
  standbyEyebrow: "Espera · Aguardando PathOfExileSteam.exe (PoE 2)",
  stageSummary: (stageLabel, level, charClass) => `${stageLabel} · Nv ${level} ${charClass}`,
  stageStepsTitle: (stageLabel) => `Passos · ${stageLabel}`,
  allStageStepsComplete: (stageLabel) => `Todos os passos de ${stageLabel} concluídos.`,
  launchPoe2Demo: "Testar Demo PoE 2",
  demoGameToggleTitle: "Alternar jogo da demonstração",
  widgetCatalogOverrides: {
    zone_layout: { label: "Referências da Zona", description: "Marcos de mapa, saídas e dicas de chefes no PoE 2" },
    vendor_shopping: { label: "Gemas Brutas e Espírito", description: "Tiers de Gemas Brutas e orçamento de Espírito" },
    socket_links: { label: "Sockets de Gemas", description: "Tiers do Orbe do Joalheiro e gemas de suporte" },
    resistance_cap: { label: "Resistências e Runas", description: "Penalidade progressiva e sugestões de Runas" },
    lab_compass: { label: "Provações da Ascendência", description: "Sekhemas, Provação do Caos e marcos 1–4" },
    regex_sync: { label: "Regex de Vendor PoE 2", description: "Busca de botas MS, +Nível de Gemas, Espírito e Slots" },
    deferred_backlog: { label: "Bônus e Pendências", description: "Bônus permanentes e Provações ignoradas" },
    gear_hygiene: { label: "Gear, Runas e Conjuntos", description: "Itens do PoB, alertas e dicas de Runas" },
    ascendancy_order: { label: "Ascendência (PoE 2)", description: "Árvore da Ascendência e ordem pelas Provações" },
    twink_gear: { label: "Gear de Twink PoE 2", description: "Uniques de leveling por classe, nível e arquétipo" },
  },
};

const EN_POE2: Poe2SurfaceMessages = {
  gameSwitchAria: "Select active game (PoE 1 or PoE 2)",
  gameShortLabels: { poe1: "PoE 1", poe2: "PoE 2" },
  gameFullLabels: { poe1: "Path of Exile 1", poe2: "Path of Exile 2" },
  oauthPendingTitle: "PoE 2 live character sync awaits GGG OAuth 2.1",
  oauthPendingBody:
    "GGG restricts unauthenticated PoE 2 character-window queries. Live Client.txt tailing and heuristic tracking remain 100% active.",
  lootFilterLeagueBadge: (version) => `PoE 2 EA · NeverSink v${version}`,
  filterFolderHint: "Documents\\My Games\\Path of Exile 2",
  pobMismatchNotice: (detected, active) =>
    `This PoB code appears to be for ${detected}, while the active library is ${active}. Switch game mode in the header if importing for the other game.`,
  loadingPassiveTree: "Loading PoE 2 passive skill tree...",
  weaponSetAll: "All Sets",
  weaponSet1: "Set 1",
  weaponSet2: "Set 2",
  weaponSetBadge: (setNum) => `Weapon Set ${setNum}`,
  uncutGemsTitle: "Uncut Gems & Spirit",
  spiritBudgetLabel: (unlocked, required, guaranteed) =>
    `Spirit: ${unlocked}/${required} req (${guaranteed} campaign)`,
  spiritDeficitHint: (shortfall) => `Need +${shortfall} more Spirit (Sceptre / campaign skulls)`,
  spiritReadyHint: "Spirit reservation covered by unlocked campaign bonuses",
  gemKindLabels: { skill: "Skill", spirit: "Spirit", support: "Support", meta: "Meta" },
  uncutTierBadge: (tier) => `Uncut T${tier}`,
  spiritCostBadge: (cost) => `${cost} Spirit`,
  noPendingUncutGems: "All planned Uncut Gems for this stage are ready.",
  skillSocketsTitle: "Skill Gem Sockets (Jeweller)",
  jewellerTierLabel: (supportCount) => {
    if (supportCount >= 5) return "Perfect Jeweller (5-Sup)";
    if (supportCount === 4) return "Greater Jeweller (4-Sup)";
    if (supportCount === 3) return "Lesser Jeweller (3-Sup)";
    return "Base (2-Sup)";
  },
  noSupportGems: "No support gems linked yet",
  skillSocketsNote: "PoE 2 supports socket directly inside Skill Gems (no R/G/B gear colors).",
  permanentBonusesTitle: "Stage Permanent Bonuses",
  permanentBonusesCount: (done, total) => `${done}/${total}`,
  showAllBonuses: "Show All",
  stageBonusesOnly: "Stage Only",
  bonusTypeLabels: {
    spirit: "Spirit",
    resistance: "Res",
    life: "Life",
    weapon_set_points: "+2 Wpn",
    choice: "Choice",
    attribute: "Attr",
    charm: "Charm",
  },
  ascendancyTrialsTitle: "Ascendancy Trials",
  sekhemasTitle: "Trial of the Sekhemas (Act 2)",
  sekhemasTip: "Defeat Balbala in Traitor's Passage · Guard Honour, prioritize Honour Res relics and shorter rooms.",
  chaosTitle: "Trial of Chaos (Act 3)",
  chaosTip: "Chimeral Ultimatum in Chimeral Wetlands · Pick low-risk arena modifiers and clear 4 rooms.",
  trialMilestonesHeading: "Trial Milestones",
  trialTiers: {
    1: "1st Trial · Sekhemas",
    2: "2nd Trial · Chaos",
    3: "3rd Trial · Floor 3 / 7-Room",
    4: "4th Trial · Pinnacle",
  },
  zoneLandmarksTitle: "Zone Landmarks & Boss Tips",
  exitDirectionsLabel: "Exits",
  bossTipLabel: "Boss Tip",
  noZoneLandmarksHint: "Linear zone or no curated landmarks yet — follow outer wall edges and minimap cues.",
  resPenaltyBadge: (penalty) => `PoE 2 Penalty ${penalty}%`,
  runeSocketsHeading: "Runes & Soul Cores",
  runeSlotPrefix: "Socket",
  vendorRegexHint: "PoE 2 Filter: Movement Speed / +Skill Levels / Spirit / Sockets",
  standbyEyebrow: "Standby · Waiting for PathOfExileSteam.exe (PoE 2)",
  stageSummary: (stageLabel, level, charClass) => `${stageLabel} · Lv ${level} ${charClass}`,
  stageStepsTitle: (stageLabel) => `${stageLabel} Steps`,
  allStageStepsComplete: (stageLabel) => `All ${stageLabel} steps completed.`,
  launchPoe2Demo: "Try PoE 2 Demo",
  demoGameToggleTitle: "Switch demo game",
  widgetCatalogOverrides: {
    zone_layout: { label: "Zone Landmarks", description: "PoE 2 map landmarks, exit cues & boss tips" },
    vendor_shopping: { label: "Uncut Gems & Spirit", description: "Uncut gem tiers & Spirit reservation budget" },
    socket_links: { label: "Skill Gem Sockets", description: "Jeweller support socket tiers & support gems" },
    resistance_cap: { label: "Resistances & Runes", description: "Progressive act penalties & Rune socket hints" },
    lab_compass: { label: "Ascendancy Trials", description: "Sekhemas, Trial of Chaos & 1st–4th milestones" },
    regex_sync: { label: "PoE 2 Vendor Regex", description: "Search MS boots, +Skills, Spirit & Sockets" },
    deferred_backlog: { label: "Missed Bonuses", description: "Skipped permanent bonuses & Trial unlocks" },
    gear_hygiene: { label: "Gear, Runes & Sets", description: "PoB item sets, alerts & Rune socket tips" },
    ascendancy_order: { label: "Ascendancy (PoE 2)", description: "Ascendancy tree & Trial allocation order" },
    twink_gear: { label: "PoE 2 Twink Gear", description: "Leveling uniques by class, level & archetype" },
  },
};

export const POE2_SURFACE_MESSAGES: Record<HudLocale, Poe2SurfaceMessages> = {
  "pt-BR": PT_BR_POE2,
  en: EN_POE2,
};
