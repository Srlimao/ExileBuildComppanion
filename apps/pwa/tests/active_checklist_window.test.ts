import {
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import { selectChecklistWindow } from "@exile-hud/hud-ui";

function createTestSnapshot(): HudSessionSnapshot {
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: true });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const build = validateAndEnrichPobBuild(
    {
      buildName: "WindowTest",
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
      roomId: "WIN",
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
          event: { type: "area_generated", areaId, areaLevel: 15, areaSeed: `seed_${areaId}` },
          autoDetectCharacter: false,
        },
        poe1GameAdapter,
      ),
    start,
  );
}

describe("active_checklist_widget selectChecklistWindow", () => {
  it("anchors on the player's current combat zone when earlier sibling branches are pending", () => {
    const snap = stepZones(createTestSnapshot(), ["1_2_1", "1_2_town", "1_2_7", "1_2_12"]);
    const win = selectChecklistWindow(snap);

    expect(win.earlierPendingCount).toBeGreaterThan(0);
    expect(win.visibleSteps.some((cp) => cp.areaId === "1_2_12")).toBe(true);
    expect(win.visibleSteps[0]!.areaId).not.toBe("1_2_3");
  });

  it("anchors on ready town turn-ins or post-combat progression rather than unmet earlier town turn-ins", () => {
    const withReadyTurnIn = stepZones(createTestSnapshot(), [
      "1_1_town",
      "1_1_2",
      "1_1_3",
      "1_1_4_1",
      "1_1_town",
      "1_1_5",
      "1_1_6",
      "1_1_7_1",
      "1_1_7_2",
      "1_1_town",
      "1_1_8",
      "1_1_9",
      "1_1_11_1",
      "1_1_town",
    ]);
    const readyWin = selectChecklistWindow(withReadyTurnIn);
    expect(readyWin.visibleSteps.some((cp) => cp.questId === "a1q3")).toBe(true);
    expect(readyWin.visibleSteps[0]!.questId).not.toBe("a1q5");

    const noReadyTurnIn = stepZones(createTestSnapshot(), ["1_2_1", "1_2_town", "1_2_7", "1_2_12", "1_2_town"]);
    const fallbackWin = selectChecklistWindow(noReadyTurnIn);
    expect(fallbackWin.activeGroup?.groupId).toBe("a2_gems_weaver_bandits");
    expect(fallbackWin.visibleSteps.some((cp) => cp.areaId === "1_2_11")).toBe(false);
    expect(fallbackWin.visibleSteps.some((cp) => cp.questId === "a2q10")).toBe(false);
  });

  it("pins on the active quest group when mandatory maps are unvisited and advances after manual toggle", () => {
    let blocked = stepZones(createTestSnapshot(), ["1_1_town", "1_1_2", "1_1_4_1"]);
    const blockedWin = selectChecklistWindow(blocked);
    expect(blockedWin.activeGroup?.groupId).toBe("a1_strand_mud");
    expect(blockedWin.isHoldingForUnvisitedMandatory).toBe(true);
    expect(blockedWin.missingMandatoryAreaIds).toEqual(["1_1_3"]);
    expect(blockedWin.visibleSteps.some((cp) => cp.areaId === "1_1_3")).toBe(true);

    for (const cp of blocked.checkpoints.filter((c) => c.sectionAct === 1 && c.areaId === "1_1_3" && c.isMandatoryGate)) {
      blocked = reduceTelemetrySession(
        blocked,
        { type: "toggle_checkpoint", checkpointId: cp.id, completed: true },
        poe1GameAdapter,
      );
    }
    const unlockedWin = selectChecklistWindow(blocked);
    expect(unlockedWin.activeGroup?.groupId).toBe("a1_prison_brutus");
    expect(unlockedWin.isHoldingForUnvisitedMandatory).toBe(false);
  });

  it("returns allActDone and an empty visible slice when all current-act steps are completed", () => {
    const base = createTestSnapshot();
    const completedAllAct1: HudSessionSnapshot = {
      ...base,
      currentAct: 1,
      checkpoints: base.checkpoints.map((cp) => (cp.sectionAct === 1 ? { ...cp, completed: true } : cp)),
    };
    const win = selectChecklistWindow(completedAllAct1);
    expect(win.allActDone).toBe(true);
    expect(win.visibleSteps).toHaveLength(0);
  });
});
