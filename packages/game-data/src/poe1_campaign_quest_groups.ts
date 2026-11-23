import type {
  CampaignQuestGroupAreaMatcher,
  CampaignQuestGroupDefinition,
} from "./game_adapter_contract.js";

/**
 * Pure optional side-detour area IDs across PoE 1 Acts 1-10.
 * Skipping these areas moves optional steps to the Cleanup Backlog and never blocks
 * advancing to the next Mandatory Quest Group.
 */
export const POE1_OPTIONAL_DETOUR_AREA_IDS: ReadonlySet<string> = new Set([
  "1_1_2a", // The Tidal Island
  "1_1_4_0", // The Flooded Depths
  "1_1_9a", // The Ship Graveyard Cave
  "1_2_2a", // The Den
  "1_2_15", // The Fellshrine Ruins
  "1_2_5_1", // The Crypt Level 1
  "1_2_5_2", // The Crypt Level 2
  "1_3_6", // The Catacombs
  "1_3_17_1", // The Library
  "1_3_17_2", // The Archives
  "1_5_7", // The Reliquary
  "2_6_1", // The Twilight Strand (Act 6)
  "2_6_11", // The Wetlands (Act 6)
  "2_8_4", // The High Gardens
  "2_8_5", // The Bath House
  "2_9_4", // The Oasis
  "2_10_7", // The Control Blocks (Act 10)
  "2_10_9", // The Ossuary (Act 10)
  "Labyrinth_Airlock", // Aspirants' Plaza
]);

function group(
  id: string,
  act: number,
  order: number,
  titleEn: string,
  titlePtBr: string,
  mandatoryAreaIds: readonly string[],
  areaMatchers?: readonly CampaignQuestGroupAreaMatcher[],
): CampaignQuestGroupDefinition {
  return areaMatchers
    ? { id, act, order, titleEn, titlePtBr, mandatoryAreaIds, areaMatchers }
    : { id, act, order, titleEn, titlePtBr, mandatoryAreaIds };
}

/**
 * Ordered story-gate quest groups for PoE 1 Acts 1-10.
 * Parallel branches within the same gate share a group so players can clear them in any order,
 * while every mandatory area in group N must be visited/cleared (or manually checked) to advance.
 */
