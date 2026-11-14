import { describe, expect, it } from "vitest";
import {
  buildVendorSearchRegex,
  computeNextTownCurrencyBudget,
  verifySocketsAndGems,
  type GemAcquisitionStep,
  type GggItemModRecord,
} from "../src/index.js";

const makeGemStep = (
  gemName: string,
  act: number,
  currencyCost: GemAcquisitionStep["currencyCost"],
  isSupport = false,
): GemAcquisitionStep => ({
  id: `gem_${gemName.toLowerCase().replace(/\s+/g, "_")}`,
  gemId: `Metadata/Items/Gems/${gemName}`,
  gemName,
  attribute: "intelligence",
  requiredLevel: act === 1 ? 10 : 24,
  isSupport,
  acquisitionType: "VENDOR_BUY",
  questId: "a1q1",
  questName: "Enemy at the Gate",
  act,
  npcName: "Nessa",
  currencyCost,
  count: 1,
  note: "Main",
  verifiedByApi: false,
  softAcquired: false,
  manualCompleted: false,
});

const makeGemRef = (name: string, attribute: string, isSupport = false, requiredLevel = 1) => ({
  gemId: `id_${name.toLowerCase().replace(/\s+/g, "_")}`,
  name,
  isSupport,
  requiredLevel,
  attribute,
});

describe("Backpack & Weapon-Swap Gem Detection", () => {
  it("detects loose and spare-gear gems in MainInventory without marking them actively socketed", () => {
    const items: GggItemModRecord[] = [
      { inventoryId: "MainInventory", frameType: 4, baseType: "Fireball", typeLine: "Superior Fireball" },
      {
        inventoryId: "MainInventory",
        frameType: 4,
        baseType: "Vaal Determination",
        typeLine: "Superior Vaal Determination",
        hybrid: { isVaalGem: true, baseTypeName: "Determination" },
      },
      {
        inventoryId: "MainInventory",
        frameType: 2,
        typeLine: "Scholar's Robe",
        sockets: [{ group: 0, attr: "I", sColour: "B" }],
        socketedItems: [{ socket: 0, typeLine: "Clarity", frameType: 4, support: false }],
      },
      { inventoryId: "MainInventory", frameType: 2, typeLine: "Leather Belt" },
    ];

    const verification = verifySocketsAndGems({
      items,
      skillSets: [{
        id: "set1",
        title: "Setup",
        minLevel: 1,
        groups: [
          {
            title: "3L Setup",
            slotLabel: "Weapon",
            gems: [
              makeGemRef("Fireball", "intelligence"),
              makeGemRef("Shield Charge", "strength", false, 4),
              makeGemRef("Pierce Support", "dexterity", true),
            ],
          },
          {
            title: "Aura Setup",
            slotLabel: "Helm",
            gems: [makeGemRef("Determination", "strength", false, 24)],
          },
        ],
      }],
      gemSteps: [
        makeGemStep("Fireball", 1, "transmutation"),
        makeGemStep("Determination", 1, "transmutation"),
        makeGemStep("Clarity", 1, "transmutation"),
        makeGemStep("Grace", 1, "alteration"),
      ],
      characterLevel: 24,
    });

    const byName = new Map(verification.updatedGemSteps.map((s) => [s.gemName, s]));
    expect(byName.get("Fireball")?.acquiredLocation).toBe("backpack");
    expect(byName.get("Determination")?.acquiredLocation).toBe("backpack");
    expect(byName.get("Clarity")?.acquiredLocation).toBe("backpack");
    expect(byName.get("Fireball")?.verifiedByApi).toBe(true);
    expect(byName.get("Grace")?.verifiedByApi).toBe(false);
    expect(byName.get("Grace")?.acquiredLocation).toBeUndefined();

    expect(verification.linkGroups[0]?.gems[0]?.verifiedSocketed).toBe(false);
    expect(verification.linkGroups[0]?.gems[0]?.reserveLocation).toBe("backpack");
    expect(verification.missingAuraWarnings).toContain(
      'Target aura "Determination" is in your backpack (not socketed in active gear).',
    );

    const budget = computeNextTownCurrencyBudget(verification.updatedGemSteps, 1);
    expect(budget.transmutation).toBe(0);
    expect(budget.alteration).toBe(1);

    const regex = buildVendorSearchRegex({
      gemSteps: verification.updatedGemSteps,
      linkGroups: verification.linkGroups,
      currentAct: 1,
    });
    expect(regex).toContain("r-g-b");
    expect(regex).toContain("grace");
    expect(regex).not.toContain("fireb");
    expect(regex).not.toContain("deter");
    expect(regex).not.toContain("clari");
  });

  it("detects weapon-swap gems without unlinked warnings and prioritizes primary equipped slots", () => {
    const items: GggItemModRecord[] = [
      { inventoryId: "MainInventory", frameType: 4, typeLine: "Fireball" },
      {
        inventoryId: "Weapon2",
        typeLine: "Driftwood Wand",
        sockets: [{ group: 0, attr: "I", sColour: "B" }, { group: 1, attr: "S", sColour: "R" }],
        socketedItems: [
          { socket: 0, typeLine: "Combustion Support", support: true },
          { socket: 1, typeLine: "Determination", support: false },
          { socket: 2, typeLine: "Abyssal Eye", frameType: 2, abyssJewel: true },
        ],
      },
      {
        inventoryId: "Weapon",
        typeLine: "Goat's Horn",
        sockets: [{ group: 0, attr: "I", sColour: "B" }],
        socketedItems: [{ socket: 0, typeLine: "Fireball", support: false }],
      },
    ];

    const verification = verifySocketsAndGems({
      items,
      skillSets: [{
        id: "set1",
        title: "Swap Test",
        minLevel: 1,
        groups: [
          {
            title: "Main Skill",
            slotLabel: "Weapon",
            gems: [makeGemRef("Fireball", "intelligence"), makeGemRef("Combustion Support", "intelligence", true, 8)],
          },
          {
            title: "Aura",
            slotLabel: "Body Armour",
            gems: [makeGemRef("Determination", "strength", false, 24)],
          },
        ],
      }],
      gemSteps: [makeGemStep("Fireball", 1, "wisdom"), makeGemStep("Combustion Support", 1, "transmutation", true)],
      characterLevel: 24,
    });

    const fbStep = verification.updatedGemSteps.find((s) => s.gemName === "Fireball");
    const combStep = verification.updatedGemSteps.find((s) => s.gemName === "Combustion Support");
    expect(fbStep?.verifiedByApi).toBe(true);
    expect(fbStep?.acquiredLocation).toBe("equipped");
    expect(combStep?.verifiedByApi).toBe(true);
    expect(combStep?.acquiredLocation).toBe("weapon_swap");

    const fbLink = verification.linkGroups[0]?.gems[0];
    const combLink = verification.linkGroups[0]?.gems[1];
    expect(fbLink?.verifiedSocketed).toBe(true);
    expect(fbLink?.reserveLocation).toBeUndefined();
    expect(combLink?.verifiedSocketed).toBe(false);
    expect(combLink?.reserveLocation).toBe("weapon_swap");
    expect(combLink?.unlinkedWarning).toBe(false);

    expect(verification.unlinkedWarnings).toHaveLength(0);
    expect(verification.missingAuraWarnings).toEqual([
      'Target aura "Determination" is in weapon swap (inactive in main gear).',
    ]);
  });
});
