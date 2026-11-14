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
import { selectChecklistWindow } from "../src/features/widgets/active_checklist_widget.js";

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
    expect(fallbackWin.visibleSteps.some((cp) => cp.areaId === "1_2_11" || cp.areaId === "1_2_12")).toBe(true);
    expect(fallbackWin.visibleSteps.some((cp) => cp.questId === "a2q10")).toBe(false);
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
