import { describe, expect, it } from "vitest";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  auditGearAndFlaskHygiene,
  computeBenchCraftSuggestions,
  inspectCraftableGearSlots,
  type GggItemModRecord,
  type ResistanceTelemetry,
} from "../src/index.js";

function makeResistances(overrides?: Partial<Pick<ResistanceTelemetry, "fire" | "cold" | "lightning" | "chaos">>): ResistanceTelemetry {
  return {
    source: "API_VERIFIED",
    kitavaPenalty: 0,
    fire: overrides?.fire ?? { actual: 75, target: 75 },
    cold: overrides?.cold ?? { actual: 75, target: 75 },
    lightning: overrides?.lightning ?? { actual: 75, target: 75 },
    chaos: overrides?.chaos ?? { actual: 0, target: 0 },
    upcomingBossWarning: null,
  };
}

describe("Actionable Bench Craft Suggestions", () => {
  it("exposes RePoE campaign bench recipes for resistances, movement speed, life, and attributes", () => {
    const recipes = poe1GameAdapter.getCraftingBenchRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(35);

    const coldR1 = recipes.find((r) => r.id === "HelenaMasterColdResist1_");
    expect(coldR1).toMatchObject({
      category: "cold_res",
      label: "16-20% Cold Res",
      affixType: "suffix",
      requiredLevel: 15,
      costLabel: "1x Orb of Transmutation",
      unlockAreaId: null,
      unlockAct: 2,
    });

    const msR1 = recipes.find((r) => r.id === "EinharMasterMovementVelocity1");
    expect(msR1).toMatchObject({
      category: "movement_speed",
      label: "10-14% Movement Speed",
      affixType: "prefix",
      costLabel: "3x Orb of Augmentation",
      unlockAreaId: "1_3_1",
      unlockAct: 3,
      compatibleSlots: ["Boots"],
    });

    expect(recipes.some((r) => r.category === "life")).toBe(true);
    expect(recipes.some((r) => r.category === "strength")).toBe(true);
    expect(recipes.some((r) => r.category === "all_attributes")).toBe(true);
  });

  it("prescribes exact Act 2/3 Cold Res craft on Gloves when under cap", () => {
    const items: GggItemModRecord[] = [
      {
        inventoryId: "Gloves",
        typeLine: "Wool Gloves",
        frameType: 2,
        ilvl: 22,
        explicitMods: ["+18 to maximum Life"],
      },
      {
        inventoryId: "Helm",
        typeLine: "Goldrim",
        frameType: 3,
        ilvl: 20,
        explicitMods: ["+38% to all Elemental Resistances"],
      },
    ];

    const suggestions = computeBenchCraftSuggestions({
      items,
      resistances: makeResistances({ cold: { actual: 36, target: 50 } }),
      characterLevel: 24,
      highestUnlockedAct: 2,
      adapter: poe1GameAdapter,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      slot: "Gloves",
      problemSummary: "Cold Res -14% under cap",
      prescription: "Craft 16-20% Cold Res on Gloves (1x Orb of Transmutation)",
      costLabel: "1x Orb of Transmutation",
    });
  });

  it("upgrades resistance recipe tiers as Belly of the Beast 2 and Doedre's Cesspool unlock", () => {
    const gloves: GggItemModRecord[] = [
      {
        inventoryId: "Gloves",
        typeLine: "Mesh Gloves",
        frameType: 2,
        ilvl: 58,
        explicitMods: ["+45 to maximum Life"],
      },
    ];

    const act4Locked = computeBenchCraftSuggestions({
      items: gloves,
      resistances: makeResistances({ fire: { actual: 45, target: 75 } }),
      characterLevel: 38,
      highestUnlockedAct: 4,
      clearedAreaIds: ["1_4_1", "1_4_2"],
      adapter: poe1GameAdapter,
    });
    expect(act4Locked[0]?.prescription).toBe("Craft 16-20% Fire Res on Gloves (1x Orb of Transmutation)");

    const act4Unlocked = computeBenchCraftSuggestions({
      items: gloves,
      resistances: makeResistances({ fire: { actual: 45, target: 75 } }),
      characterLevel: 38,
      highestUnlockedAct: 4,
      clearedAreaIds: ["1_4_1", "1_4_6_2"],
      adapter: poe1GameAdapter,
    });
    expect(act4Unlocked[0]?.prescription).toBe("Craft 21-28% Fire Res on Gloves (1x Orb of Alchemy)");

    const act8Unlocked = computeBenchCraftSuggestions({
      items: gloves,
      resistances: makeResistances({ fire: { actual: 40, target: 75 } }),
      characterLevel: 56,
      highestUnlockedAct: 8,
      clearedAreaIds: ["2_8_2_2"],
      adapter: poe1GameAdapter,
    });
    expect(act8Unlocked[0]?.prescription).toBe("Craft 29-35% Fire Res on Gloves (3x Chaos Orb)");
  });

  it("skips crafted, normal, unique, full-suffix, and low-ilvl slots", () => {
    const items: GggItemModRecord[] = [
      {
        inventoryId: "Gloves",
        typeLine: "Strapped Mitts",
        frameType: 2,
        ilvl: 30,
        craftedMods: ["+16% to Fire Resistance"],
      },
      {
        inventoryId: "Helm",
        typeLine: "Iron Hat",
        frameType: 2,
        ilvl: 30,
        explicitMods: [
          { description: "+12 to Intelligence" },
          { description: "+18% to Fire Resistance", flags: { crafted: true } },
        ],
      },
      {
        inventoryId: "Belt",
        typeLine: "Leather Belt",
        frameType: 0,
        ilvl: 30,
      },
      {
        inventoryId: "BodyArmour",
        typeLine: "Tabula Rasa",
        frameType: 3,
        ilvl: 30,
      },
      {
        inventoryId: "Ring",
        typeLine: "Iron Ring",
        frameType: 2,
        ilvl: 30,
        explicitMods: ["+15% to Fire Resistance", "+15% to Lightning Resistance", "+20 to Strength"],
      },
      {
        inventoryId: "Ring2",
        typeLine: "Coral Ring",
        frameType: 2,
        ilvl: 10,
        explicitMods: ["+15 to maximum Life"],
      },
      {
        inventoryId: "Amulet",
        typeLine: "Jade Amulet",
        frameType: 1,
        ilvl: 25,
        explicitMods: ["+20 to maximum Life"],
      },
    ];

    const inspected = inspectCraftableGearSlots(items, 28);
    expect(inspected.map((s) => s.slot)).toEqual(["Gloves", "Helm", "Ring", "Ring2", "Amulet"]);
    expect(inspected.find((s) => s.slot === "Ring")?.openSuffix).toBe(false);

    const suggestions = computeBenchCraftSuggestions({
      items,
      resistances: makeResistances({ cold: { actual: 30, target: 55 } }),
      characterLevel: 28,
      highestUnlockedAct: 3,
      adapter: poe1GameAdapter,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.slot).toBe("Amulet");
    expect(suggestions[0]?.prescription).toBe("Craft 16-20% Cold Res on Amulet (1x Orb of Transmutation)");
  });

  it("prescribes 10-14% Movement Speed on 0% MS boots and enriches GearHygieneWidget alerts", () => {
    const bootsItem: GggItemModRecord = {
      inventoryId: "Boots",
      typeLine: "Iron Greaves",
      frameType: 2,
      ilvl: 24,
      explicitMods: ["+25 to maximum Life"],
    };

    const suggestions = computeBenchCraftSuggestions({
      items: [bootsItem],
      resistances: makeResistances(),
      characterLevel: 25,
      highestUnlockedAct: 3,
      clearedAreaIds: ["1_3_1"],
      adapter: poe1GameAdapter,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: "bench_boots_ms",
      slot: "Boots",
      problemSummary: "Boots have 0% Movement Speed",
      prescription: "Craft 10-14% Movement Speed on Boots (3x Orb of Augmentation)",
    });

    const hygiene = auditGearAndFlaskHygiene({
      items: [bootsItem],
      characterLevel: 25,
      highestUnlockedAct: 3,
      isAttackBuild: false,
      benchCraftSuggestions: suggestions,
    });
    expect(hygiene.find((i) => i.id === "boots_0ms")?.message).toContain(
      "Craft 10-14% Movement Speed on Boots (3x Orb of Augmentation)",
    );

    const uniqueBootsHygiene = auditGearAndFlaskHygiene({
      items: [{ ...bootsItem, frameType: 3, typeLine: "Wanderlust" }],
      characterLevel: 25,
      highestUnlockedAct: 3,
      isAttackBuild: false,
      benchCraftSuggestions: [],
    });
    expect(uniqueBootsHygiene.find((i) => i.id === "boots_0ms")?.message).toBe(
      "Boots have 0% Movement Speed in Act 3 — craft or vendor MS boots.",
    );
  });

  it("prescribes missing attributes on open-suffix slots", () => {
    const items: GggItemModRecord[] = [
      {
        inventoryId: "Amulet",
        typeLine: "Amber Amulet",
        frameType: 2,
        ilvl: 24,
        explicitMods: ["+22 to maximum Life"],
      },
    ];

    const suggestions = computeBenchCraftSuggestions({
      items,
      resistances: makeResistances(),
      characterLevel: 24,
      highestUnlockedAct: 3,
      attributeDeficits: { dexterity: 18 },
      adapter: poe1GameAdapter,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      slot: "Amulet",
      problemSummary: "Missing 18 Dexterity",
      prescription: "Craft +21-25 Dexterity on Amulet (2x Orb of Alchemy)",
    });
  });
});
