import { describe, expect, it } from "vitest";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  auditGearAndFlaskHygiene,
  buildInitialTargetSkillSets,
  buildVendorSearchRegex,
  computePassiveTreeDiff,
  estimateEquippedResistances,
  parseClientLogLine,
  parsePoelabDailyJson,
  advanceLabRoomBySeed,
  verifySocketsAndGems,
  type GggItemModRecord,
} from "../src/index.js";

const SAMPLE_GGG_ITEMS: GggItemModRecord[] = [
  {
    inventoryId: "Ring",
    typeLine: "Two-Stone Ring",
    implicitMods: ["+16% to Fire and Cold Resistances"],
    explicitMods: ["+30% to Lightning Resistance", "+12% to all Elemental Resistances"],
  },
  {
    inventoryId: "Boots",
    typeLine: "Iron Greaves",
    explicitMods: ["+20 to maximum Life"], // 0% MS!
  },
  {
    inventoryId: "Weapon",
    typeLine: "Rusted Sword",
    requirements: [{ name: "Level", values: [["1", 0]] }],
    sockets: [
      { group: 0, attr: "I", sColour: "B" },
      { group: 1, attr: "I", sColour: "B" },
    ],
    socketedItems: [
      { socket: 0, typeLine: "Fireball", support: false },
      { socket: 1, typeLine: "Combustion Support", support: true }, // unlinked socket group 1!
    ],
  },
  {
    inventoryId: "Flask",
    typeLine: "Small Life Flask",
    requirements: [{ name: "Level", values: [["1", 0]] }],
  },
];