export const POE1_CAMPAIGN_QUEST_GROUPS: readonly CampaignQuestGroupDefinition[] = [
  // Act 1
  group("a1_strand_mud", 1, 0, "Strand & Mud Flats", "Praia e Mud Flats", ["1_1_1", "1_1_2", "1_1_3"]),
  group("a1_prison_brutus", 1, 1, "Passage & Brutus", "Passagem e Brutus", ["1_1_4_1", "1_1_5", "1_1_6", "1_1_7_1", "1_1_7_2"]),
  group("a1_merveil", 1, 2, "Ship Graveyard & Merveil", "Cemitério e Merveil", ["1_1_8", "1_1_9", "1_1_11_1", "1_1_11_2"]),

  // Act 2
  group("a2_encampment", 2, 0, "Forest Encampment", "Acampamento", ["1_2_1"]),
  group("a2_gems_weaver_bandits", 2, 1, "Sins, Weaver & Bandits", "Sins, Weaver e Bandidos", [
    "1_2_2", "1_2_3", "1_2_6_1", "1_2_6_2", "1_2_7", "1_2_9", "1_2_10", "1_2_4", "1_2_12",
  ]),
  group("a2_vaal_oversoul", 2, 2, "Vaal Ruins & Oversoul", "Ruínas Vaal e Oversoul", ["1_2_11", "1_2_8", "1_2_14_2", "1_2_14_3"]),

  // Act 3
  group("a3_crematorium", 3, 0, "Crematorium & Sewer Keys", "Crematório e Chaves", ["1_3_1", "1_3_2", "1_3_3_1"]),
  group("a3_sewers_solaris_docks", 3, 1, "Sewers, Solaris & Docks", "Esgotos, Solaris e Docas", [
    "1_3_10_1", "1_3_5", "1_3_7", "1_3_8_1", "1_3_8_2", "1_3_9",
  ], [{ areaId: "1_3_10_1", maxVisitIndex: 0 }]),
  group("a3_ebony_lunaris", 3, 2, "Ebony & Lunaris", "Ebony e Lunaris", [
    "1_3_10_1", "1_3_13", "1_3_14_1", "1_3_14_2",
  ], [{ areaId: "1_3_10_1", minVisitIndex: 1, prerequisiteAreaIds: ["1_3_8_2"] }]),
  group("a3_sceptre_dominus", 3, 3, "Gardens & Dominus", "Jardins e Dominus", ["1_3_15", "1_3_18_1", "1_3_18_2"]),

  // Act 4
  group("a4_lake_mines", 4, 0, "Dried Lake & Mines", "Lago Seco e Minas", ["1_4_1", "1_4_2", "1_4_3_1", "1_4_3_2", "1_4_3_3"]),
  group("a4_dreams", 4, 1, "Kaom & Daresso Dreams", "Sonhos de Kaom e Daresso", ["1_4_5_1", "1_4_5_2", "1_4_4_1", "1_4_4_3"]),
  group("a4_belly_malachai", 4, 2, "Belly & Malachai", "Ventre e Malachai", ["1_4_6_1", "1_4_6_2", "1_4_6_3", "1_4_7"]),

  // Act 5
  group("a5_innocence", 5, 0, "Slave Pens & Innocence", "Senzalas e Innocence", ["1_5_1", "1_5_2", "1_5_3", "1_5_4", "1_5_5"]),
  group("a5_sign_of_purity", 5, 1, "Ruined Square & Ossuary", "Praça e Ossuário", ["1_5_4b", "1_5_3b", "1_5_6"]),
  group("a5_kitava", 5, 2, "Cathedral Rooftop", "Telhado (Kitava)", ["1_5_8"]),

  // Act 6
  group("a6_shavronne", 6, 0, "Coast & Shavronne", "Costa e Shavronne", ["2_6_2", "2_6_4", "2_6_5", "2_6_6", "2_6_7_1", "2_6_7_2"]),
  group("a6_beacon", 6, 1, "Prisoner's Gate & Beacon", "Portão e Farol", ["2_6_8", "2_6_9", "2_6_10", "2_6_12", "2_6_13", "2_6_14"]),
  group("a6_brine_king", 6, 2, "Brine King's Reef", "Recife do Brine King", ["2_6_15"]),

  // Act 7
  group("a7_crypt_map", 7, 0, "Crossroads & Crypt", "Encruzilhada e Cripta", ["2_7_1", "2_7_2", "2_7_3", "2_7_4"]),
  group("a7_maligaro_greust", 7, 1, "Chamber of Sins & Greust", "Sins e Greust", ["2_7_5_1", "2_7_5_map", "2_7_5_2", "2_7_6", "2_7_7"]),
  group("a7_fireflies_vaal", 7, 2, "Fireflies & Vaal City", "Vaga-lumes e Vaal City", ["2_7_8", "2_7_9", "2_7_10", "2_7_11"]),
  group("a7_arakaali", 7, 3, "Temple of Decay", "Templo (Arakaali)", ["2_7_12_1", "2_7_12_2"]),

  // Act 8
  group("a8_doedre", 8, 0, "Ramparts & Doedre", "Muralhas e Doedre", ["2_8_1", "2_8_2_1", "2_8_2_2"]),
  group("a8_sun_moon_orbs", 8, 1, "Solaris & Lunaris Orbs", "Orbes Solaris e Lunaris", [
    "2_8_8", "2_8_9", "2_8_10", "2_8_12_1", "2_8_12_2", "2_8_11", "2_8_13", "2_8_6", "2_8_7_1_", "2_8_7_2",
  ], [{ areaId: "2_8_13", maxVisitIndex: 0 }]),
  group("a8_harbour_bridge", 8, 2, "Harbour Bridge", "Ponte (Lunaris & Solaris)", [
    "2_8_13",
  ], [{ areaId: "2_8_13", minVisitIndex: 1, prerequisiteAreaIds: ["2_8_12_2", "2_8_7_2"] }]),

  // Act 9
  group("a9_boiling_lake", 9, 0, "Descent & Boiling Lake", "Descida e Lago Fervente", ["2_9_2", "2_9_3", "2_9_5", "2_9_6"]),
  group("a9_refinery", 9, 1, "Tunnel, Quarry & Refinery", "Túnel, Pedreira e Refinaria", ["2_9_7", "2_9_8", "2_9_9"]),
  group("a9_rotting_core", 9, 2, "Belly & Rotting Core", "Ventre e Núcleo", ["2_9_10_1", "2_9_10_2"]),

  // Act 10
  group("a10_rooftop_square", 10, 0, "Rooftop & Ravaged Square", "Telhado e Praça", [
    "2_10_1", "2_10_2",
  ], [{ areaId: "2_10_2", maxGroupOrder: 0 }]),
  group("a10_desecrated", 10, 1, "Desecrated Chambers", "Câmaras Profanadas", ["2_10_3", "2_10_4"]),
  group("a10_kitava", 10, 2, "Canals & Kitava", "Canais e Kitava", [
    "2_10_2", "2_10_5", "2_10_6",
  ], [{ areaId: "2_10_2", minGroupOrder: 1, prerequisiteAreaIds: ["2_10_4"] }]),
];
