import type {
  AreaDefinition,
  BossElementalWarning,
  CampaignQuestGroupDefinition,
  CharacterStartGems,
  CraftingBenchRecipe,
  GameAdapter,
  GemDefinition,
  IzaroMechanicGuide,
  LabTrialMeta,
  LeagueStarterFilterMetadata,
  PassiveTreeGraphMetadata,
  PassiveTreeNodeMetadata,
  Poe2PermanentBonusReward,
  Poe2RuneSocketSuggestion,
  Poe2ZoneLandmarkHint,
  QuestDefinition,
  TwinkCatalogItem,
} from "./game_adapter_contract.js";
import {
  POE2_ACT_ENTRY_AREA_BY_ACT,
  POE2_ACT_FINAL_AREA_BY_ACT,
  POE2_BOSS_WARNINGS,
  POE2_EMPTY_GRAPH_META,
  POE2_OPTIONAL_DETOUR_AREA_IDS,
  POE2_TRIALS,
  poe2Areas,
  poe2DefaultRoutes,
  poe2GemAliases,
  poe2Gems,
  poe2LeagueStarterFilterMeta,
  poe2PermanentBonuses,
  poe2RuneSocketHints,
  poe2TwinkGearCatalog,
  poe2ZoneLandmarks,
} from "./poe2_static_dataset_loader.js";

const AREAS_BY_LOWER_NAME = (() => {
  const map = new Map<string, AreaDefinition[]>();
  for (const area of Object.values(poe2Areas)) {
    const key = area.name.trim().toLowerCase();
    const list = map.get(key) ?? [];
    list.push(area);
    map.set(key, list);
  }
  return map;
})();

const EMPTY_STRING_SET: ReadonlySet<string> = new Set();

let hydratedPoe2TreeNodes: Record<string, PassiveTreeNodeMetadata> = {};
let hydratedPoe2TreeGraphMeta: PassiveTreeGraphMetadata = POE2_EMPTY_GRAPH_META;
let poe2TreeHydrated = false;

/** Populates the in-memory PoE 2 passive tree cache after lazy dynamic import. */
export function hydratePoe2PassiveTreeCache(
  nodes: Record<string, PassiveTreeNodeMetadata>,
  meta: PassiveTreeGraphMetadata,
): void {
  hydratedPoe2TreeNodes = nodes;
  hydratedPoe2TreeGraphMeta = meta;
  poe2TreeHydrated = true;
}

/** Returns true once the PoE 2 passive tree JSON dataset has been lazy-loaded. */
export function isPoe2PassiveTreeHydrated(): boolean {
  return poe2TreeHydrated;
}

export class Poe2CampaignGameAdapter implements GameAdapter {
  readonly gameId = "poe2" as const;

  getAreas(): Record<string, AreaDefinition> {
    return poe2Areas;
  }

  getGems(): Record<string, GemDefinition> {
    return poe2Gems;
  }

  getQuests(): Record<string, QuestDefinition> {
    return {};
  }

  getCharacters(): Record<string, CharacterStartGems> {
    return {};
  }

  getKillWaypoints(): Record<string, string[]> {
    return {};
  }

  getAwakenedGemLookup(): Record<string, string> {
    return {};
  }

  getVaalGemLookup(): Record<string, string> {
    return {};
  }

  getGemIdAliases(): Record<string, string> {
    return poe2GemAliases;
  }

  getDefaultRouteFiles(): Record<string, string> {
    return poe2DefaultRoutes;
  }

  getZoneLayoutVariants(): string[] {
    return [];
  }

  getPassiveTreeNodes(): Record<string, PassiveTreeNodeMetadata> {
    return hydratedPoe2TreeNodes;
  }

  getPassiveTreeGraphMeta(): PassiveTreeGraphMetadata {
    return hydratedPoe2TreeGraphMeta;
  }

  getCraftingBenchRecipes(): CraftingBenchRecipe[] {
    return [];
  }

  getTwinkGearCatalog(): TwinkCatalogItem[] {
    return poe2TwinkGearCatalog;
  }

  resolveOfficialUniqueIconUrl(): string | null {
    return null;
  }

  resolveAreaById(areaId: string): AreaDefinition | null {
    return poe2Areas[areaId] ?? null;
  }

  resolveAreasByName(localizedName: string): AreaDefinition[] {
    return AREAS_BY_LOWER_NAME.get(localizedName.trim().toLowerCase()) ?? [];
  }

  getResistancePenaltyForAct(highestUnlockedAct: number): number {
    if (highestUnlockedAct >= 8) return -60;
    if (highestUnlockedAct >= 6) return -50;
    if (highestUnlockedAct >= 5) return -40;
    if (highestUnlockedAct >= 4) return -30;
    if (highestUnlockedAct >= 3) return -20;
    if (highestUnlockedAct >= 2) return -10;
    return 0;
  }

  getSkillBookQuestIds(): ReadonlySet<string> {
    return EMPTY_STRING_SET;
  }

  isSkillBookQuestOffer(): boolean {
    return false;
  }

  getQuestPrerequisiteAreaIds(): string[] {
    return [];
  }

  getActEntryAreaId(act: number): string | null {
    return POE2_ACT_ENTRY_AREA_BY_ACT[act] ?? null;
  }

  getActFinalAreaId(act: number): string | null {
    return POE2_ACT_FINAL_AREA_BY_ACT[act] ?? null;
  }

  isIgnoredGraphEdge(): boolean {
    return false;
  }

  getCampaignQuestGroups(): readonly CampaignQuestGroupDefinition[] {
    return [];
  }

  getOptionalDetourAreaIds(): ReadonlySet<string> {
    return POE2_OPTIONAL_DETOUR_AREA_IDS;
  }

  getLabTrials(): LabTrialMeta[] {
    return POE2_TRIALS;
  }

  getIzaroMechanics(): IzaroMechanicGuide[] {
    return [];
  }

  getBossElementalWarnings(act: number): BossElementalWarning[] {
    return POE2_BOSS_WARNINGS.filter((w) => w.act === act);
  }

  getCampaignStageCount(): number {
    return 7;
  }

  getActDisplayLabel(act: number, locale: "en" | "pt-BR" = "en"): string {
    const clamped = Math.max(1, act);
    if (clamped >= 5 && clamped <= 7) {
      const interlude = clamped - 4;
      return locale === "pt-BR" ? `Interlúdio ${interlude}` : `Interlude ${interlude}`;
    }
    return locale === "pt-BR" ? `Ato ${clamped}` : `Act ${clamped}`;
  }

  getDefaultStartAreaId(): string {
    return "G1_1";
  }

  getPermanentCampaignBonuses(): readonly Poe2PermanentBonusReward[] {
    return poe2PermanentBonuses;
  }

  getZoneLandmarkHints(areaId: string): Poe2ZoneLandmarkHint | null {
    return poe2ZoneLandmarks[areaId] ?? null;
  }

  getRuneSocketHints(): readonly Poe2RuneSocketSuggestion[] {
    return poe2RuneSocketHints;
  }

  getLeagueStarterFilterMeta(): LeagueStarterFilterMetadata {
    return poe2LeagueStarterFilterMeta;
  }
}

export const poe2GameAdapter = new Poe2CampaignGameAdapter();
