import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  buildAscendancyProgressionPlan,
  extractAscendancyNoteOrderIds,
  extractPobBuild,
  inferLevelFromTitle,
  parsePobXmlString,
  resolveAscendancyCluster,
} from "../src/index.js";

describe("ascendancy_progression_planner", () => {
  it("builds multi-spec Elementalist Lab order and tracks live allocation progress", () => {
    const xml = `<PathOfBuilding>
      <Build className="Witch" ascendClassName="Elementalist" level="68" buildName="Multi Spec Elementalist"/>
      <Skills/>
      <Tree>
        <Spec id="1" title="Normal Lab (Lv 33)" treeVersion="3_30" nodes="54447,16023,12738,53123"/>
        <Spec id="2" title="2nd Lab" treeVersion="3_30" nodes="54447,16023,12738,53123,37114,61259"/>
        <Spec id="3" title="3rd Lab" treeVersion="3_30" nodes="54447,16023,12738,53123,37114,61259,19595,57197"/>
        <Spec id="4" title="Eternal Lab" treeVersion="3_30" nodes="54447,16023,12738,53123,37114,61259,19595,57197,6052,4917"/>
      </Tree>
    </PathOfBuilding>`;

    const build = extractPobBuild(parsePobXmlString(xml), poe1GameAdapter);
    const plan = buildAscendancyProgressionPlan({
      characterClass: build.characterClass,
      ascendancyName: build.ascendancyName,
      specs: build.treeSpecs,
      allocatedNodeIds: ["16023", "12738", "53123"],
      adapter: poe1GameAdapter,
    });

    expect(plan.clusterKey).toBe("Elementalist");
    expect(plan.displayName).toBe("Elementalist");
    expect(plan.orderSource).toBe("multi_spec");
    expect(plan.allocatedPoints).toBe(2);
    expect(plan.plannedPoints).toBe(8);
    expect(plan.steps.map((s) => s.name)).toEqual([
      "Shaper of Flames",
      "Mastermind of Discord",
      "Heart of Destruction",
      "Bastion of Elements",
    ]);
    expect(plan.steps.map((s) => s.labTier)).toEqual([1, 2, 3, 4]);
    expect(plan.steps.map((s) => s.allocated)).toEqual([true, false, false, false]);
    expect(plan.steps.map((s) => s.isNext)).toEqual([false, true, false, false]);

    const completedPlan = buildAscendancyProgressionPlan({
      characterClass: build.characterClass,
      ascendancyName: build.ascendancyName,
      specs: build.treeSpecs,
      allocatedNodeIds: ["16023", "12738", "53123", "37114", "61259", "19595", "57197", "6052", "4917"],
      adapter: poe1GameAdapter,
    });
    expect(completedPlan.steps.every((s) => s.allocated)).toBe(true);
    expect(completedPlan.steps.some((s) => s.isNext)).toBe(false);
  });

  it("enforces tree prerequisites on single-spec PoBs even if node order is reversed", () => {
    const plan = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "Elementalist",
      specs: [
        {
          id: "1",
          title: "Endgame",
          minLevel: 90,
          nodeIds: ["57197", "19595", "61259", "37114", "16023", "6052", "4917", "12738", "53123"],
          masteries: {},
        },
      ],
      adapter: poe1GameAdapter,
    });

    expect(plan.orderSource).toBe("tree_path");
    const names = plan.steps.map((s) => s.name);
    expect(names.indexOf("Mastermind of Discord")).toBeLessThan(names.indexOf("Heart of Destruction"));
    expect(plan.steps.find((s) => s.name === "Heart of Destruction")?.prerequisiteNodeIds).toContain("61259");
  });

  it("extracts PoB <Notes> Ascendancy order while respecting prerequisite DAG", () => {
    const xml = `<PathOfBuilding>
      <Build className="Witch" ascendClassName="Elementalist" level="92" buildName="Notes Order"/>
      <Notes>
        ^7Ascendancy Order:
        1. Bastion of Elements
        2. Heart of Destruction (after Mastermind of Discord)
        3. Mastermind of Discord
        4. Shaper of Flames
      </Notes>
      <Tree>
        <Spec id="1" title="Endgame" treeVersion="3_30" nodes="16023,12738,53123,37114,61259,19595,57197,6052,4917"/>
      </Tree>
    </PathOfBuilding>`;

    const build = extractPobBuild(parsePobXmlString(xml), poe1GameAdapter);
    expect(build.ascendancyNoteOrderIds).toEqual(["4917", "57197", "61259", "53123"]);

    const plan = buildAscendancyProgressionPlan({
      characterClass: build.characterClass,
      ascendancyName: build.ascendancyName,
      specs: build.treeSpecs,
      ascendancyNoteOrderIds: build.ascendancyNoteOrderIds,
      adapter: poe1GameAdapter,
    });

    expect(plan.orderSource).toBe("pob_notes");
    // Bastion of Elements first per notes, Mastermind of Discord must precede Heart of Destruction
    expect(plan.steps.map((s) => s.name)).toEqual([
      "Bastion of Elements",
      "Mastermind of Discord",
      "Heart of Destruction",
      "Shaper of Flames",
    ]);
  });

  it("resolves Warden ascendancy onto the Raider cluster and displays Warden", () => {
    const resolved = resolveAscendancyCluster({
      ascendancyName: "Warden",
      adapter: poe1GameAdapter,
    });
    expect(resolved?.clusterKey).toBe("Raider");
    expect(resolved?.displayName).toBe("Warden");

    const plan = buildAscendancyProgressionPlan({
      characterClass: "Ranger",
      ascendancyName: "Warden",
      specs: [
        {
          id: "1",
          title: "Normal Lab",
          minLevel: 33,
          nodeIds: ["58427", "53421", "16848"],
          masteries: {},
        },
        {
          id: "2",
          title: "Endgame",
          minLevel: 75,
          nodeIds: ["58427", "53421", "16848", "5926", "31364", "63940", "55509", "27536", "4849"],
          masteries: {},
        },
      ],
      adapter: poe1GameAdapter,
    });

    expect(plan.displayName).toBe("Warden");
    expect(plan.steps.map((s) => s.name)).toEqual([
      "Oath of Winter",
      "Oath of Spring",
      "Mother's Teachings",
      "Avatar of the Wilds",
    ]);

    const noteIds = extractAscendancyNoteOrderIds(
      "Lab order: Mother's Teachings -> Oath of Winter -> Oath of Spring",
      "Warden",
      [{ nodeIds: ["58427", "53421", "16848", "5926", "31364", "27536", "4849"] }],
      poe1GameAdapter,
    );
    expect(noteIds).toEqual(["4849", "16848", "31364"]);
  });

  it("handles cyclic Deadeye tree, Ascendant sub-classes, Reliquarian uniques, and empty builds", () => {
    const deadeye = buildAscendancyProgressionPlan({
      characterClass: "Ranger",
      ascendancyName: "Deadeye",
      specs: [
        {
          id: "1",
          title: "Mapping",
          minLevel: 85,
          nodeIds: ["56856", "59837", "24848", "5082", "61627", "56134", "26067", "53086", "5443"],
          masteries: {},
        },
      ],
      adapter: poe1GameAdapter,
    });
    expect(deadeye.steps.map((s) => s.name)).toEqual([
      "Gathering Winds",
      "Ricochet",
      "Focal Point",
      "Endless Munitions",
    ]);

    const ascendant = buildAscendancyProgressionPlan({
      characterClass: "Scion",
      ascendancyName: "Ascendant",
      specs: [
        {
          id: "1",
          title: "Endgame",
          minLevel: 80,
          nodeIds: ["35754", "58029", "2521", "51782", "8281", "31598", "38689", "49532", "9327", "42671", "7618"],
          masteries: {},
        },
      ],
      adapter: poe1GameAdapter,
    });
    expect(ascendant.steps.map((s) => s.name)).toEqual(["Elementalist", "Pathfinder", "Path of the Ranger"]);
    expect(ascendant.steps.every((s) => s.labTier === null)).toBe(true);

    const reliquarian = buildAscendancyProgressionPlan({
      characterClass: "Scion",
      ascendancyName: "Reliquarian",
      specs: [
        {
          id: "1",
          title: "Endgame",
          minLevel: 80,
          nodeIds: ["10108", "35936", "22441", "36489", "16994", "35448"],
          masteries: {},
        },
      ],
      adapter: poe1GameAdapter,
    });
    expect(reliquarian.steps.map((s) => s.name)).toEqual(["Death's Door", "Crown of the Inward Eye"]);
    expect(reliquarian.steps.every((s) => s.labTier === null)).toBe(true);

    const empty = buildAscendancyProgressionPlan({
      characterClass: "Witch",
      ascendancyName: "None",
      specs: [],
      adapter: poe1GameAdapter,
    });
    expect(empty.clusterKey).toBeNull();
    expect(empty.steps).toEqual([]);
    expect(empty.orderSource).toBe("none");
  });

  it("infers ordinal and named Lab levels in inferLevelFromTitle", () => {
    expect(inferLevelFromTitle("1st Lab")).toBe(33);
    expect(inferLevelFromTitle("2nd Lab")).toBe(55);
    expect(inferLevelFromTitle("3rd Lab")).toBe(68);
    expect(inferLevelFromTitle("4th Lab")).toBe(75);
    expect(inferLevelFromTitle("Eternal Lab")).toBe(75);
  });
});
