import { computeBracketProgressionDiff } from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import {
  buildSpatialTreeIndex,
  buildTreeHighlightLookup,
  clearSavedTreeViewportCache,
  EDGE_STYLE_WEAPON_SET_1,
  EDGE_STYLE_WEAPON_SET_2,
  loadBuiltPassiveTreeGeometry,
  loadSavedTreeViewport,
  NODE_FLAG_WEAPON_SET_1,
  NODE_FLAG_WEAPON_SET_2,
  NODE_ROLE_WIREFRAME,
  queryVisibleTreePrimitives,
  resolvePassiveTreePalette,
  saveTreeViewport,
} from "@exile-hud/hud-ui";
import { afterEach, describe, expect, it } from "vitest";

const POE2_SPEC = {
  id: "spec_poe2",
  title: "Campaign Monk",
  minLevel: 1,
  nodeIds: ["44683", "10364", "42857", "20024", "44223", "7576", "33866"],
  masteries: {},
  weaponSet1NodeIds: ["20024", "44223"],
  weaponSet2NodeIds: ["7576", "33866"],
};

describe("poe2_passive_tree_and_weapon_sets", () => {
  afterEach(() => clearSavedTreeViewportCache(true));

  it("lazy-loads PoE 2 tree geometry cleanly with class starts and spatial culling", async () => {
    const geometry = await loadBuiltPassiveTreeGeometry("poe2");
    expect(geometry.allNodesList.length).toBeGreaterThan(4000);
    expect(geometry.edges.length).toBeGreaterThan(4000);
    expect(geometry.nodes["44683"]?.name).toContain("Monk");

    const monkCenter = geometry.nodes["44683"]!;
    const neighbor10364 = geometry.nodes["10364"]!;
    expect(Math.hypot(monkCenter.x - neighbor10364.x, monkCenter.y - neighbor10364.y)).toBeLessThan(400);
    for (const edge of geometry.edges) {
      expect(Math.hypot(edge.x1 - edge.x2, edge.y1 - edge.y2)).toBeLessThan(2500);
    }

    const index = buildSpatialTreeIndex(geometry.allNodesList, geometry.edges);
    const vis = queryVisibleTreePrimitives(index, {
      minX: monkCenter.x - 1600,
      minY: monkCenter.y - 1600,
      maxX: monkCenter.x + 1600,
      maxY: monkCenter.y + 1600,
    });
    expect(vis.nodeCount).toBeGreaterThan(5);
    expect(vis.edgeCount).toBeGreaterThan(5);
  });

  it("assigns Weapon Set 1 Crimson & Weapon Set 2 Emerald edge buckets and flags with filter support", async () => {
    const geometry = await loadBuiltPassiveTreeGeometry("poe2");
    const adapter = getGameAdapter("poe2");
    const allocatedIds = new Set(["44683", "10364"]);
    const diff = computeBracketProgressionDiff({
      specs: [POE2_SPEC],
      selectedIndex: 0,
      allocatedIds,
      characterClass: "Monk",
      adapter,
    });

    const index = buildSpatialTreeIndex(geometry.allNodesList, geometry.edges);
    const allLookup = buildTreeHighlightLookup({
      index,
      diff,
      allocatedIds,
      showFuture: false,
      searchMatchIds: new Set(),
      selectedNodeId: null,
      weaponSetFilter: "all",
    });

    const ws1NodeIdx = geometry.allNodesList.findIndex((n) => n.id === "20024");
    const ws2NodeIdx = geometry.allNodesList.findIndex((n) => n.id === "7576");
    expect((allLookup.nodeFlags[ws1NodeIdx]! & NODE_FLAG_WEAPON_SET_1) !== 0).toBe(true);
    expect((allLookup.nodeFlags[ws2NodeIdx]! & NODE_FLAG_WEAPON_SET_2) !== 0).toBe(true);

    const ws1EdgeIdx = geometry.edges.findIndex(
      (e) =>
        (e.fromId === "20024" && e.toId === "44223") ||
        (e.fromId === "44223" && e.toId === "20024"),
    );
    const ws2EdgeIdx = geometry.edges.findIndex(
      (e) =>
        (e.fromId === "7576" && e.toId === "33866") ||
        (e.fromId === "33866" && e.toId === "7576"),
    );
    expect(ws1EdgeIdx).toBeGreaterThanOrEqual(0);
    expect(ws2EdgeIdx).toBeGreaterThanOrEqual(0);
    expect(allLookup.edgeBuckets[ws1EdgeIdx]).toBe(EDGE_STYLE_WEAPON_SET_1);
    expect(allLookup.edgeBuckets[ws2EdgeIdx]).toBe(EDGE_STYLE_WEAPON_SET_2);

    const set1OnlyLookup = buildTreeHighlightLookup({
      index,
      diff,
      allocatedIds,
      showFuture: false,
      searchMatchIds: new Set(),
      selectedNodeId: null,
      weaponSetFilter: "set1",
    });
    expect((set1OnlyLookup.nodeFlags[ws1NodeIdx]! & NODE_FLAG_WEAPON_SET_1) !== 0).toBe(true);
    expect((set1OnlyLookup.nodeFlags[ws2NodeIdx]! & NODE_FLAG_WEAPON_SET_2) === 0).toBe(true);
    expect(set1OnlyLookup.nodeRoles[ws2NodeIdx]).toBe(NODE_ROLE_WIREFRAME);

    const darkPalette = resolvePassiveTreePalette({ mode: "oled", accentId: "chalk", customHex: "#eab308" });
    const lightPalette = resolvePassiveTreePalette({ mode: "light", accentId: "chalk", customHex: "#eab308" });
    expect(darkPalette.weaponSet1).toBe("#ef4444");
    expect(darkPalette.weaponSet2).toBe("#22c55e");
    expect(lightPalette.weaponSet1).toBe("#dc2626");
    expect(lightPalette.weaponSet2).toBe("#16a34a");
  });

  it("isolates PoE 2 tree viewport storage from PoE 1 profile keys", () => {
    saveTreeViewport(
      "prof1",
      { specKey: "poe1:prof1::spec_1", camera: { centerX: 100, centerY: 200, width: 3200 }, manualSpecId: null },
      true,
    );
    saveTreeViewport(
      "poe2:prof1",
      {
        specKey: "poe2:prof1::spec_poe2",
        camera: { centerX: 1275, centerY: 736, width: 4800 },
        manualSpecId: "spec_poe2",
      },
      true,
    );

    expect(loadSavedTreeViewport("prof1")?.specKey).toBe("poe1:prof1::spec_1");
    expect(loadSavedTreeViewport("poe2:prof1")?.specKey).toBe("poe2:prof1::spec_poe2");
  });
});
