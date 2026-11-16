import type {
  AreaDefinition,
  BossElementalWarning,
  CraftingBenchRecipe,
  GameAdapter,
  IzaroMechanicGuide,
  LabTrialMeta,
  TwinkCatalogItem,
} from "./game_adapter_contract.js";
import {
  poe1Areas,
  poe1AwakenedGemLookup,
  poe1Characters,
  poe1CraftingBenchRecipes,
  poe1DefaultRoutes,
  poe1Gems,
  poe1KillWaypoints,
  poe1PassiveTreeGraphMeta,
  poe1PassiveTreeNodes,
  poe1Quests,
  poe1TwinkGearCatalog,
  poe1UniqueItemIcons,
  poe1VaalGemLookup,
  poe1ZoneLayoutManifest,
} from "./poe1_static_dataset_loader.js";
import {
  computePoe1SkillBookQuestIds,
  getPoe1QuestPrerequisiteAreaIds,
  isPoe1PassiveSkillBookOffer,
  POE1_ACT_ENTRY_AREA_BY_ACT,
  POE1_ACT_FINAL_AREA_BY_ACT,
  POE1_IGNORED_GRAPH_EDGES,
} from "./poe1_quest_and_route_metadata.js";

const LAB_TRIALS: LabTrialMeta[] = [
  { difficulty: "normal", areaId: "1_1_7_1", areaName: "The Lower Prison", act: 1, hint: "Sawblades & Spike Traps" },
  { difficulty: "normal", areaId: "1_2_5_1", areaName: "The Crypt Level 1", act: 2, hint: "Spinning Blades" },
  { difficulty: "normal", areaId: "1_2_6_2", areaName: "The Chamber of Sins Level 2", act: 2, hint: "Wall Darts & Spikes" },
  { difficulty: "normal", areaId: "1_3_3_1", areaName: "The Crematorium", act: 3, hint: "Furnace Tiles & Sawblades" },
  { difficulty: "normal", areaId: "1_3_6", areaName: "The Catacombs", act: 3, hint: "Poison Darts & Lava" },
  { difficulty: "normal", areaId: "1_3_15", areaName: "The Imperial Gardens", act: 3, hint: "Rotating Pillars & Darts" },
  { difficulty: "cruel", areaId: "2_6_7_1", areaName: "The Lower Prison", act: 6, hint: "Spike & Sawblade Gauntlet" },
  { difficulty: "cruel", areaId: "2_7_4", areaName: "The Crypt", act: 7, hint: "Room-Wide Sentinel Traps" },
  { difficulty: "cruel", areaId: "2_7_5_2", areaName: "The Chamber of Sins Level 2", act: 7, hint: "Sawblades + Lever Maze" },
  { difficulty: "merciless", areaId: "2_8_5", areaName: "The Bath House", act: 8, hint: "Furnace + Spinning Saws" },
  { difficulty: "merciless", areaId: "2_9_7", areaName: "The Tunnel", act: 9, hint: "Lava Floors & Spikes" },
  { difficulty: "merciless", areaId: "2_10_9", areaName: "The Ossuary", act: 10, hint: "Dart Corridors + Saws" },
];

const IZARO_MECHANICS: IzaroMechanicGuide[] = [
  { phase: "Charges", hazard: "Charges stack massive dmg/speed on Izaro", counterplay: "Click Charge Disruptors before Izaro hits 10 stacks" },
  { phase: "Gargoyles", hazard: "Stone Gargoyles buff Izaro damage & armor", counterplay: "Kill all 3 Gargoyles before bursting Izaro" },
  { phase: "Conduits", hazard: "Elemental Conduits grant Fire/Cold/Light dmg", counterplay: "Destroy Conduits immediately as they activate" },
  { phase: "Fonts", hazard: "Curses apply Temp Chains / Enfeeble / Vuln", counterplay: "Destroy Fonts or keep Anti-Curse flask ready" },
  { phase: "Portals", hazard: "Summons Skeletons & Necromancer buffs", counterplay: "Kill portals quickly to prevent Phase 3 carry-over" },
  { phase: "Idols", hazard: "Elemental statues pulse AoE explosions", counterplay: "Do not let Izaro stay near active Idols or burst him fast" },
];

const BOSS_WARNINGS: BossElementalWarning[] = [
  { act: 1, areaId: "1_1_11_2", bossName: "Merveil, the Siren", recommendedFire: 15, recommendedCold: 50, recommendedLightning: 10, recommendedChaos: 0, warningText: "Heavy Cold projectiles & chilled ground — Sapphire Ring recommended" },
  { act: 2, areaId: "1_2_9", bossName: "The Vaal Oversoul", recommendedFire: 35, recommendedCold: 20, recommendedLightning: 50, recommendedChaos: 0, warningText: "Lightning beam & physical slam — Topaz Ring recommended" },
  { act: 3, areaId: "1_3_18_2", bossName: "Dominus, High Templar", recommendedFire: 40, recommendedCold: 40, recommendedLightning: 65, recommendedChaos: 0, warningText: "Touch of God Lightning slam & Blood Rain bleed" },
  { act: 4, areaId: "1_4_6_3", bossName: "Malachai, The Nightmare", recommendedFire: 65, recommendedCold: 55, recommendedLightning: 55, recommendedChaos: 0, warningText: "High Fire/Physical arena traps & slams" },
  { act: 5, areaId: "1_5_8", bossName: "Kitava, the Insatiable", recommendedFire: 75, recommendedCold: 65, recommendedLightning: 65, recommendedChaos: 0, warningText: "Triggers -30% All Resistances immediately upon completion" },
  { act: 6, areaId: "2_6_15", bossName: "Tsoagoth, The Brine King", recommendedFire: 60, recommendedCold: 75, recommendedLightning: 75, recommendedChaos: 0, warningText: "Post-Kitava Cold & Lightning bursts — aim for 75% after -30%" },
  { act: 8, areaId: "2_8_14", bossName: "Solaris & Lunaris", recommendedFire: 75, recommendedCold: 75, recommendedLightning: 65, recommendedChaos: 0, warningText: "Heavy Fire & Cold beams; avoid crossing ground orbs" },
  { act: 10, areaId: "2_10_2", bossName: "Kitava (Act 10)", recommendedFire: 75, recommendedCold: 75, recommendedLightning: 75, recommendedChaos: 0, warningText: "Triggers final -60% All Resistances penalty for mapping" },
];

