import { loadPassiveTreeDataset, poe2GameAdapter } from "@exile-hud/game-data";
import { beforeAll, describe, expect, it } from "vitest";
import {
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPobPreviewSummary,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  extractDecodedBuild,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  resolveAndDecodePobInput,
  stripPoeBuildMarkup,
  validateAndEnrichPobBuild,
} from "../src/index.js";

const OFFICIAL_STYLE_BUILD_JSON = JSON.stringify({
  name: "Lightning Arrow Deadeye",
  author: "<bold>{RangeMaster}",
  link: "https://example.com/la-deadeye",
  description: "<red>{Core} leveling guide for early campaign.\nSwap to Tempest at 35.",
  ascendancy: "Deadeye",
  passives: [
    {
      id: "lightning14",
      level_interval: [1, 100],
      weapon_set: 1,
      additional_text: "<blue>{Grab} early for Shock chance.",
    },
    {
      id: "passive_keystone_zealots_oath",
      level_interval: [35, 100],
      weapon_set: 2,
      additional_text: "Take after ES recharge swap.",
    },
    {
      id: "AscendancyRanger1Notable3",
      level_interval: [22, 100],
    },
  ],
  skills: [
    {
      id: "Metadata/Items/Gems/SkillGemIceStrike",
      level_interval: [14, 100],
      weapon_set: 1,
      additional_text: "<bold>{Primary clear skill}",
      support_skills: [
        { id: "Metadata/Items/Gems/SupportGemMartialTempo", level_interval: [1, 100] },
        { id: "SupportGemIceBite", level_interval: [14, 100] },
      ],
    },
    {
      id: "Metadata/Items/Gems/SkillGemHeraldOfIce",
      level_interval: [10, 100],
    },
  ],
  inventory_slots: [
    {
      inventory_id: "Helm",
      unique_name: "Goldrim",
      additional_text: "Cap Elemental Res early.",
      level_interval: [1, 34],
    },
    {
      inventory_id: "Flask1",
      additional_text: "Upgrade flask at lv <red>{16}, <red>{30}",
      level_interval: [1, 100],
    },
  ],
});

