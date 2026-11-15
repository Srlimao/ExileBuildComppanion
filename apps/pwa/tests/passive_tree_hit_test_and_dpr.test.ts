import {
  computeBracketProgressionDiff,
  resolveEffectiveAllocatedSet,
  selectBracketSpecIndex,
  sortTreeSpecsByLevel,
} from "@exile-hud/core";
import {
  buildSpatialTreeIndex,
  buildTreeHighlightLookup,
  getBuiltPoe1TreeGeometry,
  hitTestPassiveTreeNode,
  resolveAdaptiveCanvasDpr,
  resolveVisibleAscendancies,
  screenPointToWorld,
  type ViewportCamera,
  type ViewportRect,
} from "@exile-hud/hud-ui";
import { describe, expect, it } from "vitest";
import { createInteractiveDemoSnapshot } from "../src/features/pairing_and_connection/demo_campaign_snapshot_factory.js";

describe("passive_tree_hit_test_and_dpr", () => {
  it("hits notables within finger touch tolerance, respects LOD hiding, and misses empty space", () => {
    const snap = createInteractiveDemoSnapshot();
    const geometry = getBuiltPoe1TreeGeometry();
    const specs = sortTreeSpecsByLevel(snap.passiveTree.specs ?? []);
    const selectedIndex = selectBracketSpecIndex(specs, snap.characterLevel);
    const allocatedIds = resolveEffectiveAllocatedSet(snap.passiveTree);
    const diff = computeBracketProgressionDiff({
      specs,
      selectedIndex,
      allocatedIds,
      characterClass: snap.characterClass,
      adapter: {
        getPassiveTreeNodes: () => geometry.nodes,
        getPassiveTreeGraphMeta: () => geometry.meta,
      } as Parameters<typeof computeBracketProgressionDiff>[0]["adapter"],
    });
    const visibleAscendancies = resolveVisibleAscendancies({
      characterClass: snap.characterClass,
      ascendancyName: snap.ascendancyName,
      activeSpecNodeIds: diff.targetSet,
      geometry,
    });
    const visibleNodes = geometry.allNodesList.filter(
      (n) => !n.isBlighted && (!n.ascendancyName || visibleAscendancies.has(n.ascendancyName)),
    );
    const visibleEdges = geometry.edges.filter(
      (e) => !e.ascendancyName || visibleAscendancies.has(e.ascendancyName),
    );
    const index = buildSpatialTreeIndex(visibleNodes, visibleEdges);
    const lookup = buildTreeHighlightLookup({
      index,
      diff,
      allocatedIds,
      showFuture: false,
      searchMatchIds: new Set(),
      selectedNodeId: null,
    });

    const targetNotable = diff.nextNotableTargets.find((t) => t.kind === "notable");
    expect(targetNotable).toBeDefined();
    const node = geometry.nodes[targetNotable!.nodeId]!;
    const rect: ViewportRect = { left: 0, top: 0, width: 1000, height: 700 };
    const cam: ViewportCamera = { centerX: node.x, centerY: node.y, width: 3000 };

    const nearHit = screenPointToWorld(518, 350, cam, rect);
    expect(
      hitTestPassiveTreeNode({
        index,
        lookup,
        worldX: nearHit.worldX,
        worldY: nearHit.worldY,
        worldPerPx: nearHit.worldPerPx,
        viewWidth: cam.width,
      }),
    ).toBe(node.id);

    const minorWireframe = visibleNodes.find(
      (n) =>
        !n.isNotable &&
        !n.isKeystone &&
        !n.isMastery &&
        !allocatedIds.has(n.id) &&
        !diff.targetSet.has(n.id) &&
        !diff.respecFromPrevIds.includes(n.id) &&
        !diff.offSpecAllocatedIds.includes(n.id),
    );
    expect(minorWireframe).toBeDefined();
    expect(
      hitTestPassiveTreeNode({
        index,
        lookup,
        worldX: minorWireframe!.x,
        worldY: minorWireframe!.y,
        worldPerPx: 20,
        viewWidth: 20000,
      }),
    ).toBeNull();

    expect(
      hitTestPassiveTreeNode({
        index,
        lookup,
        worldX: 50000,
        worldY: 50000,
        worldPerPx: 3,
        viewWidth: 3000,
      }),
    ).toBeNull();
  });

  it("caps canvas DPR on low-end tablets vs desktop profiles", () => {
    expect(
      resolveAdaptiveCanvasDpr({
        devicePixelRatio: 2,
        hardwareConcurrency: 4,
        deviceMemory: 3,
        coarsePointer: true,
      }),
    ).toBe(1.25);

    expect(
      resolveAdaptiveCanvasDpr({
        devicePixelRatio: 2.5,
        hardwareConcurrency: 12,
        deviceMemory: 16,
        coarsePointer: false,
      }),
    ).toBe(2.0);

    expect(
      resolveAdaptiveCanvasDpr({
        devicePixelRatio: 1,
        hardwareConcurrency: 2,
        deviceMemory: 2,
        coarsePointer: true,
      }),
    ).toBe(1);
  });
});
