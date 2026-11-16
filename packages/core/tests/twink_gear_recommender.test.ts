import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  buildInitialSessionSnapshot,
  buildTwinkGearTimeline,
  detectTwinkArchetype,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
  type TargetItemSetSummary,
  type TargetLinkGroupSummary,
} from "../src/index.js";

function makeLinkGroups(skillNames: string[]): TargetLinkGroupSummary[] {
  return [
    {
      title: "Main Skill",
      minLevel: 1,
      missingAuraWarning: false,
      gems: skillNames.map((name, idx) => ({
        gemId: `gem_${idx}`,
        name,
        color: "B",
        isSupport: false,
        verifiedSocketed: false,
        unlinkedWarning: false,
      })),
    },
  ];
}

function makeSnapshot(overrides: {
  characterClass: string;
  ascendancyName?: string;
  characterLevel?: number;
  skills?: string[];
  itemSets?: TargetItemSetSummary[];
  equippedItemNames?: string[];
}): HudSessionSnapshot {
  const build = validateAndEnrichPobBuild(
    {
      buildName: "TwinkTest",
      characterClass: overrides.characterClass,
      ascendancyName: overrides.ascendancyName ?? "None",
      bandit: "None",
      buildLevel: overrides.characterLevel ?? 1,
      skillSets: [],
      treeSpecs: [],
      itemSets: overrides.itemSets ?? [],
      uniqueRequiredGems: [],
    },
    poe1GameAdapter,
  );
  const base = buildInitialSessionSnapshot({
    roomId: "TEST",
    profileId: "twink-test",
    build,
    checkpoints: [],
    gemSteps: [],
    adapter: poe1GameAdapter,
  });
  return {
    ...base,
    characterLevel: overrides.characterLevel ?? 1,
    linkGroups: makeLinkGroups(overrides.skills ?? []),
    itemSets: overrides.itemSets ?? [],
    equippedItemNames: overrides.equippedItemNames ?? [],
  };
}

describe("twink_archetype_detector", () => {
  it("infers spell, bow, melee, minion, and hollow_palm archetypes from skills, items, and class", () => {
    expect(
      detectTwinkArchetype({
        characterClass: "Witch",
        ascendancyName: "Elementalist",
        linkGroups: makeLinkGroups(["Rolling Magma", "Purity of Elements"]),
      }),
    ).toBe("spell");

    expect(
      detectTwinkArchetype({
        characterClass: "Ranger",
        ascendancyName: "Deadeye",
        linkGroups: makeLinkGroups(["Lightning Arrow", "Grace"]),
      }),
    ).toBe("bow");

    expect(
      detectTwinkArchetype({
        characterClass: "Marauder",
        ascendancyName: "Juggernaut",
        linkGroups: makeLinkGroups(["Boneshatter", "Determination"]),
      }),
    ).toBe("melee");

    expect(
      detectTwinkArchetype({
        characterClass: "Witch",
        ascendancyName: "Necromancer",
        linkGroups: makeLinkGroups(["Summon Raging Spirit", "Haste"]),
      }),
    ).toBe("minion");

    expect(
      detectTwinkArchetype({
        characterClass: "Ranger",
        ascendancyName: "Raider",
        linkGroups: makeLinkGroups(["Smite"]),
        itemSets: [
          {
            id: "set1",
            title: "Hollow Palm",
            minLevel: 12,
            slots: [
              {
                slotName: "Jewel 1",
                itemId: "j1",
                itemName: "One With Nothing",
                baseType: "Small Cluster Jewel",
                rarity: "unique",
                sockets: "",
                levelReq: 1,
                mods: ["Adds Hollow Palm Technique"],
              },
            ],
          },
        ],
      }),
    ).toBe("hollow_palm");
  });
});