const POE_CDN_2DITEMS_BASE = "https://web.poecdn.com/image/Art/2DItems/";

const TWINK_ICON_BY_LOWER_NAME = new Map(
  poe1TwinkGearCatalog.map((item) => [item.itemName.trim().toLowerCase(), item.iconPath]),
);

const SKILL_BOOK_IDS = computePoe1SkillBookQuestIds(poe1Quests);
const AREAS_BY_LOWER_NAME = (() => {
  const map = new Map<string, AreaDefinition[]>();
  for (const area of Object.values(poe1Areas)) {
    const key = area.name.trim().toLowerCase();
    const list = map.get(key) ?? [];
    list.push(area);
    map.set(key, list);
  }
  return map;
})();

export class Poe1CampaignGameAdapter implements GameAdapter {
  readonly gameId = "poe1" as const;

  getAreas() {
    return poe1Areas;
  }

  getGems() {
    return poe1Gems;
  }

  getQuests() {
    return poe1Quests;
  }

  getCharacters() {
    return poe1Characters;
  }

  getKillWaypoints() {
    return poe1KillWaypoints;
  }

  getAwakenedGemLookup() {
    return poe1AwakenedGemLookup;
  }

  getVaalGemLookup() {
    return poe1VaalGemLookup;
  }

  getDefaultRouteFiles() {
    return poe1DefaultRoutes;
  }

  getZoneLayoutVariants(areaId: string): string[] {
    return poe1ZoneLayoutManifest[areaId] ?? [];
  }

  getPassiveTreeNodes() {
    return poe1PassiveTreeNodes;
  }

  getPassiveTreeGraphMeta() {
    return poe1PassiveTreeGraphMeta;
  }

  getCraftingBenchRecipes(): CraftingBenchRecipe[] {
    return poe1CraftingBenchRecipes;
  }

  getTwinkGearCatalog(): TwinkCatalogItem[] {
    return poe1TwinkGearCatalog;
  }

  resolveOfficialUniqueIconUrl(itemName: string): string | null {
    const key = itemName.trim().toLowerCase();
    if (!key) return null;
    const localPath = TWINK_ICON_BY_LOWER_NAME.get(key);
    if (localPath) return localPath;
    const suffix = poe1UniqueItemIcons[key];
    return suffix ? `${POE_CDN_2DITEMS_BASE}${suffix}` : null;
  }

  resolveAreaById(areaId: string): AreaDefinition | null {
    return poe1Areas[areaId] ?? null;
  }

  resolveAreasByName(localizedName: string): AreaDefinition[] {
    return AREAS_BY_LOWER_NAME.get(localizedName.trim().toLowerCase()) ?? [];
  }

  getResistancePenaltyForAct(highestUnlockedAct: number, completedBossFlags: string[]): number {
    if (highestUnlockedAct >= 11 || completedBossFlags.includes("kitava_act10")) return -60;
    if (highestUnlockedAct >= 6 || completedBossFlags.includes("kitava_act5")) return -30;
    return 0;
  }

  getSkillBookQuestIds(): ReadonlySet<string> {
    return SKILL_BOOK_IDS;
  }

  isSkillBookQuestOffer(questId: string, offerIds?: readonly string[]): boolean {
    return isPoe1PassiveSkillBookOffer(poe1Quests, questId, offerIds);
  }

  getQuestPrerequisiteAreaIds(questId: string, offerIds?: readonly string[]): string[] {
    return getPoe1QuestPrerequisiteAreaIds(questId, offerIds);
  }

  getActEntryAreaId(act: number): string | null {
    return POE1_ACT_ENTRY_AREA_BY_ACT[act] ?? null;
  }

  getActFinalAreaId(act: number): string | null {
    return POE1_ACT_FINAL_AREA_BY_ACT[act] ?? null;
  }

  isIgnoredGraphEdge(fromAreaId: string, toAreaId: string): boolean {
    return POE1_IGNORED_GRAPH_EDGES.has(`${fromAreaId}->${toAreaId}`);
  }

  getLabTrials(): LabTrialMeta[] {
    return LAB_TRIALS;
  }

  getIzaroMechanics(): IzaroMechanicGuide[] {
    return IZARO_MECHANICS;
  }

  getBossElementalWarnings(act: number): BossElementalWarning[] {
    return BOSS_WARNINGS.filter((w) => w.act === act);
  }
}

export const poe1GameAdapter = new Poe1CampaignGameAdapter();
