import {
  computeBracketProgressionDiff,
  resolveEffectiveAllocatedSet,
  selectBracketSpecIndex,
  sortTreeSpecsByLevel,
} from "@exile-hud/core";
import {
  buildSpatialTreeIndex,
  buildTreeHighlightLookup,
  EDGE_STYLE_ALLOCATED,
  EDGE_STYLE_EARLIER,
  EDGE_STYLE_FUTURE,
  EDGE_STYLE_NEW_BRACKET,
  EDGE_STYLE_RESPEC,
  getBuiltPoe1TreeGeometry,
  NODE_FLAG_SEARCH,
  NODE_FLAG_SELECTED,
  NODE_ROLE_ALLOCATED,
  NODE_ROLE_EARLIER,
  NODE_ROLE_FUTURE,
  NODE_ROLE_NEW_BRACKET,
  NODE_ROLE_RESPEC,
  NODE_ROLE_WIREFRAME,
  queryVisibleTreePrimitives,
  resolveVisibleAscendancies,
} from "@exile-hud/hud-ui";
import { describe, expect, it } from "vitest";
import { createInteractiveDemoSnapshot } from "../src/features/pairing_and_connection/demo_campaign_snapshot_factory.js";

function buildDemoContext() {
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
  return { diff, allocatedIds, visibleNodes, visibleEdges };
}