describe("Character Telemetry Diffs, Vendor Regex & Lab Tracker", () => {
  it("calculates equipped + Alira resistances minus Kitava penalty", () => {
    const res = estimateEquippedResistances({
      items: SAMPLE_GGG_ITEMS,
      allocatedNodeIds: [],
      bandit: "Alira",
      highestUnlockedAct: 6,
      completedBossFlags: ["kitava_act5"],
      adapter: poe1GameAdapter,
    });
    // Fire: 16 + 12 + 15 (Alira) - 30 (Kitava) = 13
    // Cold: 16 + 12 + 15 - 30 = 13
    // Lightning: 30 + 12 + 15 - 30 = 27
    expect(res.kitavaPenalty).toBe(-30);
    expect(res.fire.actual).toBe(13);
    expect(res.cold.actual).toBe(13);
    expect(res.lightning.actual).toBe(27);
  });

  it("flags unlinked support gems, 0% MS boots past Act 2, outdated flasks, and under-leveled attack weapons", () => {
    const verification = verifySocketsAndGems({
      items: SAMPLE_GGG_ITEMS,
      skillSets: [
        {
          title: "Act 1",
          minLevel: 1,
          groups: [
            {
              title: "Fireball",
              slotLabel: "Weapon",
              gems: [
                { gemId: "fb", name: "Fireball", isSupport: false, requiredLevel: 1, attribute: "intelligence" },
                { gemId: "comb", name: "Combustion Support", isSupport: true, requiredLevel: 8, attribute: "intelligence" },
              ],
            },
          ],
        },
      ],
      gemSteps: [],
      characterLevel: 26,
    });

    expect(verification.unlinkedWarnings).toHaveLength(1);
    expect(verification.linkGroups[0]?.gems[1]?.unlinkedWarning).toBe(true);

    const hygiene = auditGearAndFlaskHygiene({
      items: SAMPLE_GGG_ITEMS,
      characterLevel: 26,
      highestUnlockedAct: 3,
      isAttackBuild: true,
    });
    expect(hygiene.some((i) => i.id === "boots_0ms")).toBe(true);
    expect(hygiene.some((i) => i.slot === "flask")).toBe(true);
    expect(hygiene.some((i) => i.id === "weapon_underleveled")).toBe(true);
  });

  it("computes passive tree remaining nodes, respec count, vendor regex < 50 chars, and Lab room seed tracking", () => {
    const diff = computePassiveTreeDiff({
      treeSpecs: [{ title: "Lv 30", treeVersion: "3_29", minLevel: 1, nodeIds: ["26725", "44103"], masteries: {} }],
      allocatedHashes: [26725, 99999],
      characterLevel: 30,
      adapter: poe1GameAdapter,
    });
    expect(diff.allocatedTargetCount).toBe(1);
    expect(diff.remainingNodeIds).toEqual(["44103"]);
    expect(diff.respecPointsNeeded).toBe(1);

    const regex = buildVendorSearchRegex({
      gemSteps: [],
      linkGroups: [
        {
          title: "3L",
          minLevel: 1,
          missingAuraWarning: false,
          gems: [
            { gemId: "1", name: "Fireball", color: "B", isSupport: false, verifiedSocketed: false, unlinkedWarning: false },
            { gemId: "2", name: "Leap Slam", color: "R", isSupport: false, verifiedSocketed: false, unlinkedWarning: false },
            { gemId: "3", name: "Pierce", color: "G", isSupport: true, verifiedSocketed: false, unlinkedWarning: false },
          ],
        },
      ],
      currentAct: 1,
    });
    expect(regex.length).toBeLessThanOrEqual(50);
    expect(regex).toContain("r-g-b");

    let lab = parsePoelabDailyJson(
      JSON.stringify({
        difficulty: "Normal",
        rooms: [
          { id: "1", name: "Estate Path", exits: ["2"], contents: ["darkshrine"] },
          { id: "2", name: "Sepulchre Halls", exits: ["3"], contents: ["golden-door"] },
        ],
      }),
    );
    lab = advanceLabRoomBySeed(lab, "1_Labyrinth_1", "777", new Map());
    expect(lab.currentRoomId).toBe("2");
    expect(lab.rooms[1]?.hasGoldenDoor).toBe(true);
  });

  it("parses GGG {description} mod objects, ignores inactive Purity of Elements gems, and matches single passive skill point logs", () => {
    const objectModItems: GggItemModRecord[] = [
      {
        inventoryId: "Helm",
        typeLine: "Siege Helmet",
        explicitMods: [
          { description: "+19 to Intelligence" },
          { description: "+23% to Fire Resistance", flags: { crafted: true } },
        ],
      },
      {
        inventoryId: "Gloves",
        typeLine: "Strapped Mitts",
        explicitMods: [{ description: "+16% to Cold Resistance" }],
        socketedItems: [
          {
            socket: 0,
            typeLine: "Purity of Elements",
            frameType: 4,
            explicitMods: [{ description: "You and nearby allies gain +27% to all Elemental Resistances" }],
          },
        ],
      },
      {
        inventoryId: "Offhand",
        typeLine: "Layered Kite Shield",
        properties: [{ name: "Chance to Block", values: [["24%", 0]] }],
        implicitMods: [{ description: "+8% to all Elemental Resistances" }],
        explicitMods: [{ description: "+5% to all Elemental Resistances" }],
      },
      {
        inventoryId: "Boots",
        typeLine: "Goliath Greaves",
        explicitMods: [
          { description: "+23% to Lightning Resistance" },
          { description: "20% increased Movement Speed" },
        ],
      },
      {
        inventoryId: "Ring",
        typeLine: "Two-Stone Ring",
        implicitMods: [{ description: "+12% to Fire and Lightning Resistances" }],
      },
    ];

    const res = estimateEquippedResistances({
      items: objectModItems,
      passiveItems: [
        {
          inventoryId: "PassiveJewels",
          typeLine: "Crimson Jewel",
          explicitMods: [{ description: "+10% to Chaos Resistance" }],
        },
      ],
      wickermanItems: [
        {
          inventoryId: "WickermanHead",
          typeLine: "Lesser Spectral Hood",
          explicitMods: [{ description: "+11% to Chaos Resistance" }],
        },
      ],
      allocatedNodeIds: [1593, 58218, 7023],
      allocatedMasteries: { "7023": "38814" },
      bandit: "None",
      highestUnlockedAct: 7,
      completedBossFlags: ["kitava_act5"],
      adapter: poe1GameAdapter,
    });

    // Fire: 23 (helm) + 13 (shield) + 12 (ring) + 3 (shield node) - 30 (Cold Mastery 38814) - 30 (Kitava) = -9
    // Cold: 16 (gloves) + 13 (shield) + 3 (shield node) - 30 (Kitava) = 2
    // Light: 13 (shield) + 23 (boots) + 12 (ring) + 3 (shield node) - 30 (Kitava) = 21
    // Chaos: 10 (jewel) + 11 (wickerman) + 8 (Purity of Flesh node) - 30 (Kitava) = -1
    expect(res.kitavaPenalty).toBe(-30);
    expect(res.fire.actual).toBe(-9);
    expect(res.cold.actual).toBe(2);
    expect(res.lightning.actual).toBe(21);
    expect(res.chaos.actual).toBe(-1);

    const hygiene = auditGearAndFlaskHygiene({
      items: objectModItems,
      characterLevel: 56,
      highestUnlockedAct: 7,
      isAttackBuild: false,
    });
    expect(hygiene.some((i) => i.id === "boots_0ms")).toBe(false);

    const passiveLog = parseClientLogLine(
      "2026/11/14 18:15:19 535003593 cffb06be [INFO Client 38840] : You have received a Passive Skill Point.",
    );
    expect(passiveLog).toEqual({ type: "skill_points_received", count: 1 });
  });

  it("verifies all skillSets with live socket state while limiting warnings to the level-active set", () => {
    const sets = [
      {
        id: "set_lv1",
        title: "Act 1",
        minLevel: 1,
        groups: [{ title: "Starter", slotLabel: "Weapon", note: "Keep 3B", gems: [{ gemId: "fb", name: "Fireball", isSupport: false, requiredLevel: 1, attribute: "intelligence" }] }],
      },
      {
        id: "set_lv24",
        title: "Act 3",
        minLevel: 24,
        groups: [
          { title: "Main", slotLabel: "Weapon", gems: [{ gemId: "fb", name: "Fireball", isSupport: false, requiredLevel: 1, attribute: "intelligence" }, { gemId: "comb", name: "Combustion Support", isSupport: true, requiredLevel: 8, attribute: "intelligence" }] },
          { title: "Auras", slotLabel: "Helm", gems: [{ gemId: "det", name: "Determination", isSupport: false, requiredLevel: 24, attribute: "strength" }] },
        ],
      },
    ];
    const initial = buildInitialTargetSkillSets(sets);
    expect(initial.map((s) => s.id)).toEqual(["set_lv1", "set_lv24"]);
    expect(initial[0]?.groups[0]?.note).toBe("Keep 3B");

    const lowLevel = verifySocketsAndGems({ items: SAMPLE_GGG_ITEMS, skillSets: sets, gemSteps: [], characterLevel: 10 });
    expect(lowLevel.skillSets).toHaveLength(2);
    expect(lowLevel.skillSets[0]?.groups[0]?.gems[0]?.verifiedSocketed).toBe(true);
    expect(lowLevel.skillSets[1]?.groups[0]?.gems[1]?.unlinkedWarning).toBe(true);
    expect(lowLevel.unlinkedWarnings).toHaveLength(0);
    expect(lowLevel.missingAuraWarnings).toHaveLength(0);

    const highLevel = verifySocketsAndGems({ items: SAMPLE_GGG_ITEMS, skillSets: sets, gemSteps: [], characterLevel: 26 });
    expect(highLevel.linkGroups).toEqual(highLevel.skillSets[1]?.groups);
    expect(highLevel.unlinkedWarnings).toHaveLength(1);
    expect(highLevel.missingAuraWarnings).toHaveLength(1);
  });
});
