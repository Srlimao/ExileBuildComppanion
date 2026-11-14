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

  it("reconciles verbatim PoE /passives output (parentheses, pre-Kitava resets, Ascendancy, level, post-Kitava)", () => {
    let snap = createTestSnapshot();
    const puppetIdx = snap.checkpoints.findIndex((cp) => cp.questId === "a6q6");
    const yugulIdx = snap.checkpoints.findIndex((cp) => cp.questId === "a8q4");
    snap = {
      ...snap,
      checkpoints: snap.checkpoints.map((cp, i) => {
        if (i === puppetIdx) return { ...cp, completed: true, softCompleted: false };
        if (i === yugulIdx) return { ...cp, completed: false, softCompleted: true };
        return cp;
      }),
    };

    const lines = [
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : 76 total Passive Skill Points (75 allocated)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : 4 total Ascendancy Skill Points (4 allocated)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : 59 Passive Skill Points from character level",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : 17 Passive Skill Points from quests:",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Dweller of the Deep)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Marooned Mariner)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Way Forward)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Through Sacred Ground)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Deal with the Bandits)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Victario's Secrets)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Piety's Pets)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from An Indomitable Spirit)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from In Service to Science)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Kitava's Torments)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Father of War)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Cloven One)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Master of a Million Faces)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Queen of Despair)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Kishara's Star)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from Love is Dead)",
      "2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] : (1 from The Gemling Legion)",
    ];
    for (const raw of lines) {
      const event = parseClientLogLine(raw);
      if (event) snap = reduceTelemetrySession(snap, { type: "client_log", event, autoDetectCharacter: false }, poe1GameAdapter);
    }

    const expectedCompletedQuestIds = [
      "a1q7", "a1q6", "a1q9", "a2q5", "a2q7", "a3q11", "a3q9", "a4q6",
      "a5q3", "a5q7", "a6q3", "a6q7", "a7q1", "a7q9", "a7q6", "a8q6", "a8q7",
    ];
    for (const qid of expectedCompletedQuestIds) {
      const cp = snap.checkpoints.find((c) => c.questId === qid && c.category === "SKILL_BOOK")!;
      expect(cp.completed, qid).toBe(true);
      expect(cp.softCompleted, qid).toBe(false);
    }

    expect(snap.checkpoints[puppetIdx]!.completed).toBe(false);
    expect(snap.checkpoints[puppetIdx]!.softCompleted).toBe(false);
    expect(snap.checkpoints[yugulIdx]!.completed).toBe(false);
    expect(snap.checkpoints[yugulIdx]!.softCompleted).toBe(false);
    expect(snap.characterLevel).toBe(60);
    expect(
      snap.checkpoints
        .filter((cp) => cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend" && cp.sectionAct <= 7)
        .every((cp) => cp.completed),
    ).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.sectionAct === 4 && cp.stepKind === "ascend")!.completed).toBe(true);
    expect(snap.checkpoints.find((cp) => cp.sectionAct === 7 && cp.stepKind === "ascend")!.completed).toBe(true);

    snap = {
      ...snap,
      checkpoints: snap.checkpoints.map((cp) => (cp.questId === "a10q3" ? { ...cp, completed: true } : cp)),
    };
    const zeroKitava = parseClientLogLine("2026/03/07 01:58:16 566635078 cffb06dd [INFO Client 62480] : (0 from An End to Hunger)")!;
    snap = reduceTelemetrySession(snap, { type: "client_log", event: zeroKitava, autoDetectCharacter: false }, poe1GameAdapter);
    expect(snap.checkpoints.find((cp) => cp.questId === "a10q3")!.completed).toBe(false);

    const twoKitava = parseClientLogLine("2026/03/07 01:58:40 566659390 cffb06dd [INFO Client 62480] : (2 from An End to Hunger)")!;
    snap = reduceTelemetrySession(snap, { type: "client_log", event: twoKitava, autoDetectCharacter: false }, poe1GameAdapter);
    expect(snap.checkpoints.find((cp) => cp.questId === "a10q3")!.completed).toBe(true);

    expect(parseClientLogLine("2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] #GlobalPlayer: (1 from The Dweller of the Deep)")).toBeNull();
    expect(parseClientLogLine("2026/11/14 21:10:40 545524453 cffb06be [INFO Client 38840] LocalPlayer: (1 from The Dweller of the Deep)")).toBeNull();
  });
});
