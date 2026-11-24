import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import type { SpatialTreeIndex } from "./passive_tree_spatial_index.js";

export const EDGE_STYLE_NONE = 0;
export const EDGE_STYLE_ALLOCATED = 1;
export const EDGE_STYLE_NEW_BRACKET = 2;
export const EDGE_STYLE_EARLIER = 3;
export const EDGE_STYLE_RESPEC = 4;
export const EDGE_STYLE_FUTURE = 5;
export const EDGE_STYLE_WEAPON_SET_1 = 6;
export const EDGE_STYLE_WEAPON_SET_2 = 7;

export const NODE_ROLE_WIREFRAME = 0;
export const NODE_ROLE_ALLOCATED = 1;
export const NODE_ROLE_NEW_BRACKET = 2;
export const NODE_ROLE_EARLIER = 3;
export const NODE_ROLE_RESPEC = 4;
export const NODE_ROLE_MASTERY_ACTIVE = 5;
export const NODE_ROLE_FUTURE = 6;

export const NODE_FLAG_SEARCH = 1;
export const NODE_FLAG_SELECTED = 2;
export const NODE_FLAG_RESPEC_DASH = 4;
export const NODE_FLAG_POB_MASTERY = 8;
export const NODE_FLAG_WEAPON_SET_1 = 16;
export const NODE_FLAG_WEAPON_SET_2 = 32;

export type WeaponSetOverlayFilter = "all" | "set1" | "set2";

export interface TreeHighlightLookup {
  readonly edgeBuckets: Uint8Array;
  readonly nodeRoles: Uint8Array;
  readonly nodeFlags: Uint8Array;
}

/** Precomputes flat Uint8Array highlight styles and flags indexed by local spatial-index position. */
export function buildTreeHighlightLookup(params: {
  index: SpatialTreeIndex;
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  showFuture: boolean;
  searchMatchIds: ReadonlySet<string>;
  selectedNodeId: string | null;
  weaponSetFilter?: WeaponSetOverlayFilter;
}): TreeHighlightLookup {
  const {
    index,
    diff,
    allocatedIds,
    showFuture,
    searchMatchIds,
    selectedNodeId,
    weaponSetFilter = "all",
  } = params;

  const addedSet = new Set(diff.addedInBracketIds);
  const missedSet = new Set(diff.earlierMissedIds);
  const respecSet = new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds]);
  const futureSet = new Set(diff.futureBracketIds);
  const ws1Set = new Set(diff.selectedSpec?.weaponSet1NodeIds ?? []);
  const ws2Set = new Set(diff.selectedSpec?.weaponSet2NodeIds ?? []);
  const specMasteries = diff.selectedSpec?.masteries ?? {};

  const isSuppressedWs = (id: string): boolean =>
    (weaponSetFilter === "set1" && ws2Set.has(id) && !ws1Set.has(id)) ||
    (weaponSetFilter === "set2" && ws1Set.has(id) && !ws2Set.has(id));

  const edgeBuckets = new Uint8Array(index.edges.length);
  for (let i = 0; i < index.edges.length; i++) {
    const e = index.edges[i]!;
    if (isSuppressedWs(e.fromId) || isSuppressedWs(e.toId)) continue;

    const inBuild =
      (allocatedIds.has(e.fromId) || diff.targetSet.has(e.fromId)) &&
      (allocatedIds.has(e.toId) || diff.targetSet.has(e.toId));
    if (inBuild && weaponSetFilter !== "set2" && (ws1Set.has(e.fromId) || ws1Set.has(e.toId))) {
      edgeBuckets[i] = EDGE_STYLE_WEAPON_SET_1;
    } else if (inBuild && weaponSetFilter !== "set1" && (ws2Set.has(e.fromId) || ws2Set.has(e.toId))) {
      edgeBuckets[i] = EDGE_STYLE_WEAPON_SET_2;
    } else if (allocatedIds.has(e.fromId) && allocatedIds.has(e.toId)) {
      edgeBuckets[i] = EDGE_STYLE_ALLOCATED;
    } else if (diff.targetSet.has(e.fromId) && diff.targetSet.has(e.toId)) {
      edgeBuckets[i] =
        addedSet.has(e.fromId) || addedSet.has(e.toId) ? EDGE_STYLE_NEW_BRACKET : EDGE_STYLE_EARLIER;
    } else if (respecSet.has(e.fromId) || respecSet.has(e.toId)) {
      edgeBuckets[i] = EDGE_STYLE_RESPEC;
    } else if (showFuture && (futureSet.has(e.fromId) || futureSet.has(e.toId))) {
      edgeBuckets[i] = EDGE_STYLE_FUTURE;
    }
  }

  const nodeRoles = new Uint8Array(index.nodes.length);
  const nodeFlags = new Uint8Array(index.nodes.length);
  for (let i = 0; i < index.nodes.length; i++) {
    const n = index.nodes[i]!;
    const suppressed = isSuppressedWs(n.id);
    const isAlloc = allocatedIds.has(n.id);
    const isTarget = diff.targetSet.has(n.id);
    const isAdded = addedSet.has(n.id);
    const isMissed = missedSet.has(n.id);
    const isRespec = respecSet.has(n.id);
    const hasPobMastery = Boolean(n.isMastery && specMasteries[n.id]);

    if (!suppressed) {
      if (isAlloc) nodeRoles[i] = NODE_ROLE_ALLOCATED;
      else if (isAdded && isTarget) nodeRoles[i] = NODE_ROLE_NEW_BRACKET;
      else if (isMissed) nodeRoles[i] = NODE_ROLE_EARLIER;
      else if (isRespec) nodeRoles[i] = NODE_ROLE_RESPEC;
      else if (hasPobMastery && isTarget) nodeRoles[i] = NODE_ROLE_MASTERY_ACTIVE;
      else if (showFuture && futureSet.has(n.id)) nodeRoles[i] = NODE_ROLE_FUTURE;
      else if (isTarget) nodeRoles[i] = NODE_ROLE_EARLIER;
    }

    let flags = 0;
    if (searchMatchIds.has(n.id)) flags |= NODE_FLAG_SEARCH;
    if (selectedNodeId === n.id) flags |= NODE_FLAG_SELECTED;
    if (!suppressed && isRespec) flags |= NODE_FLAG_RESPEC_DASH;
    if (!suppressed && hasPobMastery) flags |= NODE_FLAG_POB_MASTERY;
    if (!suppressed && weaponSetFilter !== "set2" && ws1Set.has(n.id)) flags |= NODE_FLAG_WEAPON_SET_1;
    if (!suppressed && weaponSetFilter !== "set1" && ws2Set.has(n.id)) flags |= NODE_FLAG_WEAPON_SET_2;
    nodeFlags[i] = flags;
  }

  return { edgeBuckets, nodeRoles, nodeFlags };
}
