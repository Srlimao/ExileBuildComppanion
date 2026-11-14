import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  parseClientLogLine,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reconcileAscendancyProgressFromPassives,
  reduceTelemetrySession,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "../src/index.js";

function createTestSnapshot(): HudSessionSnapshot {
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: true });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const build = validateAndEnrichPobBuild(
    {
      buildName: "LabAndPassivesTest",
      characterClass: "Witch",
      ascendancyName: "Elementalist",
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

function enterZone(state: HudSessionSnapshot, areaId: string): HudSessionSnapshot {
  return reduceTelemetrySession(
    state,
    {
      type: "client_log",
      event: { type: "area_generated", areaId, areaLevel: 33, areaSeed: `seed_${areaId}` },
      autoDetectCharacter: false,
    },
    poe1GameAdapter,
  );
}

describe("lab tier trial auto-completion & /passives chat sync", () => {
  it("aligns all 12 LAB_TRIALS metadata IDs with areas.json", () => {
    const trials = poe1GameAdapter.getLabTrials();
    expect(trials).toHaveLength(12);
    for (const trial of trials) {
      const area = poe1GameAdapter.resolveAreaById(trial.areaId);
      expect(area?.name, trial.areaId).toBe(trial.areaName);
      expect(area?.act, trial.areaId).toBe(trial.act);
    }
  });

  it("does not complete trials in Aspirants Plaza and auto-completes Normal trials on 1_Labyrinth entry", () => {
    const inPlaza = enterZone(createTestSnapshot(), "Labyrinth_Airlock");
    const trialSteps = (s: HudSessionSnapshot) =>
      s.checkpoints.filter((cp) => cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend");

    expect(trialSteps(inPlaza).some((cp) => cp.completed)).toBe(false);
    expect(inPlaza.lab.completedTrialAreaIds).toEqual([]);

    const inNormalLab = enterZone(inPlaza, "1_Labyrinth_P_branch");
    const normalTrials = trialSteps(inNormalLab).filter((cp) => cp.sectionAct <= 3);
    const laterTrials = trialSteps(inNormalLab).filter((cp) => cp.sectionAct > 3);

    expect(normalTrials).toHaveLength(6);
    expect(normalTrials.every((cp) => cp.completed && !cp.softCompleted)).toBe(true);
    expect(laterTrials.some((cp) => cp.completed)).toBe(false);
    expect(inNormalLab.lab.completedTrialAreaIds).toHaveLength(6);
    expect(inNormalLab.lab.difficultyLabel).toBe("Normal Labyrinth");
    expect(inNormalLab.checkpoints.find((cp) => cp.sectionAct === 4 && cp.stepKind === "ascend")!.completed).toBe(false);
  });

  it("cascades trials and prior Lab ascend steps across Cruel, Merciless, and Uber Lab (excluding map trials)", () => {
    const inMapTrial = enterZone(createTestSnapshot(), "EndGame_Labyrinth_trials_sawblades");
    expect(inMapTrial.checkpoints.some((cp) => cp.category === "LAB_TRIAL" && cp.completed)).toBe(false);

    const inCruel = enterZone(createTestSnapshot(), "2_Labyrinth_C_straight");
    expect(
      inCruel.checkpoints
        .filter((cp) => cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend" && cp.sectionAct <= 7)
        .every((cp) => cp.completed),
    ).toBe(true);
    expect(inCruel.checkpoints.find((cp) => cp.sectionAct === 4 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(inCruel.checkpoints.find((cp) => cp.sectionAct === 7 && cp.stepKind === "ascend")!.completed).toBe(false);
    expect(inCruel.lab.completedTrialAreaIds).toHaveLength(9);

    const inMerciless = enterZone(createTestSnapshot(), "3_Labyrinth_boss_1");
    expect(
      inMerciless.checkpoints
        .filter((cp) => cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend")
        .every((cp) => cp.completed),
    ).toBe(true);
    expect(inMerciless.checkpoints.find((cp) => cp.sectionAct === 7 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(inMerciless.checkpoints.find((cp) => cp.sectionAct === 10 && cp.stepKind === "ascend")!.completed).toBe(false);
    expect(inMerciless.lab.completedTrialAreaIds).toHaveLength(12);

    const inUber = enterZone(createTestSnapshot(), "EndGame_Labyrinth_P_branch");
    expect(inUber.checkpoints.find((cp) => cp.sectionAct === 10 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(inUber.lab.difficultyLabel).toBe("Eternal Labyrinth");
  });

  it("reconciles /passives chat output cleanly and ignores summary lines or player chat", () => {
    let snap = createTestSnapshot();
    const kisharaIdx = snap.checkpoints.findIndex((cp) => cp.questId === "a7q6");
    snap = {
      ...snap,
      checkpoints: snap.checkpoints.map((cp, i) => (i === kisharaIdx ? { ...cp, softCompleted: true } : cp)),
    };

    const lines = [
      "2026/11/14 15:00:00 1 [INFO Client 18744] : 74 from Character Level",
      "2026/11/14 15:00:00 2 [INFO Client 18744] : 22 from Quests",
      "2026/11/14 15:00:00 3 [INFO Client 18744] #GlobalPlayer: 1 from The Dweller of the Deep",
      "2026/11/14 15:00:00 4 [INFO Client 18744] : 1 from Through Sacred Ground",
      "2026/11/14 15:00:00 5 [INFO Client 18744] : 1 from The Way Forward",
      "2026/11/14 15:00:00 6 [INFO Client 18744] : 1 from Queen of the Sands",
      "2026/11/14 15:00:00 7 [INFO Client 18744] : 2 from An End to Hunger",
      "2026/11/14 15:00:00 8 [INFO Client 18744] : 1 Passive Skill Point from Deal with the Bandits",
      "2026/11/14 15:00:00 9 [INFO Client 18744] : 0 from Kishara\u2019s Star",
    ];

    for (const raw of lines) {
      const event = parseClientLogLine(raw);
      if (!event) continue;
      snap = reduceTelemetrySession(snap, { type: "client_log", event, autoDetectCharacter: false }, poe1GameAdapter);
    }

    expect(snap.checkpoints.find((cp) => cp.questId === "a1q7")!.completed).toBe(false);
    expect(snap.checkpoints.find((cp) => cp.questId === "a2q5")!.completed).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.questId === "a1q9")!.completed).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.questId === "a2q7")!.completed).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.questId === "a10q3")!.completed).toBe(true);

    const a9q5Steps = snap.checkpoints.filter((cp) => cp.questId === "a9q5");
    expect(a9q5Steps.find((cp) => cp.category === "SKILL_BOOK")!.completed).toBe(true);
    expect(a9q5Steps.find((cp) => cp.category === "MANDATORY_PATH")!.completed).toBe(false);

    const kishara = snap.checkpoints[kisharaIdx]!;
    expect(kishara.completed).toBe(false);
    expect(kishara.softCompleted).toBe(false);
  });

  it("marks Normal & Cruel trials and ascend checkpoints when 4 Ascendancy nodes are allocated", () => {
    const startSnap = createTestSnapshot();
    const updated = reconcileAscendancyProgressFromPassives(
      startSnap,
      [16023, 258, 6052, 53123, 47873],
      poe1GameAdapter,
    );

    expect(
      updated.checkpoints
        .filter((cp) => cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend" && cp.sectionAct <= 7)
        .every((cp) => cp.completed),
    ).toBe(true);
    expect(updated.checkpoints.find((cp) => cp.sectionAct === 4 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(updated.checkpoints.find((cp) => cp.sectionAct === 7 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(updated.checkpoints.find((cp) => cp.sectionAct === 10 && cp.stepKind === "ascend")!.completed).toBe(false);
    expect(updated.lab.completedTrialAreaIds).toHaveLength(9);
  });
});
