import { createEmptyCampaignProgress, type HudSessionSnapshot, type TargetLinkGroupSummary } from "@exile-hud/core";
import { HudI18nProvider, partitionLinkGroupGems, SocketLinksWidget } from "@exile-hud/hud-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

function makeBaseSnapshot(
  gameId: "poe1" | "poe2",
  linkGroups: TargetLinkGroupSummary[],
): HudSessionSnapshot {
  return {
    version: 1,
    gameId,
    roomId: "TEST",
    profileId: "prof-1",
    buildName: "Test Build",
    characterClass: "Witch",
    ascendancyName: "Elementalist",
    characterName: "Tester",
    characterLevel: 32,
    isEndgameOnlyFallback: false,
    fallbackNotice: null,
    leagueStart: true,
    poeRunning: false,
    clientLogHooked: false,
    characterSyncStatus: "UNCONFIGURED",
    lastCharacterSyncAt: null,
    mode: "FIELD",
    currentAreaId: "1_3_1",
    currentAreaName: "The City of Sarn",
    currentAreaLevel: 23,
    currentAreaSeed: "1",
    currentAct: 3,
    highestUnlockedAct: 3,
    lastCombatZoneId: "1_3_1",
    lastCombatZoneName: "The City of Sarn",
    recentDeath: false,
    resumeZoneBanner: null,
    activeVendorRegex: "",
    autoClipboardEnabled: true,
    runElapsedMs: 0,
    runTimerRunning: false,
    actSplitsMs: {},
    checkpoints: [],
    gemSteps: [],
    nextTownCurrencyBudget: { wisdom: 0, transmutation: 0, alteration: 0, chance: 0, alchemy: 0 },
    linkGroups,
    resistances: {
      source: "ACT_TARGET_FALLBACK",
      kitavaPenalty: 0,
      fire: { actual: 75, target: 75 },
      cold: { actual: 75, target: 75 },
      lightning: { actual: 75, target: 75 },
      chaos: { actual: 0, target: 0 },
      upcomingBossWarning: null,
    },
    gearHygiene: [],
    passiveTree: {
      specName: "Main",
      targetNodeCount: 0,
      allocatedTargetCount: 0,
      remainingNodeIds: [],
      remainingNotableNames: [],
      respecPointsNeeded: 0,
      targetNodesPreview: [],
    },
    lab: {
      hasDailyLayout: false,
      difficultyLabel: "Normal",
      currentRoomId: null,
      currentRoomName: null,
      rooms: [],
      completedTrialAreas: [],
      missingTrialAreas: [],
    },
    progress: createEmptyCampaignProgress(1000),
    updatedAt: 1000,
  };
}

describe("socket_links_unified_widget", () => {
  it("partitions active skill first and falls back to the first gem when no active skill exists", () => {
    const poe1Group: TargetLinkGroupSummary = {
      title: "Body Armour",
      minLevel: 12,
      missingAuraWarning: false,
      gems: [
        { gemId: "sup1", name: "Lifetap", color: "R", isSupport: true, verifiedSocketed: true, unlinkedWarning: false },
        { gemId: "act1", name: "Righteous Fire", color: "B", isSupport: false, verifiedSocketed: true, unlinkedWarning: false },
        { gemId: "act2", name: "Fire Trap", color: "G", isSupport: false, verifiedSocketed: false, reserveLocation: "backpack", unlinkedWarning: false },
      ],
    };
    const p1 = partitionLinkGroupGems(poe1Group, false);
    expect(p1.primaryGems.map((g) => g.name)).toEqual(["Righteous Fire"]);
    expect(p1.linkedGems.map((g) => g.name)).toEqual(["Fire Trap", "Lifetap"]);

    const supportOnlyGroup: TargetLinkGroupSummary = {
      title: "Utility",
      minLevel: 1,
      missingAuraWarning: false,
      gems: [
        { gemId: "s1", name: "Faster Attacks", color: "G", isSupport: true, verifiedSocketed: true, unlinkedWarning: false },
        { gemId: "s2", name: "Momentum", color: "G", isSupport: true, verifiedSocketed: true, unlinkedWarning: false },
      ],
    };
    const fallback = partitionLinkGroupGems(supportOnlyGroup, false);
    expect(fallback.primaryGems.map((g) => g.name)).toEqual(["Faster Attacks"]);
    expect(fallback.linkedGems.map((g) => g.name)).toEqual(["Momentum"]);

    expect(partitionLinkGroupGems({ title: "Empty", minLevel: 1, gems: [], missingAuraWarning: false }, false)).toEqual({
      primaryGems: [],
      linkedGems: [],
      supportCount: 0,
    });
  });

  it("renders unified card layout for both PoE 1 and PoE 2 snapshots", () => {
    const poe1Html = renderToStaticMarkup(
      createElement(
        HudI18nProvider,
        null,
        createElement(SocketLinksWidget, {
          snapshot: makeBaseSnapshot("poe1", [
            {
              title: "Body Armour",
              minLevel: 28,
              missingAuraWarning: true,
              gems: [
                { gemId: "rf", name: "Righteous Fire", color: "B", isSupport: false, verifiedSocketed: true, unlinkedWarning: false },
                { gemId: "ef", name: "Elemental Focus", color: "B", isSupport: true, verifiedSocketed: true, unlinkedWarning: true },
                { gemId: "bs", name: "Burning Damage", color: "R", isSupport: true, verifiedSocketed: false, reserveLocation: "weapon_swap", unlinkedWarning: false },
              ],
            },
          ]),
        }),
      ),
    );
    expect(poe1Html).toContain("Righteous Fire");
    expect(poe1Html).toContain("Body Armour");
    expect(poe1Html).toContain("3L");
    expect(poe1Html).toContain("Elemental Focus");
    expect(poe1Html).toContain("SWAP");
    expect(poe1Html).toContain("!");

    const poe2Html = renderToStaticMarkup(
      createElement(
        HudI18nProvider,
        null,
        createElement(SocketLinksWidget, {
          snapshot: makeBaseSnapshot("poe2", [
            {
              title: "Main Clear",
              minLevel: 1,
              missingAuraWarning: false,
              gems: [
                { gemId: "is", name: "Ice Strike", color: "G", isSupport: false, verifiedSocketed: false, unlinkedWarning: false },
                { gemId: "ma", name: "Martial Tempo", color: "G", isSupport: true, verifiedSocketed: false, unlinkedWarning: false },
              ],
            },
          ]),
        }),
      ),
    );
    expect(poe2Html).toContain("Ice Strike");
    expect(poe2Html).toContain("Martial Tempo");
  });
});
