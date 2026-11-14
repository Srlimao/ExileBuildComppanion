import type { QuestDefinition } from "./game_adapter_contract.js";

/** Quests that grant passive refund points (Orb of Regret / Bandit Respec) rather than passive skill points. */
export const POE1_RESPEC_ONLY_QUEST_IDS: ReadonlySet<string> = new Set([
  "a1q8",
  "a6q4",
  "a9q4",
  "a10q4",
  "bandit_respec",
]);

/** First campaign area entered upon starting each PoE1 Act (1..11). */
export const POE1_ACT_ENTRY_AREA_BY_ACT: Readonly<Record<number, string>> = {
  1: "1_1_1",
  2: "1_2_1",
  3: "1_3_1",
  4: "1_4_1",
  5: "1_5_1",
  6: "2_6_town",
  7: "2_7_town",
  8: "2_8_1",
  9: "2_9_1",
  10: "2_10_town",
  11: "2_11_endgame_town",
};

/** Final boss/progression area at the end of each PoE1 Act (1..10). */
export const POE1_ACT_FINAL_AREA_BY_ACT: Readonly<Record<number, string>> = {
  1: "1_1_11_2",
  2: "1_2_14_3",
  3: "1_3_18_2",
  4: "1_4_7",
  5: "1_5_8",
  6: "2_6_15",
  7: "2_7_12_2",
  8: "2_8_13",
  9: "2_9_10_2",
  10: "2_10_6",
  11: "2_11_endgame_town",
};

/** Directed return-portal edges in `areas.json` that bypass campaign progression if traversed in dominator BFS. */
export const POE1_IGNORED_GRAPH_EDGES: ReadonlySet<string> = new Set([
  "2_10_town->2_10_6",
  "1_4_town->1_4_6_3",
]);

const POE1_QUEST_PREREQUISITES: Readonly<Record<string, readonly string[]>> = {
  a1q1: ["1_1_1"],
  a1q2: ["1_1_7_2"],
  "a1q2:a1q2b": ["1_1_7_1"],
  a1q3: ["1_1_11_1"],
  a1q4: ["1_1_3"],
  a1q5: ["1_1_2a"],
  a1q6: ["1_1_9a"],
  a1q7: ["1_1_4_0"],
  a1q9: ["1_2_9"],
  a2q4: ["1_2_10"],
  a2q5: ["1_2_5_2"],
  a2q6: ["1_2_6_2"],
  a2q7: ["1_2_4", "1_2_9", "1_2_12"],
  a2q10: ["1_2_2a"],
  a3q1: ["1_3_3_1"],
  a3q4: ["1_3_7"],
  a3q5: ["1_3_9"],
  a3q8: ["1_3_13"],
  a3q9: ["1_3_14_2"],
  a3q11: ["1_3_10_1"],
  a3q12: ["1_3_17_2"],
  a4q1: ["1_4_6_3"],
  a4q2: ["1_4_2"],
  a4q5: ["1_4_6_3"],
  a4q6: ["1_4_3_2"],
  a5q1b: ["1_5_1"],
  a5q2: ["1_5_2"],
  a5q3: ["1_5_2"],
  a5q4: ["1_5_5"],
  a5q7: ["1_5_7"],
  a6q2: ["2_6_7_2"],
  a6q3: ["2_6_5"],
  a6q4: ["2_6_1"],
  a6q6: ["2_6_11"],
  a6q7: ["2_6_8"],
  a7q1: ["2_7_7"],
  a7q2: ["2_7_5_map"],
  a7q3: ["2_7_5_map"],
  a7q5: ["2_7_1"],
  a7q6: ["2_7_10"],
  a7q7: ["2_7_9"],
  a7q9: ["2_7_9"],
  a8q1: ["2_8_2_2"],
  a8q4: ["2_8_4"],
  a8q6: ["2_8_8"],
  a8q7: ["2_8_9"],
  a9q2: ["2_9_8"],
  a9q3: ["2_9_3"],
  a9q5: ["2_9_4"],
  "a9q5:a9q5_offer": ["2_9_6"],
  a10q1: ["2_10_1"],
  a10q2: ["2_10_4"],
  a10q3: ["2_10_6"],
  a10q6: ["2_10_7"],
};

function isPassiveSkillBookItemId(itemId: string): boolean {
  return itemId.includes("SkillBooks") || /^Metadata\/Items\/QuestItems\/Act\d+\/Book-/.test(itemId);
}

/** Returns true when a quest (or specific reward offers) grants passive skill points rather than respec points or normal items. */
export function isPoe1PassiveSkillBookOffer(
  quests: Readonly<Record<string, QuestDefinition>>,
  questId: string,
  offerIds?: readonly string[],
): boolean {
  if (POE1_RESPEC_ONLY_QUEST_IDS.has(questId)) return false;
  if (questId === "a2q7") return true;
  const quest = quests[questId];
  if (!quest) return false;
  const offers =
    offerIds && offerIds.length > 0
      ? offerIds.map((offerId) => quest.reward_offers[offerId]).filter((o) => Boolean(o))
      : Object.values(quest.reward_offers);
  return offers.some((offer) => offer && Object.keys(offer.quest).some(isPassiveSkillBookItemId));
}

/** Computes all quest IDs in `quests.json` capable of granting passive skill points. */
export function computePoe1SkillBookQuestIds(quests: Readonly<Record<string, QuestDefinition>>): Set<string> {
  const ids = new Set<string>();
  for (const quest of Object.values(quests)) {
    if (isPoe1PassiveSkillBookOffer(quests, quest.id)) {
      ids.add(quest.id);
    }
  }
  return ids;
}

/** Resolves prerequisite combat area IDs required before handing in `questId` (optionally scoped by reward offer). */
export function getPoe1QuestPrerequisiteAreaIds(questId: string, offerIds?: readonly string[]): string[] {
  if (offerIds && offerIds.length > 0) {
    const combined: string[] = [];
    const seen = new Set<string>();
    let matchedOffer = false;
    for (const offerId of offerIds) {
      const scoped = POE1_QUEST_PREREQUISITES[`${questId}:${offerId}`];
      if (!scoped) continue;
      matchedOffer = true;
      for (const areaId of scoped) {
        if (!seen.has(areaId)) {
          seen.add(areaId);
          combined.push(areaId);
        }
      }
    }
    if (matchedOffer) return combined;
  }
  const fallback = POE1_QUEST_PREREQUISITES[questId];
  return fallback ? [...fallback] : [];
}