describe("buildTwinkGearTimeline", () => {
  it("advances activeBracketId as characterLevel rises across leveling brackets", () => {
    const levelTests: Array<[number, string]> = [
      [1, "lv_1"],
      [5, "lv_4_9"],
      [12, "lv_10_16"],
      [24, "lv_18_24"],
      [36, "lv_28_plus"],
    ];

    for (const [lv, expectedBracket] of levelTests) {
      const timeline = buildTwinkGearTimeline({
        snapshot: makeSnapshot({ characterClass: "Witch", characterLevel: lv, skills: ["Fireball"] }),
        adapter: poe1GameAdapter,
      });
      expect(timeline.activeBracketId).toBe(expectedBracket);
      expect(timeline.brackets.map((b) => b.id)).toEqual([
        "lv_1",
        "lv_4_9",
        "lv_10_16",
        "lv_18_24",
        "lv_28_plus",
      ]);
    }
  });

  it("omits Weapon, Offhand, and Gloves when Hollow Palm is active", () => {
    const timeline = buildTwinkGearTimeline({
      snapshot: makeSnapshot({ characterClass: "Duelist", characterLevel: 20, skills: ["Smite"] }),
      adapter: poe1GameAdapter,
      archetypeOverride: "hollow_palm",
    });

    const allItems = timeline.brackets.flatMap((b) => b.items);
    expect(allItems.some((i) => i.itemName === "One With Nothing")).toBe(true);
    expect(allItems.some((i) => i.slot === "Weapon" || i.slot === "Offhand" || i.slot === "Gloves")).toBe(false);
  });

  it("merges PoB leveling uniques with official CDN art, tracks equipped items, and caps stash regex", () => {
    const timeline = buildTwinkGearTimeline({
      snapshot: makeSnapshot({
        characterClass: "Witch",
        ascendancyName: "Elementalist",
        characterLevel: 24,
        skills: ["Rolling Magma"],
        equippedItemNames: ["goldrim", "tabula rasa"],
        itemSets: [
          {
            id: "1",
            title: "Leveling",
            minLevel: 1,
            slots: [
              {
                slotName: "Helmet",
                itemId: "1",
                itemName: "Goldrim",
                baseType: "Leather Cap",
                rarity: "unique",
                sockets: "R-B-B",
                levelReq: 1,
                mods: ["+35% to all Elemental Resistances"],
                verifiedEquipped: true,
              },
              {
                slotName: "Body Armour",
                itemId: "2",
                itemName: "Skin of the Loyal",
                baseType: "Simple Robe",
                rarity: "unique",
                sockets: "R-G-B-B-B-B",
                levelReq: 1,
                mods: ["+1 to Level of Socketed Gems"],
              },
            ],
          },
        ],
      }),
      adapter: poe1GameAdapter,
    });

    const allItems = timeline.brackets.flatMap((b) => b.items);
    const goldrim = allItems.find((i) => i.itemName === "Goldrim");
    const skin = allItems.find((i) => i.itemName === "Skin of the Loyal");
    const tabula = allItems.find((i) => i.itemName === "Tabula Rasa");

    expect(goldrim?.equipped).toBe(true);
    expect(goldrim?.inPobPlan).toBe(true);
    expect(tabula?.equipped).toBe(true);
    expect(skin?.inPobPlan).toBe(true);
    expect(skin?.iconUrl).toMatch(/^https:\/\/web\.poecdn\.com\/image\/Art\/2DItems\//);

    expect(timeline.stashRegex.length).toBeGreaterThan(0);
    expect(timeline.stashRegex.length).toBeLessThanOrEqual(240);
    const regex = new RegExp(timeline.stashRegex.replace(/"/g, ""), "i");
    expect(regex.test("Goldrim")).toBe(false);
    expect(regex.test("Tabula Rasa")).toBe(false);
    expect(regex.test("Seven-League Step")).toBe(true);
  });

  it("ships a bundled local WebP thumbnail on disk for every curated twink catalog item", () => {
    const publicDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../apps/pwa/public",
    );
    const catalog = poe1GameAdapter.getTwinkGearCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(50);

    for (const item of catalog) {
      expect(item.iconPath.startsWith("/assets/poe1/twink-items/")).toBe(true);
      const filePath = path.join(publicDir, item.iconPath.replace(/^\//, ""));
      expect(fs.existsSync(filePath), `Missing WebP thumbnail for ${item.itemName} at ${filePath}`).toBe(true);
    }
  });
});
