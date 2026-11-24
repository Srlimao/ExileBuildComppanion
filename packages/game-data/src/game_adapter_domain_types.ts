export type SupportedGameId = "poe1" | "poe2";

export type Poe2GemKind = "skill" | "spirit" | "support" | "meta";

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
  gem_kind?: Poe2GemKind;
  uncut_tier?: number;
  spirit_cost?: number;
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

export type BenchCraftCategory =
  | "fire_res"
  | "cold_res"
  | "lightning_res"
  | "chaos_res"
  | "fire_cold_res"
  | "cold_lightning_res"
  | "fire_lightning_res"
  | "all_ele_res"
  | "movement_speed"
  | "life"
  | "strength"
  | "dexterity"
  | "intelligence"
  | "all_attributes";

export type BenchEquipSlot =
  | "Helm"
  | "BodyArmour"
  | "Gloves"
  | "Boots"
  | "Belt"
  | "Amulet"
  | "Ring"
  | "Ring2"
  | "Offhand";

export interface CraftingBenchRecipe {
  id: string;
  category: BenchCraftCategory;
  label: string;
  modTextTemplate: string;
  affixType: "prefix" | "suffix";
  benchTier: number;
  requiredLevel: number;
  minVal: number;
  maxVal: number;
  costCurrency: string;
  costCount: number;
  costLabel: string;
  compatibleSlots: BenchEquipSlot[];
  unlockAreaId: string | null;
  unlockRecipeName: string | null;
  unlockAct: number;
}

export type LootFilterPresetId = "regular" | "semi_strict";

export interface LeagueStarterFilterPresetMeta {
  id: LootFilterPresetId;
  strictnessCode: string;
  targetFileName: string;
  lineCount: number;
  byteSize: number;
}

export interface LeagueStarterFilterMetadata {
  version: string;
  leagueName: string;
  releaseTitle: string;
  sourceRepo: string;
  defaultPresetId: LootFilterPresetId;
  presets: LeagueStarterFilterPresetMeta[];
}

export type TwinkArchetypeId = "spell" | "bow" | "melee" | "minion" | "hollow_palm";

export type TwinkEquipCategory =
  | "Body Armour"
  | "Helmet"
  | "Boots"
  | "Gloves"
  | "Belt"
  | "Amulet"
  | "Ring"
  | "Weapon"
  | "Offhand"
  | "Jewel";

export interface TwinkCatalogItem {
  id: string;
  itemName: string;
  baseType: string;
  slot: TwinkEquipCategory;
  levelReq: number;
  archetypes: Array<"universal" | TwinkArchetypeId>;
  preferredClasses?: string[];
  iconPath: string;
  summaryEn: string;
  summaryPtBr: string;
  keyMods: string[];
}

export interface CampaignQuestGroupAreaMatcher {
  areaId: string;
  minVisitIndex?: number;
  maxVisitIndex?: number;
  minGroupOrder?: number;
  maxGroupOrder?: number;
  prerequisiteAreaIds?: readonly string[];
}

export interface CampaignQuestGroupDefinition {
  id: string;
  act: number;
  order: number;
  titleEn: string;
  titlePtBr: string;
  mandatoryAreaIds: readonly string[];
  areaMatchers?: readonly CampaignQuestGroupAreaMatcher[];
}

export interface Poe2PermanentBonusReward {
  id: string;
  act: number;
  areaId: string;
  bossOrQuestName: string;
  rewardLabelEn: string;
  rewardLabelPtBr: string;
  bonusType: "spirit" | "resistance" | "life" | "weapon_set_points" | "choice" | "attribute" | "charm";
  valueSummary: string;
}

export interface Poe2ZoneLandmarkHint {
  areaId: string;
  exitDirections?: string[];
  landmarksEn: string[];
  landmarksPtBr: string[];
  bossTipEn?: string;
  bossTipPtBr?: string;
}

export interface Poe2RuneSocketSuggestion {
  id: string;
  category: "fire_res" | "cold_res" | "lightning_res" | "chaos_res" | "life" | "movement_speed" | "damage";
  runeName: string;
  slotHint: string;
  effectLabel: string;
}
