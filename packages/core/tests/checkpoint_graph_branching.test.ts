import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  applySavedCampaignProgress,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "../src/index.js";

function createCampaignSnapshot(): HudSessionSnapshot {
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: true });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const build = validateAndEnrichPobBuild(
    {
      buildName: "BranchTest",
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      bandit: "None",
      buildLevel: 1,
      skillSets: [],
      treeSpecs: [],
      itemSets: [],
      uniqueRequiredGems: [],
    },
    poe1GameAdapter,
  );
  return {
    ...buildInitialSessionSnapshot({
      roomId: "TEST",
      profileId: "p1",
      build,
      checkpoints,
      gemSteps: [],
      adapter: poe1GameAdapter,
    }),
    poeRunning: true,
  };
}

function stepZones(start: HudSessionSnapshot, areaIds: string[]): HudSessionSnapshot {
  return areaIds.reduce(
    (acc, areaId) =>
      reduceTelemetrySession(
        acc,
        {
          type: "client_log",
          event: { type: "area_generated", areaId, areaLevel: 10, areaSeed: `seed_${areaId}` },
          autoDetectCharacter: false,
        },
        poe1GameAdapter,
      ),
    start,
  );
}

describe("checkpoint_graph branching & dominator progression", () => {
  it("classifies Act 4-10 Book-a* & a2q7 as SKILL_BOOK while excluding respec quests and a9q5_offer", () => {
    const snap = createCampaignSnapshot();
    const byQuest = (qId: string) => snap.checkpoints.filter((cp) => cp.questId === qId);

    for (const qId of ["a2q7", "a4q6", "a5q3", "a5q7", "a6q3", "a6q6", "a6q7", "a7q1", "a7q6", "a7q9", "a8q4", "a8q6", "a8q7", "a9q2", "a10q3", "a10q6"]) {
      expect(byQuest(qId).some((cp) => cp.category === "SKILL_BOOK"), qId).toBe(true);
    }
    for (const respecId of ["a1q8", "a2q5", "a6q4", "a9q4", "a10q4", "bandit_respec"]) {
      expect(poe1GameAdapter.isSkillBookQuestOffer(respecId)).toBe(false);
    }
    expect(poe1GameAdapter.getSkillBookQuestIds().has("a2q5")).toBe(false);
    expect(poe1GameAdapter.getSkillBookQuestIds().has("a6q4")).toBe(false);

    const a9q5Steps = byQuest("a9q5");
    expect(a9q5Steps.map((s) => s.category)).toEqual(["MANDATORY_PATH", "SKILL_BOOK"]);
  });

  it("does not complete skipped Act 1 side branches and targets visited SKILL_BOOK on skill_points_received", () => {
    let snap = stepZones(createCampaignSnapshot(), ["1_1_town", "1_1_2", "1_1_3", "1_1_4_1", "1_1_5", "1_1_8", "1_1_9", "1_1_9a", "1_1_9", "1_1_11_1", "1_1_town"]);
    const a1q5 = snap.checkpoints.find((cp) => cp.questId === "a1q5")!;
    const a1q7 = snap.checkpoints.find((cp) => cp.questId === "a1q7")!;
    const a1q6 = snap.checkpoints.find((cp) => cp.questId === "a1q6")!;
    const floodDepths = snap.checkpoints.find((cp) => cp.areaId === "1_1_4_0")!;
    const tidal = snap.checkpoints.find((cp) => cp.areaId === "1_1_2a")!;
    const boatReentry = snap.checkpoints.find((cp) => cp.areaId === "1_1_4_1" && cp.prerequisiteAreaIds?.includes("1_1_4_0"))!;

    expect(tidal.completed).toBe(false);
    expect(floodDepths.completed).toBe(false);
    expect(boatReentry.completed).toBe(false);
    expect(a1q5.completed).toBe(false);
    expect(a1q7.completed).toBe(false);

    snap = reduceTelemetrySession(
      snap,
      { type: "client_log", event: { type: "skill_points_received", count: 1 }, autoDetectCharacter: false },
      poe1GameAdapter,
    );
    expect(snap.checkpoints.find((cp) => cp.id === a1q6.id)!.completed).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.id === a1q7.id)!.completed).toBe(false);
  });

  it("keeps unvisited Act 2 parallel branches pending when progressing down East branch first", () => {
    const snap = stepZones(createCampaignSnapshot(), ["1_2_1", "1_2_town", "1_2_7", "1_2_12", "1_2_11", "1_2_8"]);
    for (const unvisitedArea of ["1_2_3", "1_2_4", "1_2_6_1", "1_2_6_2", "1_2_5_1", "1_2_5_2", "1_2_9", "1_2_10"]) {
      expect(snap.checkpoints.some((cp) => cp.areaId === unvisitedArea && cp.completed), unvisitedArea).toBe(false);
    }
    expect(snap.checkpoints.some((cp) => cp.areaId === "1_2_7" && cp.completed)).toBe(true);
    expect(snap.checkpoints.some((cp) => cp.areaId === "1_2_12" && cp.completed)).toBe(true);
  });

  it("gates Act 3 Sewers Undying Blockage on Solaris 2 and preserves Act 4/Lab visit blocks", () => {
    const act3 = stepZones(createCampaignSnapshot(), ["1_3_1", "1_3_town", "1_3_2", "1_3_10_1", "1_3_5"]);
    const blockage = act3.checkpoints.find((cp) => cp.areaId === "1_3_10_1" && /Undying Blockage/i.test(cp.title))!;
    expect(blockage.completed).toBe(false);

    const act4 = stepZones(createCampaignSnapshot(), ["1_4_1", "1_4_town", "1_3_town", "Labyrinth_Airlock", "1_4_3_1", "1_4_3_2", "1_4_3_3", "1_4_5_1", "1_4_5_2", "1_4_3_3", "1_4_4_1", "1_4_4_3"]);
    const grandArenaSteps = act4.checkpoints.filter((cp) => cp.areaId === "1_4_5_2");
    expect(grandArenaSteps[0]!.completed).toBe(true);
    expect(grandArenaSteps.some((cp) => /Daresso/i.test(cp.title) && cp.completed)).toBe(false);

    const normalAscend = act4.checkpoints.find((cp) => cp.sectionAct === 4 && cp.stepKind === "ascend")!;
    expect(normalAscend.completed).toBe(false);

    const afterLab = stepZones(act4, ["1_Labyrinth_boss_3", "Labyrinth_Airlock"]);
    expect(afterLab.checkpoints.find((cp) => cp.id === normalAscend.id)!.completed).toBe(true);
  });

  it("handles Act 7/8/10 non-linear paths without false completions", () => {
    const act7 = stepZones(createCampaignSnapshot(), ["2_7_town", "2_7_1", "2_7_2", "2_7_5_1", "2_7_5_2", "2_7_6", "2_7_7", "2_7_8", "2_7_10", "2_7_11"]);
    expect(act7.checkpoints.some((cp) => cp.areaId === "2_7_4" && cp.completed)).toBe(false);
    expect(act7.checkpoints.some((cp) => cp.areaId === "2_7_9" && cp.completed)).toBe(false);

    const act8 = stepZones(createCampaignSnapshot(), ["2_8_1", "2_8_town", "2_8_2_1", "2_8_2_2", "2_8_8", "2_8_9", "2_8_10", "2_8_12_1", "2_8_11", "2_8_13", "2_8_6"]);
    expect(act8.checkpoints.some((cp) => cp.areaId === "2_8_13" && /Sky Shrine|Lunaris/i.test(cp.title) && cp.completed)).toBe(false);
    expect(act8.checkpoints.some((cp) => cp.areaId === "2_8_4" && cp.completed)).toBe(false);

    const act10 = stepZones(createCampaignSnapshot(), ["2_10_town", "2_10_1", "2_10_2", "2_10_7", "2_10_2"]);
    expect(act10.checkpoints.some((cp) => cp.areaId === "2_10_6" && cp.completed)).toBe(false);
    expect(act10.checkpoints.find((cp) => cp.areaId === "2_10_2" && /Innocence/i.test(cp.title))!.completed).toBe(false);
  });

  it("does not mark zone cleared or softCompleted on player_slain death respawn and migrates saved MANDATORY_PATH -> SKILL_BOOK", () => {
    let snap = stepZones(createCampaignSnapshot(), ["1_1_town", "1_1_2", "1_1_2a"]);
    snap = reduceTelemetrySession(
      snap,
      { type: "client_log", event: { type: "player_slain", characterName: "Hero" }, autoDetectCharacter: false },
      poe1GameAdapter,
    );
    snap = stepZones(snap, ["1_1_town", "1_1_7_1"]);
    expect(snap.clearedAreaIds).not.toContain("1_1_2a");
    expect(snap.checkpoints.find((cp) => cp.areaId === "1_1_2a")!.completed).toBe(false);

    snap = reduceTelemetrySession(
      snap,
      { type: "client_log", event: { type: "player_slain", characterName: "Hero" }, autoDetectCharacter: false },
      poe1GameAdapter,
    );
    snap = stepZones(snap, ["1_1_town"]);
    expect(snap.checkpoints.find((cp) => cp.areaId === "1_1_7_1" && cp.category === "LAB_TRIAL")!.softCompleted).toBe(false);

    const fresh = createCampaignSnapshot();
    const hillock = fresh.checkpoints.find((cp) => cp.areaId === "1_1_1")!;
    const a4Book = fresh.checkpoints.find((cp) => cp.questId === "a4q6")!;
    const restored = applySavedCampaignProgress(fresh, {
      completedCheckpointIds: [
        `${a4Book.sectionAct}|${a4Book.areaId}|MANDATORY_PATH|${a4Book.questId}|${a4Book.title}#1`,
        `${hillock.sectionAct}|${hillock.areaId}|${hillock.category}||${hillock.title}#1`,
      ],
      softCompletedCheckpointIds: [],
      manualCompletedGemIds: [],
      softAcquiredGemIds: [],
      wasExplicitlyReset: false,
      updatedAtMs: 123,
    });
    expect(restored.checkpoints.find((cp) => cp.questId === "a4q6")!.completed).toBe(true);
    expect(restored.clearedAreaIds).toContain("1_1_1");
  });
});
