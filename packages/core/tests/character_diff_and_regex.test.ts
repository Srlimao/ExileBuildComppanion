import { describe, expect, it } from "vitest";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  auditGearAndFlaskHygiene,
  buildVendorSearchRegex,
  computePassiveTreeDiff,
  estimateEquippedResistances,
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
});
