import type {
  AreaDefinition,
  BossElementalWarning,
  CampaignQuestGroupDefinition,
  CharacterStartGems,
  CraftingBenchRecipe,
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
  SupportedGameId,
  TwinkCatalogItem,
} from "./game_adapter_domain_types.js";

export * from "./game_adapter_domain_types.js";

export interface GameAdapter {
  readonly gameId: SupportedGameId;
  getAreas(): Record<string, AreaDefinition>;
  getGems(): Record<string, GemDefinition>;
  getQuests(): Record<string, QuestDefinition>;
  getCharacters(): Record<string, CharacterStartGems>;
  getKillWaypoints(): Record<string, string[]>;
  getAwakenedGemLookup(): Record<string, string>;
  getVaalGemLookup(): Record<string, string>;
  getGemIdAliases(): Record<string, string>;
  getDefaultRouteFiles(): Record<string, string>;
  getZoneLayoutVariants(areaId: string): string[];
  getPassiveTreeNodes(): Record<string, PassiveTreeNodeMetadata>;
  getPassiveTreeGraphMeta(): PassiveTreeGraphMetadata;
  getCraftingBenchRecipes(): CraftingBenchRecipe[];
  getTwinkGearCatalog(): TwinkCatalogItem[];
  resolveOfficialUniqueIconUrl(itemName: string): string | null;
  resolveAreaById(areaId: string): AreaDefinition | null;
  resolveAreasByName(localizedName: string): AreaDefinition[];
  getResistancePenaltyForAct(highestUnlockedAct: number, completedBossFlags: string[]): number;
  getSkillBookQuestIds(): ReadonlySet<string>;
  isSkillBookQuestOffer(questId: string, offerIds?: readonly string[]): boolean;
  getQuestPrerequisiteAreaIds(questId: string, offerIds?: readonly string[]): string[];
  getActEntryAreaId(act: number): string | null;
  getActFinalAreaId(act: number): string | null;
  isIgnoredGraphEdge(fromAreaId: string, toAreaId: string): boolean;
  getCampaignQuestGroups(act?: number): readonly CampaignQuestGroupDefinition[];
  getOptionalDetourAreaIds(): ReadonlySet<string>;
  getLabTrials(): LabTrialMeta[];
  getIzaroMechanics(): IzaroMechanicGuide[];
  getBossElementalWarnings(act: number): BossElementalWarning[];
  getCampaignStageCount(): number;
  getActDisplayLabel(act: number, locale?: "en" | "pt-BR"): string;
  getDefaultStartAreaId(): string;
  getPermanentCampaignBonuses(): readonly Poe2PermanentBonusReward[];
  getZoneLandmarkHints(areaId: string): Poe2ZoneLandmarkHint | null;
  getRuneSocketHints(): readonly Poe2RuneSocketSuggestion[];
  getLeagueStarterFilterMeta(): LeagueStarterFilterMetadata;
}
