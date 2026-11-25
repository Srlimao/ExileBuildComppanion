import type { HudSessionSnapshot, TargetItemSlotSummary } from "@exile-hud/core";
import { poe1GameAdapter, poe2GameAdapter } from "@exile-hud/game-data";
import {
  GearHygieneWidget,
  HudI18nProvider,
  HUD_WIDGET_MESSAGES,
  normalizeItemSetToPaperDoll,
  summarizeGearSlotLabel,
} from "@exile-hud/hud-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

function makeSlot(overrides: Partial<TargetItemSlotSummary>): TargetItemSlotSummary {
  return {
    slotName: "Helmet",
    itemId: "1",
    itemName: "Test Item",
    baseType: "Leather Cap",
    rarity: "rare",
    sockets: "",
    levelReq: 1,
    mods: [],
    ...overrides,
  };
}

function makeTestSnapshot(gameId: "poe1" | "poe2"): HudSessionSnapshot {
  const isPoe2 = gameId === "poe2";
  const slots: TargetItemSlotSummary[] = [
    makeSlot({
      slotName: "Weapon 1",
      itemName: isPoe2 ? "Frostbite Stave" : "Tempest Branch",
      baseType: isPoe2 ? "Crescent Quarterstaff" : "Driftwood Wand",
      sockets: isPoe2 ? "RUNE:2(1)" : "B-B-G",
      mods: ["+1 to Level of all Cold Spell Skills", "28% increased Spell Damage"],
    }),
    makeSlot({
      slotName: "Weapon 1 Swap",
      itemName: "Chiming Staff",
      baseType: "Chiming Staff",
      mods: ["Grants Skill: Level 10 Sigil of Power"],
    }),
    makeSlot({
      slotName: "Helmet",
      itemName: "Goldrim",
      baseType: isPoe2 ? "Felt Cap" : "Leather Cap",
      rarity: "unique",
      verifiedEquipped: true,
      mods: ["+35% to all Elemental Resistances"],
    }),
    makeSlot({
      slotName: "Body Armour",
      itemName: isPoe2 ? "Enfolding Dawn" : "Tabula Rasa",
      baseType: isPoe2 ? "Pilgrim Vestments" : "Simple Robe",
      rarity: "unique",
      sockets: isPoe2 ? "S S" : "W-W-W-W-W-W",
      mods: [isPoe2 ? "+100 to Spirit" : "6-Link White Sockets"],
    }),
    makeSlot({
      slotName: "Boots",
      itemName: "Gale Stride",
      baseType: "Mesh Boots",
      mods: ["+42 to maximum Life", "+20% to Fire Resistance", "Adds 3 to 7 Cold Damage"],
    }),
    makeSlot({
      slotName: isPoe2 ? "Life Flask" : "Flask 1",
      itemName: "Bubbling Life Flask",
      baseType: "Greater Life Flask",
      rarity: "magic",
      mods: ["50% of Recovery applied Instantly", "Immunity to Bleeding"],
    }),
    makeSlot({
      slotName: "Jewel 1",
      itemName: "Survival Secrets",
      baseType: "Crimson Jewel",
      rarity: "unique",
      mods: ["+10% to all Elemental Resistances"],
    }),
  ];

  if (isPoe2) {
    slots.push(
      makeSlot({ slotName: "Charm 1", itemName: "Thawing Charm", baseType: "Thawing Charm", rarity: "magic", mods: ["Used when you become Frozen"] }),
      makeSlot({ slotName: "Mana Flask", itemName: "Colossal Mana Flask", baseType: "Colossal Mana Flask", rarity: "magic", mods: ["Recovers 260 Mana"] }),
    );
  } else {
    slots.push(makeSlot({ slotName: "Flask 2", itemName: "Quicksilver Flask", baseType: "Quicksilver Flask", rarity: "magic", mods: ["40% increased Movement Speed"] }));
  }

  return {
    version: 1,
    gameId,
    roomId: "TEST",
    profileId: "prof-paper-doll",
    buildName: isPoe2 ? "Invoker Test" : "Elementalist Test",
    characterClass: isPoe2 ? "Monk" : "Witch",
    ascendancyName: isPoe2 ? "Invoker" : "Elementalist",
    characterName: "Tester",
    characterLevel: 32,
    isEndgameOnlyFallback: false,
    fallbackNotice: null,
    leagueStart: true,
    poeRunning: false,
    clientLogHooked: false,
    characterSyncStatus: "UNCONFIGURED",
    lastCharacterSyncAt: null,
    mode: "TOWN",
    currentAreaId: isPoe2 ? "G2_town" : "1_3_town",
    currentAreaName: isPoe2 ? "The Ardura Caravan" : "The Sarn Encampment",
    currentAreaLevel: 24,
    currentAreaSeed: null,
    currentAct: 3,
    highestUnlockedAct: 3,
    lastCombatZoneId: null,
    lastCombatZoneName: null,
    recentDeath: false,
    resumeZoneBanner: null,
    activeVendorRegex: "",
    autoClipboardEnabled: false,
    runElapsedMs: 0,
    runTimerRunning: false,
    actSplitsMs: {},
    checkpoints: [],
    gemSteps: [],
    nextTownCurrencyBudget: { wisdom: 0, transmutation: 0, alteration: 0, chance: 0, alchemy: 0 },
    linkGroups: [],
    itemSets: [{ id: "set_1", title: "Campaign Set", minLevel: 20, slots }],
    resistances: { source: "ACT_TARGET_FALLBACK", kitavaPenalty: 0, fire: { actual: 50, target: 50 }, cold: { actual: 50, target: 50 }, lightning: { actual: 50, target: 50 }, chaos: { actual: 0, target: 0 }, upcomingBossWarning: null },
    gearHygiene: [{ id: "boots_0ms", severity: "warn", slot: "boots", message: "Boots have 0% Movement Speed in Act 3." }],
    benchCraftSuggestions: isPoe2 ? [] : [{ id: "bench_gloves_res", priority: "high", problemSummary: "Fire Res -12% under cap", prescription: "Craft 16-20% Fire Res on Gloves", slot: "Gloves", recipeId: "HelenaFire1", recipeLabel: "+Fire Res", costLabel: "1x Orb of Transmutation", affixType: "suffix" }],
    runeSuggestions: isPoe2 ? [{ id: "rune_desert", priority: "high", problemSummary: "Fire Res below target", runeName: "Desert Rune", slotHint: "Helmet", effectLabel: "+12% Fire Res" }] : [],
    passiveTree: { specName: "Main", targetNodeCount: 0, allocatedTargetCount: 0, remainingNodeIds: [], remainingNotableNames: [], respecPointsNeeded: 0, targetNodesPreview: [] },
    lab: { hasDailyLayout: false, difficultyLabel: "Normal", currentRoomId: null, currentRoomName: null, rooms: [], completedTrialAreaIds: [] },
    zoneLayoutPaths: [],
  };
}

