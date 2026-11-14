export type SupportedGameId = "poe1" | "poe2";

export interface AreaDefinition {
  id: string;
  name: string;
  map_name: string | null;
  act: number;
  level: number;
  has_waypoint: boolean;
  is_town_area: boolean;
  parent_town_area_id: string | null;
  connection_ids: string[];
  crafting_recipes: string[];
}

export interface GemDefinition {
  id: string;
  name: string;
  primary_attribute: "strength" | "dexterity" | "intelligence" | "none" | string;
  required_level: number;
  is_support: boolean;
}

export interface QuestRewardOfferEntry {
  classes: string[];
}

export interface VendorRewardOfferEntry {
  classes: string[];
  npc: string;
}

export interface QuestRewardOffer {
  quest_npc: string;
  quest: Record<string, QuestRewardOfferEntry | undefined>;
  vendor: Record<string, VendorRewardOfferEntry | undefined>;
}

export interface QuestDefinition {
  id: string;
  name: string;
  act: string;
  reward_offers: Record<string, QuestRewardOffer | undefined>;
}

export interface CharacterStartGems {
  start_gem_id: string;
  chest_gem_id: string;
}

export interface PassiveTreeMasteryEffect {
  effectId: string;
  stats: string[];
}

export interface PassiveTreeNodeMetadata {
  id: string;
  name: string;
  isNotable: boolean;
  isKeystone: boolean;
  isMastery: boolean;
  stats: string[];
  x: number;
  y: number;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  isBlighted?: boolean;
  ascendancyName?: string;
  classStartIndex?: number;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  out?: string[];
  masteryEffects?: PassiveTreeMasteryEffect[];
}

export interface PassiveTreeClassMeta {
  classIndex: number;
  name: string;
  startNodeId: string;
  ascendancies: string[];
}

export interface PassiveTreeGroupMeta {
  x: number;
  y: number;
  orbits: number[];
}

export interface PassiveTreeGraphMetadata {
  version: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  orbitRadii: number[];
  skillsPerOrbit: number[];
  classes: PassiveTreeClassMeta[];
  groups: Record<string, PassiveTreeGroupMeta>;
}

export interface BossElementalWarning {
  act: number;
  areaId: string;
  bossName: string;
  recommendedFire: number;
  recommendedCold: number;
  recommendedLightning: number;
  recommendedChaos: number;
  warningText: string;
}

export interface LabTrialMeta {
  difficulty: "normal" | "cruel" | "merciless" | "eternal";
  areaId: string;
  areaName: string;
  act: number;
  hint: string;
}

export interface IzaroMechanicGuide {
  phase: string;
  hazard: string;
  counterplay: string;
}

export interface GameAdapter {
  readonly gameId: SupportedGameId;
  getAreas(): Record<string, AreaDefinition>;
  getGems(): Record<string, GemDefinition>;
  getQuests(): Record<string, QuestDefinition>;
  getCharacters(): Record<string, CharacterStartGems>;
  getKillWaypoints(): Record<string, string[]>;
  getAwakenedGemLookup(): Record<string, string>;
  getVaalGemLookup(): Record<string, string>;
  getDefaultRouteFiles(): Record<string, string>;
  getZoneLayoutVariants(areaId: string): string[];
  getPassiveTreeNodes(): Record<string, PassiveTreeNodeMetadata>;
  getPassiveTreeGraphMeta(): PassiveTreeGraphMetadata;
  resolveAreaById(areaId: string): AreaDefinition | null;
  resolveAreasByName(localizedName: string): AreaDefinition[];
  getResistancePenaltyForAct(highestUnlockedAct: number, completedBossFlags: string[]): number;
  getSkillBookQuestIds(): ReadonlySet<string>;
  isSkillBookQuestOffer(questId: string, offerIds?: readonly string[]): boolean;
  getQuestPrerequisiteAreaIds(questId: string, offerIds?: readonly string[]): string[];
  getActEntryAreaId(act: number): string | null;
  getActFinalAreaId(act: number): string | null;
  isIgnoredGraphEdge(fromAreaId: string, toAreaId: string): boolean;
  getLabTrials(): LabTrialMeta[];
  getIzaroMechanics(): IzaroMechanicGuide[];
  getBossElementalWarnings(act: number): BossElementalWarning[];
}
