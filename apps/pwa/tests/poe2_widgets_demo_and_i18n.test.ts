import { buildTwinkGearTimeline, detectTwinkArchetype } from "@exile-hud/core";
import { poe2GameAdapter } from "@exile-hud/game-data";
import {
  getDefaultLayoutForMode,
  getLocalizedWidgetCatalog,
  POE2_SURFACE_MESSAGES,
} from "@exile-hud/hud-ui";
import { describe, expect, it } from "vitest";
import { createPoe2DemoSnapshot } from "../src/features/pairing_and_connection/demo_poe2_snapshot_factory.js";

describe("poe2_widgets_demo_and_i18n", () => {
  it("builds a rich PoE 2 Monk demo snapshot with Spirit budget, permanent bonuses, runes, landmarks & Weapon Sets", async () => {
    const snap = await createPoe2DemoSnapshot();

    expect(snap.gameId).toBe("poe2");
    expect(snap.leagueStart).toBe(false);
    expect(snap.currentAreaId).toBe("G2_2");
    expect(snap.currentAct).toBe(2);
    expect(snap.poe2SpiritSummary).toEqual({
      requiredSpirit: 90,
      unlockedSpirit: 30,
      campaignGuaranteedSpirit: 100,
    });
    expect(snap.permanentBonuses?.find((b) => b.id === "poe2_a1_king_mists")?.completed).toBe(true);
    expect((snap.runeSuggestions ?? []).length).toBeGreaterThan(0);

    const landmark = poe2GameAdapter.getZoneLandmarkHints(snap.currentAreaId);
    expect(landmark?.bossTipEn).toContain("Balbala");
    expect(landmark?.bossTipPtBr).toContain("Balbala");

    expect(snap.passiveTree.targetNodeCount).toBeGreaterThan(0);
    expect(snap.passiveTree.specs?.[0]?.weaponSet1NodeIds).toEqual(["20024", "44223"]);
    expect(snap.passiveTree.specs?.[0]?.weaponSet2NodeIds).toEqual(["7576", "33866"]);
  });

  it("maintains full pt-BR and en key parity for all PoE 2 surface messages and functions", () => {
    const pt = POE2_SURFACE_MESSAGES["pt-BR"];
    const en = POE2_SURFACE_MESSAGES.en;

    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    for (const bundle of [pt, en]) {
      expect(bundle.spiritBudgetLabel(30, 90, 100)).toContain("30/90");
      expect(bundle.spiritDeficitHint(60)).toContain("60");
      expect(bundle.uncutTierBadge(5)).toContain("5");
      expect(bundle.spiritCostBadge(30)).toContain("30");
      expect(bundle.jewellerTierLabel(2).length).toBeGreaterThan(3);
      expect(bundle.jewellerTierLabel(3).length).toBeGreaterThan(3);
      expect(bundle.jewellerTierLabel(4).length).toBeGreaterThan(3);
      expect(bundle.jewellerTierLabel(5).length).toBeGreaterThan(3);
      expect(bundle.permanentBonusesCount(2, 26)).toBe("2/26");
      expect(bundle.resPenaltyBadge(-30)).toContain("-30%");
      expect(bundle.stageSummary("Interlude 1", 55, "Monk")).toContain("Interlude 1");
      expect(bundle.stageStepsTitle("Interlude 2")).toContain("Interlude 2");
      expect(bundle.allStageStepsComplete("Act 3")).toContain("Act 3");
      expect(Object.keys(bundle.trialTiers).sort()).toEqual(["1", "2", "3", "4"]);
    }
  });

  it("localizes PoE 2 widget catalogs and preserves game-aware default grid layouts", () => {
    const enPoe2 = getLocalizedWidgetCatalog("en", "poe2");
    const ptPoe2 = getLocalizedWidgetCatalog("pt-BR", "poe2");
    const enPoe1 = getLocalizedWidgetCatalog("en", "poe1");

    expect(enPoe2.find((w) => w.widgetId === "vendor_shopping")?.label).toBe("Uncut Gems & Spirit");
    expect(ptPoe2.find((w) => w.widgetId === "vendor_shopping")?.label).toBe("Gemas Brutas e Espírito");
    expect(enPoe2.find((w) => w.widgetId === "lab_compass")?.label).toBe("Ascendancy Trials");
    expect(enPoe2.find((w) => w.widgetId === "zone_layout")?.label).toBe("Zone Landmarks");
    expect(enPoe1.find((w) => w.widgetId === "vendor_shopping")?.label).toBe("Vendor & Gems");

    const poe2Field = getDefaultLayoutForMode("tablet-landscape", "FIELD", { gameId: "poe2" });
    const poe2TwinkTown = getDefaultLayoutForMode("tablet-landscape", "TOWN", {
      gameId: "poe2",
      leagueStart: false,
    });
    expect(poe2Field.some((item) => item.widgetId === "zone_layout")).toBe(true);
    expect(poe2Field.some((item) => item.widgetId === "socket_links")).toBe(true);
    expect(poe2TwinkTown.some((item) => item.widgetId === "twink_gear")).toBe(true);
  });

  it("detects PoE 2 class/ascendancy twink archetypes and resolves curated PoE 2 twink gear", async () => {
    const monkSnap = await createPoe2DemoSnapshot();

    expect(
      detectTwinkArchetype({ characterClass: "Monk", ascendancyName: "Invoker", linkGroups: [] }),
    ).toBe("melee");
    expect(
      detectTwinkArchetype({ characterClass: "Mercenary", ascendancyName: "Witchhunter", linkGroups: [] }),
    ).toBe("bow");
    expect(
      detectTwinkArchetype({ characterClass: "Sorceress", ascendancyName: "Stormweaver", linkGroups: [] }),
    ).toBe("spell");

    const timeline = buildTwinkGearTimeline({ snapshot: monkSnap, adapter: poe2GameAdapter });
    expect(timeline.detectedArchetype).toBe("melee");
    expect(timeline.totalRecommendedCount).toBeGreaterThan(0);
    expect(timeline.brackets.flatMap((b) => b.items).some((item) => item.itemName === "Enfolding Dawn")).toBe(
      true,
    );
  });
});
