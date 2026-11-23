import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  evaluateActiveActQuestGroups,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "../src/index.js";

function createCampaignSnapshot(
  options: { leagueStart?: boolean; bandit?: "None" | "Oak" | "Kraityn" | "Alira"; includeLibrary?: boolean } = {},
): HudSessionSnapshot {
  const defs = buildPreprocessorDefinitions({
    leagueStart: options.leagueStart ?? true,
    bandit: options.bandit ?? "None",
    includeLibrary: options.includeLibrary ?? true,
  });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const build = validateAndEnrichPobBuild(
    {
      buildName: "GroupTest",
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      bandit: options.bandit ?? "None",
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
      roomId: "GRP",
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
          event: { type: "area_generated", areaId, areaLevel: 12, areaSeed: `seed_${areaId}` },
          autoDetectCharacter: false,
        },
        poe1GameAdapter,
      ),
    start,
  );
}

describe("Mandatory Quest Groups & strict intra-act visit gating", () => {
  it("never auto-completes unvisited mandatory maps in the current Act and blocks advancing to Group 2", () => {
    const skippedMudFlats = stepZones(createCampaignSnapshot(), ["1_1_town", "1_1_2", "1_1_4_1"]);

    expect(skippedMudFlats.visitedAreaIds).not.toContain("1_1_3");
    expect(skippedMudFlats.clearedAreaIds).not.toContain("1_1_3");
    expect(skippedMudFlats.checkpoints.some((cp) => cp.areaId === "1_1_3" && cp.completed)).toBe(false);

    const evaluation = evaluateActiveActQuestGroups(skippedMudFlats, poe1GameAdapter);
    expect(evaluation.activeGroup?.groupId).toBe("a1_strand_mud");
    expect(evaluation.activeGroup?.missingMandatoryAreaIds).toEqual(["1_1_3"]);
    expect(evaluation.activeGroup?.unvisitedMandatoryAreaIds).toEqual(["1_1_3"]);
    expect(evaluation.isHoldingForUnvisitedMandatory).toBe(true);
  });

  it("advances groups cleanly when all mandatory maps in the current group are visited/exited", () => {
    const progressed = stepZones(createCampaignSnapshot(), ["1_1_town", "1_1_2", "1_1_3", "1_1_4_1"]);
    const evaluation = evaluateActiveActQuestGroups(progressed, poe1GameAdapter);

    expect(evaluation.groups[0]?.isSatisfied).toBe(true);
    expect(evaluation.activeGroup?.groupId).toBe("a1_prison_brutus");
    expect(evaluation.isHoldingForUnvisitedMandatory).toBe(false);
  });

  it("never blocks group advancement on skipped optional detours, SKILL_BOOKs, or Lab trials", () => {
    const act1SkippingOptional = stepZones(createCampaignSnapshot(), [
      "1_1_town",
      "1_1_2",
      "1_1_3",
      "1_1_4_1",
      "1_1_5",
      "1_1_6",
      "1_1_7_1",
      "1_1_7_2",
      "1_1_8",
    ]);
    const a1Eval = evaluateActiveActQuestGroups(act1SkippingOptional, poe1GameAdapter);
    expect(a1Eval.groups[0]?.isSatisfied).toBe(true);
    expect(a1Eval.groups[1]?.isSatisfied).toBe(true);
    expect(a1Eval.activeGroup?.groupId).toBe("a1_merveil");

    const act5SkippingReliquary = stepZones(createCampaignSnapshot(), [
      "1_5_1",
      "1_5_town",
      "1_5_2",
      "1_5_3",
      "1_5_4",
      "1_5_5",
      "1_5_4b",
      "1_5_3b",
      "1_5_6",
      "1_5_8",
    ]);
    const a5Eval = evaluateActiveActQuestGroups(act5SkippingReliquary, poe1GameAdapter);
    expect(a5Eval.groups[0]?.isSatisfied).toBe(true);
    expect(a5Eval.groups[1]?.isSatisfied).toBe(true);
    expect(a5Eval.activeGroup?.groupId).toBe("a5_kitava");

    const act10SkippingOptional = stepZones(createCampaignSnapshot(), ["2_10_town", "2_10_1", "2_10_2", "2_10_3"]);
    const a10Eval = evaluateActiveActQuestGroups(act10SkippingOptional, poe1GameAdapter);
    expect(a10Eval.groups[0]?.isSatisfied).toBe(true);
    expect(a10Eval.activeGroup?.groupId).toBe("a10_desecrated");
  });

  it("keeps parallel branches inside the same group flexible while blocking the next gate group (Act 4 Dreams & Act 8 Orbs)", () => {
    const act4KaomThenBelly = stepZones(createCampaignSnapshot(), [
      "1_4_1",
      "1_4_town",
      "1_4_2",
      "1_4_3_1",
      "1_4_3_2",
      "1_4_3_3",
      "1_4_4_1",
      "1_4_4_3",
      "1_4_3_3",
      "1_4_6_1",
    ]);
    const a4Eval = evaluateActiveActQuestGroups(act4KaomThenBelly, poe1GameAdapter);
    expect(a4Eval.groups[0]?.isSatisfied).toBe(true);
    expect(a4Eval.activeGroup?.groupId).toBe("a4_dreams");
    expect(a4Eval.activeGroup?.missingMandatoryAreaIds).toEqual(expect.arrayContaining(["1_4_5_1", "1_4_5_2"]));
    expect(a4Eval.isHoldingForUnvisitedMandatory).toBe(true);

    const act8LunarisOnly = stepZones(createCampaignSnapshot(), [
      "2_8_1",
      "2_8_town",
      "2_8_2_1",
      "2_8_2_2",
      "2_8_8",
      "2_8_9",
      "2_8_10",
      "2_8_12_1",
      "2_8_11",
      "2_8_13",
      "2_8_6",
      "2_8_7_1_",
      "2_8_7_2",
      "2_8_13",
    ]);
    const a8Eval = evaluateActiveActQuestGroups(act8LunarisOnly, poe1GameAdapter);
    expect(a8Eval.groups[0]?.isSatisfied).toBe(true);
    expect(a8Eval.activeGroup?.groupId).toBe("a8_sun_moon_orbs");
    expect(a8Eval.activeGroup?.missingMandatoryAreaIds).toContain("2_8_12_2");
  });

  it("assigns multi-visit hubs to distinct story-gate groups with prerequisites", () => {
    const checkpoints = createCampaignSnapshot().checkpoints;
    const sewersSteps = checkpoints.filter((cp) => cp.sectionAct === 3 && cp.areaId === "1_3_10_1");
    expect(sewersSteps[0]?.questGroupId).toBe("a3_sewers_solaris_docks");
    expect(sewersSteps.some((cp) => /Undying Blockage/i.test(cp.title) && cp.questGroupId === "a3_ebony_lunaris")).toBe(
      true,
    );

    const bridgeSteps = checkpoints.filter((cp) => cp.sectionAct === 8 && cp.areaId === "2_8_13");
    const skyShrineStep = bridgeSteps.find((cp) => /Sky Shrine/i.test(cp.title));
    expect(bridgeSteps[0]?.questGroupId).toBe("a8_sun_moon_orbs");
    expect(skyShrineStep?.questGroupId).toBe("a8_harbour_bridge");
    expect(skyShrineStep?.prerequisiteAreaIds).toEqual(expect.arrayContaining(["2_8_12_2", "2_8_7_2"]));

    const squareSteps = checkpoints.filter((cp) => cp.sectionAct === 10 && cp.areaId === "2_10_2");
    const innocenceStep = squareSteps.find((cp) => /Innocence/i.test(cp.title));
    expect(squareSteps[0]?.questGroupId).toBe("a10_rooftop_square");
    expect(innocenceStep?.questGroupId).toBe("a10_kitava");
    expect(innocenceStep?.prerequisiteAreaIds).toContain("2_10_4");
  });

  it("allows manual checkbox override on missing mandatory steps to unlock the next group", () => {
    let blocked = stepZones(createCampaignSnapshot(), ["1_1_town", "1_1_2", "1_1_4_1"]);
    expect(evaluateActiveActQuestGroups(blocked, poe1GameAdapter).activeGroup?.groupId).toBe("a1_strand_mud");

    for (const cp of blocked.checkpoints.filter((c) => c.sectionAct === 1 && c.areaId === "1_1_3" && c.isMandatoryGate)) {
      blocked = reduceTelemetrySession(
        blocked,
        { type: "toggle_checkpoint", checkpointId: cp.id, completed: true },
        poe1GameAdapter,
      );
    }
    const unlocked = evaluateActiveActQuestGroups(blocked, poe1GameAdapter);
    expect(unlocked.groups[0]?.isSatisfied).toBe(true);
    expect(unlocked.activeGroup?.groupId).toBe("a1_prison_brutus");
    expect(unlocked.isHoldingForUnvisitedMandatory).toBe(false);
  });

  it("reconciles prior Acts when entering a strictly later Act while keeping the entered Act strict", () => {
    const act6Resume = stepZones(createCampaignSnapshot(), ["2_6_2", "2_6_6"]);
    expect(act6Resume.clearedAreaIds).toContain("1_5_8");
    expect(act6Resume.checkpoints.some((cp) => cp.sectionAct === 5 && cp.areaId === "1_5_8" && cp.completed)).toBe(true);

    // Inside Act 6, skipping 2_6_4 & 2_6_5 keeps Group 0 blocked on those unvisited maps
    const a6Eval = evaluateActiveActQuestGroups(act6Resume, poe1GameAdapter);
    expect(a6Eval.activeGroup?.groupId).toBe("a6_shavronne");
    expect(a6Eval.activeGroup?.unvisitedMandatoryAreaIds).toEqual(expect.arrayContaining(["2_6_4", "2_6_5"]));
  });

  it("defines valid contiguous quest groups across Acts 1-10 for all route presets", () => {
    const areas = poe1GameAdapter.getAreas();
    const seenIds = new Set<string>();

    for (let act = 1; act <= 10; act += 1) {
      const groups = poe1GameAdapter.getCampaignQuestGroups(act);
      expect(groups.length, `Act ${act}`).toBeGreaterThanOrEqual(3);
      groups.forEach((group, idx) => {
        expect(seenIds.has(group.id), group.id).toBe(false);
        seenIds.add(group.id);
        expect(group.order).toBe(idx);
        for (const areaId of group.mandatoryAreaIds) {
          expect(areas[areaId], `${group.id}:${areaId}`).toBeDefined();
        }
      });
    }

    for (const variant of [
      createCampaignSnapshot({ leagueStart: true, bandit: "None", includeLibrary: true }),
      createCampaignSnapshot({ leagueStart: false, bandit: "Alira", includeLibrary: false }),
    ]) {
      for (let act = 1; act <= 10; act += 1) {
        const evalAct = evaluateActiveActQuestGroups({ ...variant, currentAct: act }, poe1GameAdapter);
        expect(evalAct.groups.length, `Act ${act} groups`).toBeGreaterThanOrEqual(3);
        expect(evalAct.activeGroup?.groupIndex).toBe(0);
      }
    }
  });
});
