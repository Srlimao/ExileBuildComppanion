import areasJson from "../data/poe2/areas.json" with { type: "json" };
import defaultRoutesJson from "../data/poe2/default_routes.json" with { type: "json" };
import gemAliasesJson from "../data/poe2/gem_aliases.json" with { type: "json" };
import gemsJson from "../data/poe2/gems.json" with { type: "json" };
import leagueStarterFilterMetaJson from "../data/poe2/league_starter_filter_meta.json" with { type: "json" };
import permanentBonusesJson from "../data/poe2/permanent_bonuses.json" with { type: "json" };
import runeSocketHintsJson from "../data/poe2/rune_socket_hints.json" with { type: "json" };
import twinkGearCatalogJson from "../data/poe2/twink_gear_catalog.json" with { type: "json" };
import zoneLandmarksJson from "../data/poe2/zone_landmarks.json" with { type: "json" };
import type {
  AreaDefinition,
  BossElementalWarning,
  GemDefinition,
  LabTrialMeta,
  LeagueStarterFilterMetadata,
  PassiveTreeGraphMetadata,
  Poe2PermanentBonusReward,
  Poe2RuneSocketSuggestion,
  Poe2ZoneLandmarkHint,
  TwinkCatalogItem,
} from "./game_adapter_contract.js";

export const poe2Areas = areasJson as Record<string, AreaDefinition>;
export const poe2Gems = gemsJson as Record<string, GemDefinition>;
export const poe2GemAliases = gemAliasesJson as Record<string, string>;
export const poe2DefaultRoutes = defaultRoutesJson as Record<string, string>;
export const poe2PermanentBonuses = permanentBonusesJson as readonly Poe2PermanentBonusReward[];
export const poe2ZoneLandmarks = zoneLandmarksJson as Record<string, Poe2ZoneLandmarkHint>;
export const poe2RuneSocketHints = runeSocketHintsJson as readonly Poe2RuneSocketSuggestion[];
export const poe2TwinkGearCatalog = twinkGearCatalogJson as TwinkCatalogItem[];
export const poe2LeagueStarterFilterMeta = leagueStarterFilterMetaJson as LeagueStarterFilterMetadata;

export const POE2_EMPTY_GRAPH_META: PassiveTreeGraphMetadata = {
  version: "poe2-0.4",
  minX: -1000,
  minY: -1000,
  maxX: 1000,
  maxY: 1000,
  orbitRadii: [0],
  skillsPerOrbit: [1],
  classes: [],
  groups: {},
};

export const POE2_ACT_ENTRY_AREA_BY_ACT: Readonly<Record<number, string>> = {
  1: "G1_1",
  2: "G2_1",
  3: "G3_1",
  4: "G4_town",
  5: "P1_Town",
  6: "P2_Town",
  7: "P3_Town",
  8: "G_Endgame_Town",
};

export const POE2_ACT_FINAL_AREA_BY_ACT: Readonly<Record<number, string>> = {
  1: "G1_15",
  2: "G2_12",
  3: "G3_17",
  4: "G4_11_2",
  5: "P1_6",
  6: "P2_7",
  7: "P3_7",
};

export const POE2_OPTIONAL_DETOUR_AREA_IDS: ReadonlySet<string> = new Set([
  "G1_3",
  "G1_10",
  "G3_4",
  "G3_9",
  "G4_2_1",
  "G4_2_2",
  "G4_7",
  "G4_13",
  "G4_14",
]);

export const POE2_TRIALS: LabTrialMeta[] = [
  {
    difficulty: "normal",
    areaId: "G2_13",
    areaName: "Trial of the Sekhemas (1st Asc)",
    act: 2,
    hint: "Drops from Balbala in Traitor's Passage — Honour run (Floor 1)",
  },
  {
    difficulty: "cruel",
    areaId: "G3_10_Airlock",
    areaName: "Trial of Chaos (2nd Asc)",
    act: 3,
    hint: "Chimeral Ultimatum in Chimeral Wetlands — 4-room Chaos trial",
  },
  {
    difficulty: "merciless",
    areaId: "Sanctum_2",
    areaName: "Sekhemas Floor 3 / Chaos 7-Room (3rd Asc)",
    act: 5,
    hint: "Lv 60+ Djinn Barya (3 Trials) or 7-room Inscribed Ultimatum",
  },
  {
    difficulty: "eternal",
    areaId: "G3_10",
    areaName: "Pinnacle Trial Floor 4 / Trialmaster (4th Asc)",
    act: 7,
    hint: "Lv 75+ Djinn Barya (4 Floors) or 10-room Ultimatum + Fates",
  },
];

export const POE2_BOSS_WARNINGS: BossElementalWarning[] = [
  {
    act: 1,
    areaId: "G1_15",
    bossName: "Count Geonor",
    recommendedFire: 15,
    recommendedCold: 50,
    recommendedLightning: 15,
    recommendedChaos: 0,
    warningText: "Heavy Cold slams & wolf mist dashes — grab +10% Cold Res from Beira first",
  },
  {
    act: 2,
    areaId: "G2_12",
    bossName: "Jamanra, the Abomination",
    recommendedFire: 30,
    recommendedCold: 20,
    recommendedLightning: 50,
    recommendedChaos: 0,
    warningText: "Heavy Lightning & Fire spears — get +10% Light Res at Spires of Deshar",
  },
  {
    act: 3,
    areaId: "G3_17",
    bossName: "Doryani, Royal Thaumaturge",
    recommendedFire: 45,
    recommendedCold: 45,
    recommendedLightning: 45,
    recommendedChaos: 0,
    warningText: "Rotating tri-elemental beams — kill Blackjaw (+10% Fire Res) first",
  },
  {
    act: 4,
    areaId: "G4_11_2",
    bossName: "Tavakai, the Chieftain",
    recommendedFire: 60,
    recommendedCold: 40,
    recommendedLightning: 40,
    recommendedChaos: 0,
    warningText: "Heavy Fire & Physical slams (-30% res penalty active) — complete Halls of the Dead",
  },
  {
    act: 7,
    areaId: "P3_7",
    bossName: "Zelina & Zolin",
    recommendedFire: 65,
    recommendedCold: 55,
    recommendedLightning: 65,
    recommendedChaos: 10,
    warningText: "Interlude finale (-50% res penalty) — socket Elemental Runes before Vault",
  },
];