describe("passive_tree_spatial_index", () => {
  it("culls nodes and edges identically to brute-force AABB overlap without duplicates", () => {
    const { visibleNodes, visibleEdges } = buildDemoContext();
    const index = buildSpatialTreeIndex(visibleNodes, visibleEdges);
    const frustum = { minX: -2800, minY: -5200, maxX: 600, maxY: -1800 };
    const pad = 96;
    const nodePad = 88;

    const expectedNodeIds = visibleNodes
      .filter(
        (n) =>
          n.x + nodePad >= frustum.minX - pad &&
          n.x - nodePad <= frustum.maxX + pad &&
          n.y + nodePad >= frustum.minY - pad &&
          n.y - nodePad <= frustum.maxY + pad,
      )
      .map((n) => n.id)
      .sort();

    const expectedEdgeKeys = visibleEdges
      .filter(
        (e) =>
          e.maxX >= frustum.minX - pad &&
          e.minX <= frustum.maxX + pad &&
          e.maxY >= frustum.minY - pad &&
          e.minY <= frustum.maxY + pad,
      )
      .map((e) => e.key)
      .sort();

    for (let pass = 0; pass < 3; pass++) {
      const res = queryVisibleTreePrimitives(index, frustum);
      const gotNodeIds: string[] = [];
      for (let i = 0; i < res.nodeCount; i++) gotNodeIds.push(index.nodes[res.nodeIndices[i]!]!.id);
      const gotEdgeKeys: string[] = [];
      for (let i = 0; i < res.edgeCount; i++) gotEdgeKeys.push(index.edges[res.edgeIndices[i]!]!.key);

      expect(new Set(gotNodeIds).size).toBe(gotNodeIds.length);
      expect(new Set(gotEdgeKeys).size).toBe(gotEdgeKeys.length);
      expect(gotNodeIds.sort()).toEqual(expectedNodeIds);
      expect(gotEdgeKeys.sort()).toEqual(expectedEdgeKeys);
    }

    const curved = visibleEdges.find((e) => e.arc !== null);
    expect(curved).toBeDefined();
    if (curved) {
      expect(curved.minX).toBeLessThan(Math.min(curved.x1, curved.x2));
      expect(curved.maxX).toBeGreaterThan(Math.max(curved.x1, curved.x2));
      expect(curved.minY).toBeLessThan(Math.min(curved.y1, curved.y2));
      expect(curved.maxY).toBeGreaterThan(Math.max(curved.y1, curved.y2));
    }
  });

  it("assigns exact highlight bucket priorities and keeps wireframe fill for non-build search hits", () => {
    const { visibleNodes, visibleEdges, diff, allocatedIds } = buildDemoContext();
    const index = buildSpatialTreeIndex(visibleNodes, visibleEdges);
    const nonBuildNode = visibleNodes.find(
      (n) =>
        !allocatedIds.has(n.id) &&
        !diff.targetSet.has(n.id) &&
        !diff.respecFromPrevIds.includes(n.id) &&
        !diff.offSpecAllocatedIds.includes(n.id) &&
        !diff.futureBracketIds.includes(n.id),
    );
    expect(nonBuildNode).toBeDefined();

    const lookup = buildTreeHighlightLookup({
      index,
      diff,
      allocatedIds,
      showFuture: true,
      searchMatchIds: nonBuildNode ? new Set([nonBuildNode.id]) : new Set(),
      selectedNodeId: nonBuildNode?.id ?? null,
    });

    const nodeIdx = visibleNodes.findIndex((n) => n.id === nonBuildNode!.id);
    expect(lookup.nodeRoles[nodeIdx]).toBe(NODE_ROLE_WIREFRAME);
    expect((lookup.nodeFlags[nodeIdx]! & NODE_FLAG_SEARCH) !== 0).toBe(true);
    expect((lookup.nodeFlags[nodeIdx]! & NODE_FLAG_SELECTED) !== 0).toBe(true);

    const allocEdgeIdx = visibleEdges.findIndex(
      (e) => allocatedIds.has(e.fromId) && allocatedIds.has(e.toId),
    );
    expect(allocEdgeIdx).toBeGreaterThanOrEqual(0);
    expect(lookup.edgeBuckets[allocEdgeIdx]).toBe(EDGE_STYLE_ALLOCATED);

    const addedSet = new Set(diff.addedInBracketIds);
    const newBracketEdgeIdx = visibleEdges.findIndex(
      (e) =>
        !(allocatedIds.has(e.fromId) && allocatedIds.has(e.toId)) &&
        diff.targetSet.has(e.fromId) &&
        diff.targetSet.has(e.toId) &&
        (addedSet.has(e.fromId) || addedSet.has(e.toId)),
    );
    if (newBracketEdgeIdx >= 0) expect(lookup.edgeBuckets[newBracketEdgeIdx]).toBe(EDGE_STYLE_NEW_BRACKET);

    const earlierEdgeIdx = visibleEdges.findIndex(
      (e) =>
        !(allocatedIds.has(e.fromId) && allocatedIds.has(e.toId)) &&
        diff.targetSet.has(e.fromId) &&
        diff.targetSet.has(e.toId) &&
        !addedSet.has(e.fromId) &&
        !addedSet.has(e.toId),
    );
    if (earlierEdgeIdx >= 0) expect(lookup.edgeBuckets[earlierEdgeIdx]).toBe(EDGE_STYLE_EARLIER);

    const respecSet = new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds]);
    if (respecSet.size > 0) {
      const respecEdgeIdx = visibleEdges.findIndex(
        (e) =>
          !(allocatedIds.has(e.fromId) && allocatedIds.has(e.toId)) &&
          !(diff.targetSet.has(e.fromId) && diff.targetSet.has(e.toId)) &&
          (respecSet.has(e.fromId) || respecSet.has(e.toId)),
      );
      if (respecEdgeIdx >= 0) expect(lookup.edgeBuckets[respecEdgeIdx]).toBe(EDGE_STYLE_RESPEC);
      const respecNodeIdx = visibleNodes.findIndex(
        (n) => respecSet.has(n.id) && !allocatedIds.has(n.id) && !diff.targetSet.has(n.id),
      );
      if (respecNodeIdx >= 0) expect(lookup.nodeRoles[respecNodeIdx]).toBe(NODE_ROLE_RESPEC);
    }

    const futureOnlyId = diff.futureBracketIds.find(
      (id) => !allocatedIds.has(id) && !diff.targetSet.has(id) && !respecSet.has(id),
    );
    if (futureOnlyId) {
      const futureIdx = visibleNodes.findIndex((n) => n.id === futureOnlyId);
      if (futureIdx >= 0) expect(lookup.nodeRoles[futureIdx]).toBe(NODE_ROLE_FUTURE);
      const futureEdgeIdx = visibleEdges.findIndex(
        (e) =>
          !(allocatedIds.has(e.fromId) && allocatedIds.has(e.toId)) &&
          !(diff.targetSet.has(e.fromId) && diff.targetSet.has(e.toId)) &&
          !respecSet.has(e.fromId) &&
          !respecSet.has(e.toId) &&
          (e.fromId === futureOnlyId || e.toId === futureOnlyId),
      );
      if (futureEdgeIdx >= 0) expect(lookup.edgeBuckets[futureEdgeIdx]).toBe(EDGE_STYLE_FUTURE);
    }

    const allocNodeIdx = visibleNodes.findIndex((n) => allocatedIds.has(n.id));
    expect(lookup.nodeRoles[allocNodeIdx]).toBe(NODE_ROLE_ALLOCATED);
    if (diff.unallocatedAddedIds.length > 0) {
      const addIdx = visibleNodes.findIndex((n) => n.id === diff.unallocatedAddedIds[0]);
      if (addIdx >= 0) expect(lookup.nodeRoles[addIdx]).toBe(NODE_ROLE_NEW_BRACKET);
    }
    if (diff.earlierMissedIds.length > 0) {
      const missIdx = visibleNodes.findIndex((n) => n.id === diff.earlierMissedIds[0]);
      if (missIdx >= 0) expect(lookup.nodeRoles[missIdx]).toBe(NODE_ROLE_EARLIER);
    }
  });
});