describe("gear_paper_doll_widget", () => {
  it("summarizes uniques by name and non-uniques by baseType + prioritized 1-line summary", () => {
    expect(summarizeGearSlotLabel(makeSlot({ rarity: "unique", itemName: "Enfolding Dawn", baseType: "Pilgrim Vestments" }))).toEqual({
      primaryLabel: "Enfolding Dawn",
      secondaryLabel: null,
      isUnique: true,
    });
    expect(summarizeGearSlotLabel(makeSlot({ itemName: "Soul Spire", baseType: "Chiming Staff", mods: ["Grants Skill: Level 10 Sigil of Power", "+2 to Level of all Spell Skills"] }))).toEqual({
      primaryLabel: "Chiming Staff",
      secondaryLabel: "Skill: Sigil of Power",
      isUnique: false,
    });
    expect(summarizeGearSlotLabel(makeSlot({ itemName: "Gale Stride", baseType: "Mesh Boots", mods: ["+42 to maximum Life", "+22% to Fire Resistance", "Adds 3 to 7 Cold Damage to Attacks"] }))).toEqual({
      primaryLabel: "Mesh Boots",
      secondaryLabel: "LIFE+RES+DMG",
      isUnique: false,
    });
    expect(summarizeGearSlotLabel(makeSlot({ slotName: "Flask 1", rarity: "magic", itemName: "Bubbling Greater Life Flask", baseType: "Greater Life Flask", mods: ["50% of Recovery applied Instantly", "Immunity to Bleeding"] }))).toEqual({
      primaryLabel: "Greater Life Flask",
      secondaryLabel: "INSTANT+BLEED",
      isUnique: false,
    });
  });

  it("normalizes PoE 1 & PoE 2 slots, weapon swaps, extras, and anchored alerts", () => {
    const poe1Snap = makeTestSnapshot("poe1");
    const poe1Model = normalizeItemSetToPaperDoll({
      itemSet: poe1Snap.itemSets![0]!,
      gameId: "poe1",
      hygiene: poe1Snap.gearHygiene,
      crafts: poe1Snap.benchCraftSuggestions ?? [],
      runes: [],
    });
    expect(poe1Model.primarySlots.helmet?.itemName).toBe("Goldrim");
    expect(poe1Model.primarySlots.flask1?.baseType).toBe("Greater Life Flask");
    expect(poe1Model.primarySlots.flask2?.baseType).toBe("Quicksilver Flask");
    expect(poe1Model.hasWeaponSet2).toBe(true);
    expect(poe1Model.extras.map((e) => e.slot.itemName)).toEqual(["Survival Secrets"]);
    expect(poe1Model.alertsBySlot.boots?.hygiene[0]?.id).toBe("boots_0ms");
    expect(poe1Model.alertsBySlot.gloves?.crafts[0]?.id).toBe("bench_gloves_res");

    const poe2Snap = makeTestSnapshot("poe2");
    const poe2Model = normalizeItemSetToPaperDoll({
      itemSet: poe2Snap.itemSets![0]!,
      gameId: "poe2",
      hygiene: poe2Snap.gearHygiene,
      crafts: [],
      runes: poe2Snap.runeSuggestions ?? [],
    });
    expect(poe2Model.primarySlots.flask1?.baseType).toBe("Greater Life Flask");
    expect(poe2Model.primarySlots.charm1?.itemName).toBe("Thawing Charm");
    expect(poe2Model.primarySlots.flask2?.baseType).toBe("Colossal Mana Flask");
    expect(poe2Model.alertsBySlot.helmet?.runes[0]?.runeName).toBe("Desert Rune");
  });

  it("resolves official 2D unique art URLs for both PoE 1 and PoE 2", () => {
    expect(poe1GameAdapter.resolveOfficialUniqueIconUrl("Goldrim")).toBeTruthy();
    expect(poe2GameAdapter.resolveOfficialUniqueIconUrl("Enfolding Dawn")).toContain("cdn.poe2db.tw/image/Art/2DItems/");
  });

  it("renders shared paper-doll UI in SSR for both PoE 1 and PoE 2 with en/pt-BR parity", () => {
    expect(Object.keys(HUD_WIDGET_MESSAGES.en.gearPaperDoll).sort()).toEqual(Object.keys(HUD_WIDGET_MESSAGES["pt-BR"].gearPaperDoll).sort());

    const poe1Markup = renderToStaticMarkup(createElement(HudI18nProvider, null, createElement(GearHygieneWidget, { snapshot: makeTestSnapshot("poe1") })));
    expect(poe1Markup).toContain("Goldrim");
    expect(poe1Markup).toContain("Mesh Boots");
    expect(poe1Markup).toContain("LIFE+RES+DMG");
    expect(poe1Markup).toContain("Flask 5");

    const poe2Markup = renderToStaticMarkup(createElement(HudI18nProvider, null, createElement(GearHygieneWidget, { snapshot: makeTestSnapshot("poe2") })));
    expect(poe2Markup).toContain("Enfolding Dawn");
    expect(poe2Markup).toContain("Talismãs");
    expect(poe2Markup).toContain("Greater Life Flask");
    expect(poe2Markup).toContain("Colossal Mana Flask");
  });

  it("normalizes raw GGG PoE 2 indexed slots (Helm1, BodyArmour1, Offhand1/2, Weapon2) & Stat Priority summaries", () => {
    const rawIndexedSet = {
      id: "ggg_raw",
      title: "Titan Warrior",
      minLevel: 1,
      slots: [
        makeSlot({ slotName: "Weapon1", itemName: "Any Two Handed Mace", baseType: "Any Two Handed Mace", mods: ["1. Prioritize highest physical dps"] }),
        makeSlot({ slotName: "Offhand1", itemName: "Tower Shield", baseType: "Tower Shield", mods: ["1. Increased Armour"] }),
        makeSlot({ slotName: "Weapon2", itemName: "Weapon Swap Staff", baseType: "Weapon Swap Staff", mods: ["1. Level of all spell skills"] }),
        makeSlot({ slotName: "Offhand2", itemName: "Crystal Focus", baseType: "Crystal Focus", mods: ["1. Energy Shield"] }),
        makeSlot({ slotName: "BodyArmour1", itemName: "Armour (Str Base)", baseType: "Armour (Str Base)", mods: ["1. Increased Health", "2. Increased Resistances", "3. Increased Armour"] }),
        makeSlot({ slotName: "Helm1", itemName: "Armour (Str Base)", baseType: "Armour (Str Base)", mods: ["1. Increased Health", "2. Increased Resistances"] }),
        makeSlot({ slotName: "Gloves1", itemName: "Armour (Str Base)", baseType: "Armour (Str Base)", mods: ["1. Increased Attack Speed", "2. Flat damage to attacks", "3. Increased Life"] }),
        makeSlot({ slotName: "Boots1", itemName: "Armour (Str Base)", baseType: "Armour (Str Base)", mods: ["1. Increased Movement Speed", "2. Increased Health"] }),
        makeSlot({ slotName: "Belt1", itemName: "Any Belt", baseType: "Any Belt", mods: ["1. Increased Health", "2. Increased Resistances"] }),
        makeSlot({ slotName: "Amulet1", itemName: "Any Amulet", baseType: "Any Amulet", mods: ["1. Level of all melee skills", "2. Increased Resistances", "3. Increased Intelligence"] }),
        makeSlot({ slotName: "LifeFlask1", itemName: "Life Flask", baseType: "Life Flask", mods: ["Recovers Life"] }),
        makeSlot({ slotName: "ManaFlask1", itemName: "Mana Flask", baseType: "Mana Flask", mods: ["Recovers Mana"] }),
        makeSlot({ slotName: "BeltCharm1", itemName: "Thawing Charm", baseType: "Thawing Charm", rarity: "magic", mods: ["Freeze Immunity"] }),
      ],
    };

    const model = normalizeItemSetToPaperDoll({ itemSet: rawIndexedSet, gameId: "poe2", hygiene: [], crafts: [], runes: [] });
    expect(model.extras).toEqual([]);
    expect(model.primarySlots.helmet?.baseType).toBe("Armour (Str Base)");
    expect(model.primarySlots.body?.baseType).toBe("Armour (Str Base)");
    expect(model.primarySlots.weapon2?.baseType).toBe("Tower Shield");
    expect(model.weaponSwapSlots.weapon1?.baseType).toBe("Weapon Swap Staff");
    expect(model.weaponSwapSlots.weapon2?.baseType).toBe("Crystal Focus");
    expect(model.primarySlots.flask1?.baseType).toBe("Life Flask");
    expect(model.primarySlots.flask2?.baseType).toBe("Mana Flask");
    expect(model.primarySlots.charm1?.itemName).toBe("Thawing Charm");
    expect(summarizeGearSlotLabel(model.primarySlots.body!).secondaryLabel).toBe("LIFE+RES+ARM");
    expect(summarizeGearSlotLabel(model.primarySlots.amulet!).secondaryLabel).toBe("+LVL+RES+ATTR");
    expect(summarizeGearSlotLabel(model.primarySlots.gloves!).secondaryLabel).toBe("ASPD+LIFE+DMG");
  });

  it("places duplicate Flask 1 and Trinket1 slots into PoE 2 Flask & Charm tray instead of Jewels", () => {
    const legacySavedSet = {
      id: "saved_dup",
      title: "Varashta Saved",
      minLevel: 1,
      slots: [
        makeSlot({ slotName: "Flask 1", itemName: "Flask 1", baseType: "Flask 1", mods: ["Giant Mana Flask"] }),
        makeSlot({ slotName: "Flask 1", itemName: "Flask 1", baseType: "Flask 1", mods: ["Grand Life Flask"] }),
        makeSlot({ slotName: "Trinket1", itemName: "Trinket1", baseType: "Trinket1", mods: ["Staunching Charm"] }),
        makeSlot({ slotName: "Trinket1", itemName: "Trinket1", baseType: "Trinket1", mods: ["Thawing Charm"] }),
        makeSlot({ slotName: "Trinket1", itemName: "Trinket1", baseType: "Trinket1", mods: ["Antidote Charm"] }),
      ],
    };
    const model = normalizeItemSetToPaperDoll({ itemSet: legacySavedSet, gameId: "poe2", hygiene: [], crafts: [], runes: [] });
    expect(model.extras).toEqual([]);
    expect(model.primarySlots.flask1?.mods[0]).toBe("Grand Life Flask");
    expect(model.primarySlots.flask2?.mods[0]).toBe("Giant Mana Flask");
    expect(model.primarySlots.charm1?.mods[0]).toBe("Staunching Charm");
    expect(model.primarySlots.charm2?.mods[0]).toBe("Thawing Charm");
    expect(model.primarySlots.charm3?.mods[0]).toBe("Antidote Charm");
    expect(summarizeGearSlotLabel(model.primarySlots.flask1!).primaryLabel).toBe("Grand Life Flask");
    expect(summarizeGearSlotLabel(model.primarySlots.charm1!).primaryLabel).toBe("Staunching Charm");
  });
});
