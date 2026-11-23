import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import { buildAscendancyProgressionPlan, type PassiveTreeSpecSummary } from "../src/index.js";

describe("ascendancy_level_swaps", () => {
  it("keeps standard multi-spec builds in one full 1..4 roadmap phase across all levels", () => {
    const specs: PassiveTreeSpecSummary[] = [
      { id: "1", title: "Act 1 (Lv 1)", minLevel: 1, nodeIds: ["54447", "57264"], masteries: {} },
      { id: "2", title: "Normal Lab (Lv 33)", minLevel: 33, nodeIds: ["54447", "16023", "12738", "53123"], masteries: {} },
      { id: "3", title: "Cruel Lab (Lv 55)", minLevel: 55, nodeIds: ["54447", "16023", "12738", "53123", "37114", "61259"], masteries: {} },
      { id: "4", title: "Merciless Lab (Lv 68)", minLevel: 68, nodeIds: ["54447", "16023", "12738", "53123", "37114", "61259", "19595", "57197"], masteries: {} },
      { id: "5", title: "Endgame (Lv 75)", minLevel: 75, nodeIds: ["54447", "16023", "12738", "53123", "37114", "61259", "19595", "57197", "6052", "4917"], masteries: {} },
    ];

    for (const level of [1, 30, 60, 90]) {
      const plan = buildAscendancyProgressionPlan({
        characterClass: "Witch",
        ascendancyName: "Elementalist",
        specs,
        characterLevel: level,
        adapter: poe1GameAdapter,
      });
      expect(plan.phases).toHaveLength(1);
      expect(plan.displayName).toBe("Elementalist");
      expect(plan.steps.map((s) => s.name)).toEqual([
        "Shaper of Flames",
        "Mastermind of Discord",
        "Heart of Destruction",
        "Bastion of Elements",
      ]);
      expect(plan.steps.every((s) => !s.respecLater)).toBe(true);
    }
  });

  it("switches ascendancy class by characterLevel on full Ascendancy swap builds", () => {
    const specs: PassiveTreeSpecSummary[] = [
      { id: "1", title: "Act 1 (Lv 1)", minLevel: 1, nodeIds: ["54447", "57264"], masteries: {} },
      { id: "2", title: "Normal Lab (Lv 33)", minLevel: 33, nodeIds: ["54447", "16023", "12738", "53123"], masteries: {} },
      { id: "3", title: "Cruel Lab (Lv 55)", minLevel: 55, nodeIds: ["54447", "16023", "12738", "53123", "54279", "56461"], masteries: {} },
      {
        id: "4",
        title: "Endgame Swap (Lv 75)",
        minLevel: 75,
        nodeIds: ["54447", "60791", "26298", "54159", "39818", "65153", "5415", "36017", "18309", "48719"],
        masteries: {},
      },
    ];

    const preLab = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      specs,
      characterLevel: 10,
      adapter: poe1GameAdapter,
    });
    expect(preLab.phases).toHaveLength(2);
    expect(preLab.activePhaseIndex).toBe(0);
    expect(preLab.displayName).toBe("Elementalist");
    expect(preLab.steps.map((s) => s.name)).toEqual(["Shaper of Flames", "Liege of the Primordial"]);

    const lv40 = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      specs,
      characterLevel: 40,
      adapter: poe1GameAdapter,
    });
    expect(lv40.activePhaseIndex).toBe(0);
    expect(lv40.displayName).toBe("Elementalist");

    const lv75Swap = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      specs,
      characterLevel: 75,
      allocatedNodeIds: ["16023", "12738", "53123", "54279", "56461"],
      adapter: poe1GameAdapter,
    });
    expect(lv75Swap.activePhaseIndex).toBe(1);
    expect(lv75Swap.displayName).toBe("Necromancer");
    expect(lv75Swap.allocatedOtherAscendancyName).toBe("Elementalist");
    expect(lv75Swap.steps.map((s) => s.name)).toEqual([
      "Mindless Aggression",
      "Commander of Darkness",
      "Mistress of Sacrifice",
      "Unnatural Strength",
    ]);

    const manualPreview = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      specs,
      characterLevel: 35,
      manualPhaseId: "phase_1",
      adapter: poe1GameAdapter,
    });
    expect(manualPreview.activePhaseIndex).toBe(1);
    expect(manualPreview.displayName).toBe("Necromancer");
  });

  it("tracks same-Ascendancy notable respec phases and reports respecSteps", () => {
    const specs: PassiveTreeSpecSummary[] = [
      { id: "1", title: "Normal Lab (Lv 33)", minLevel: 33, nodeIds: ["16023", "12738", "53123"], masteries: {} },
      { id: "2", title: "Cruel Lab (Lv 55)", minLevel: 55, nodeIds: ["16023", "12738", "53123", "54279", "56461"], masteries: {} },
      {
        id: "3",
        title: "Endgame Respec (Lv 75)",
        minLevel: 75,
        nodeIds: ["16023", "12738", "53123", "37114", "61259", "19595", "57197", "6052", "4917"],
        masteries: {},
      },
    ];

    const lv40 = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Elementalist",
      specs,
      characterLevel: 40,
      adapter: poe1GameAdapter,
    });
    expect(lv40.phases).toHaveLength(2);
    expect(lv40.activePhaseIndex).toBe(0);
    expect(lv40.steps.map((s) => s.name)).toEqual(["Shaper of Flames", "Liege of the Primordial"]);
    expect(lv40.steps.map((s) => s.respecLater)).toEqual([false, true]);

    const lv80 = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Elementalist",
      specs,
      characterLevel: 80,
      allocatedNodeIds: ["16023", "12738", "53123", "54279", "56461"],
      adapter: poe1GameAdapter,
    });
    expect(lv80.activePhaseIndex).toBe(1);
    expect(lv80.steps.map((s) => s.name)).toEqual([
      "Shaper of Flames",
      "Mastermind of Discord",
      "Bastion of Elements",
      "Heart of Destruction",
    ]);
    expect(lv80.steps[0]?.allocated).toBe(true);
    expect(lv80.steps[1]?.isNext).toBe(true);
    expect(lv80.respecSteps).toEqual([{ nodeId: "56461", name: "Liege of the Primordial" }]);
  });

  it("preserves final-phase selection when characterLevel is omitted", () => {
    const specs: PassiveTreeSpecSummary[] = [
      { id: "1", title: "Early (Lv 33)", minLevel: 33, nodeIds: ["16023", "12738", "53123"], masteries: {} },
      { id: "2", title: "Late Swap (Lv 75)", minLevel: 75, nodeIds: ["60791", "26298", "54159"], masteries: {} },
    ];
    const plan = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      specs,
      adapter: poe1GameAdapter,
    });
    expect(plan.activePhaseIndex).toBe(1);
    expect(plan.displayName).toBe("Necromancer");
  });
});