describe("poe2_build_file_import", () => {
  beforeAll(async () => {
    await loadPassiveTreeDataset("poe2");
  });

  it("strips GGG inline markup cleanly", () => {
    expect(stripPoeBuildMarkup("Flask upgrade lvl <red>{10}, <bold>{23}")).toBe("Flask upgrade lvl 10, 23");
    expect(stripPoeBuildMarkup("<rgb(255,0,0)>{Boss} swap\n<italic>{Keep boots}")).toBe("Boss swap\nKeep boots");
  });

  it("decodes official GGG .build JSON, resolves stringIds, weapon sets, level intervals & notes", async () => {
    const decoded = await resolveAndDecodePobInput(OFFICIAL_STYLE_BUILD_JSON);
    expect(decoded.sourceKind).toBe("poe2_build_json");
    expect(decoded.detectedGameId).toBe("poe2");

    const extracted = extractDecodedBuild(decoded, poe2GameAdapter);
    expect(extracted.sourceFormat).toBe("poe2_build_json");
    expect(extracted.buildName).toBe("Lightning Arrow Deadeye");
    expect(extracted.characterClass).toBe("Ranger");
    expect(extracted.ascendancyName).toBe("Deadeye");
    expect(extracted.suggestedNotes).toContain("Core leveling guide for early campaign.");
    expect(extracted.suggestedNotes).toContain("Author: RangeMaster");
    expect(extracted.suggestedNotes).toContain("Link: https://example.com/la-deadeye");

    // Breakpoints should synthesize brackets: [1, 10, 14, 22, 35]
    expect(extracted.treeSpecs.length).toBeGreaterThanOrEqual(4);
    const lv35Spec = extracted.treeSpecs[extracted.treeSpecs.length - 1]!;
    expect(lv35Spec.nodeIds).toContain("4"); // lightning14
    expect(lv35Spec.nodeIds).toContain("52"); // passive_keystone_zealots_oath
    expect(lv35Spec.nodeIds).toContain("30"); // AscendancyRanger1Notable3
    expect(lv35Spec.weaponSet1NodeIds).toEqual(["4"]);
    expect(lv35Spec.weaponSet2NodeIds).toEqual(["52"]);
    expect(lv35Spec.nodeNotes?.["4"]).toBe("Grab early for Shock chance.");

    // Skill sets & Item sets
    expect(lv35Spec.minLevel).toBe(35);
    const endgameSkills = extracted.skillSets[extracted.skillSets.length - 1]!;
    expect(endgameSkills.groups.some((g) => g.title === "Ice Strike" && g.note === "Primary clear skill")).toBe(true);
    expect(extracted.itemSets[0]?.slots.some((s) => s.itemName === "Goldrim")).toBe(true);
    expect(extracted.itemSets[extracted.itemSets.length - 1]?.slots.some((s) => s.slotName === "Flask 1")).toBe(true);

    const preview = buildPobPreviewSummary(extracted);
    expect(preview.sourceFormat).toBe("poe2_build_json");
    expect(preview.suggestedNotes).toContain("Author: RangeMaster");
  });

  it("tolerates community field aliases, numeric IDs, *.build URLs & unknown-ID warnings", async () => {
    const communityJson = JSON.stringify({
      name: "Community Invoker",
      ascendancy: "Invoker",
      passives: [{ key: "44683", note: "Monk Start" }, { node_id: "unknown_node_999" }],
      skills: [{ skill: "SkillGemIceStrike", supports: ["SupportGemMartialTempo", "FakeSupportGem"] }],
      inventory_slots: [{ slot: "BodyArmour", item_name: "Ghostwrithe", note: "Use at Lv 1" }],
    });

    const decoded = await resolveAndDecodePobInput("https://example.com/builds/monk.build", async (url) => {
      expect(url).toBe("https://example.com/builds/monk.build");
      return new Response(communityJson, { status: 200 });
    });
    expect(decoded.sourceKind).toBe("poe2_build_url");

    const extracted = extractDecodedBuild(decoded, poe2GameAdapter);
    expect(extracted.characterClass).toBe("Monk");
    expect(extracted.treeSpecs[0]?.nodeIds).toEqual(["44683"]);
    expect(extracted.treeSpecs[0]?.nodeNotes?.["44683"]).toBe("Monk Start");
    expect(extracted.itemSets[0]?.slots[0]?.slotName).toBe("Body Armour");
    expect(extracted.itemSets[0]?.slots[0]?.itemName).toBe("Ghostwrithe");
    expect(extracted.importWarnings?.some((w) => w.includes("unknown_node_999"))).toBe(true);
    expect(extracted.importWarnings?.some((w) => w.includes("FakeSupportGem"))).toBe(true);
  });

  it("compiles a decoded .build into a live PoE 2 HudSessionSnapshot preserving notes & Spirit", async () => {
    const decoded = await resolveAndDecodePobInput(OFFICIAL_STYLE_BUILD_JSON);
    const extracted = extractDecodedBuild(decoded, poe2GameAdapter);
    const validated = validateAndEnrichPobBuild(extracted, poe2GameAdapter);
    const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: false });
    const route = combineRouteActFiles(poe2GameAdapter.getDefaultRouteFiles());
    const steps = parsePreprocessedRouteLines(preprocessRouteConditionals(route, defs), poe2GameAdapter);
    const checkpoints = buildCheckpointGraph(steps, poe2GameAdapter);
    const gemSteps = assignGemsToCampaignRoute(validated, steps, poe2GameAdapter);

    const snap = buildInitialSessionSnapshot({
      roomId: "BLD001",
      profileId: "poe2-build-test",
      build: validated,
      checkpoints,
      gemSteps,
      adapter: poe2GameAdapter,
    });

    expect(snap.gameId).toBe("poe2");
    expect(snap.poe2SpiritSummary?.requiredSpirit).toBe(30);
    expect(snap.passiveTree.specs?.[snap.passiveTree.specs.length - 1]?.nodeNotes?.["4"]).toBe(
      "Grab early for Shock chance.",
    );
    const iceStrikeGroup = snap.linkGroups.find((g) => g.title === "Ice Strike");
    expect(iceStrikeGroup?.note ?? snap.linkGroups.length).toBeTruthy();
  });

  it("normalizes official GGG indexed PoE 2 inventory_id keys (Helm1, BodyArmour1, Offhand1/2, Weapon2) and Stat Priority notes", async () => {
    const gggBuildJson = JSON.stringify({
      name: "Titan Warrior",
      ascendancy: "Warrior1",
      passives: ["melee17"],
      inventory_slots: [
        { inventory_id: "Weapon1", additional_text: "<silver>{Any Two Handed Mace}\n\n<grey>{Stat Priority\n-------------------\n1. Prioritize highest physical dps}" },
        { inventory_id: "Offhand1", additional_text: "<red>{Tower Shield}\n\n<grey>{Stat Priority\n1. Increased Armour}" },
        { inventory_id: "Weapon2", additional_text: "<blue>{Weapon Swap Staff}\n\n<grey>{Stat Priority\n1. Level of all spell skills}" },
        { inventory_id: "Offhand2", additional_text: "<blue>{Crystal Focus}\n\n<grey>{Stat Priority\n1. Energy Shield}" },
        { inventory_id: "BodyArmour1", additional_text: "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n-------------------\n1. Increased Health\n2. Increased Resistances\n3. Increased Armour}" },
        { inventory_id: "Boots1", additional_text: "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n1. Increased Movement Speed\n2. Increased Health}" },
        { inventory_id: "Helm1", additional_text: "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n1. Increased Health\n2. Increased Resistances}" },
        { inventory_id: "Gloves1", additional_text: "<red>{Armour (Str Base)}\n\n<grey>{Stat Priority\n1. Increased Attack Speed\n2. Flat damage to attacks}" },
        { inventory_id: "Belt1", additional_text: "<silver>{Any Belt}\n\n<grey>{Stat Priority\n1. Increased Health\n2. Increased Resistances}" },
        { inventory_id: "Amulet1", additional_text: "<silver>{Any Amulet}\n\n<grey>{Stat Priority\n1. Level of all melee skills\n2. Increased Resistances\n3. Increased Intelligence}" },
        { inventory_id: "LifeFlask1", additional_text: "Instant Life Flask" },
        { inventory_id: "ManaFlask1", additional_text: "Mana Flask" },
        { inventory_id: "BeltCharm1", unique_name: "Thawing Charm", additional_text: "Freeze Immunity" },
      ],
    });

    const decoded = await resolveAndDecodePobInput(gggBuildJson);
    const extracted = extractDecodedBuild(decoded, poe2GameAdapter);
    const slots = extracted.itemSets[0]?.slots ?? [];

    expect(slots.map((s) => s.slotName)).toEqual([
      "Weapon 1", "Weapon 2", "Weapon 1 Swap", "Weapon 2 Swap", "Body Armour",
      "Boots", "Helmet", "Gloves", "Belt", "Amulet", "Life Flask", "Mana Flask", "Charm 1",
    ]);
    const body = slots.find((s) => s.slotName === "Body Armour")!;
    expect(body.baseType).toBe("Armour (Str Base)");
    expect(body.mods).toEqual(["1. Increased Health", "2. Increased Resistances", "3. Increased Armour"]);
  });
});
