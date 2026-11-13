import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import type { PassiveTreeGraphMetadata, PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { poe1GameAdapter } from "@exile-hud/game-data";

export interface BuiltTreeEdge {
  key: string;
  fromId: string;
  toId: string;
  svgPath: string;
  ascendancyName?: string;
}

export interface TreeWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BuiltPoe1TreeGeometry {
  nodes: Record<string, PassiveTreeNodeMetadata>;
  allNodesList: PassiveTreeNodeMetadata[];
  edges: BuiltTreeEdge[];
  edgesByNodeId: Map<string, BuiltTreeEdge[]>;
  meta: PassiveTreeGraphMetadata;
}

let cachedGeometry: BuiltPoe1TreeGeometry | null = null;

function buildEdgePath(
  u: PassiveTreeNodeMetadata,
  v: PassiveTreeNodeMetadata,
  meta: PassiveTreeGraphMetadata,
): string {
  if (
    u.group !== undefined &&
    u.group === v.group &&
    u.orbit !== undefined &&
    u.orbit === v.orbit
  ) {
    const radius = meta.orbitRadii[u.orbit] ?? 0;
    const grp = meta.groups[String(u.group)];
    if (radius > 0 && grp) {
      const a1 = Math.atan2(u.y - grp.y, u.x - grp.x);
      const a2 = Math.atan2(v.y - grp.y, v.x - grp.x);
      let delta = a2 - a1;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) > 0.01 && Math.abs(delta) < Math.PI * 0.96) {
        const sweep = delta > 0 ? 1 : 0;
        return `M${u.x} ${u.y}A${radius} ${radius} 0 0 ${sweep} ${v.x} ${v.y}`;
      }
    }
  }
  return `M${u.x} ${u.y}L${v.x} ${v.y}`;
}

/** Builds and caches undirected SVG edge geometry for the loaded GGG 3.30.0 passive tree. */
export function getBuiltPoe1TreeGeometry(): BuiltPoe1TreeGeometry {
  if (cachedGeometry) return cachedGeometry;

  const nodes = poe1GameAdapter.getPassiveTreeNodes();
  const meta = poe1GameAdapter.getPassiveTreeGraphMeta();
  const allNodesList = Object.values(nodes);
  const edges: BuiltTreeEdge[] = [];
  const seenKeys = new Set<string>();
  const edgesByNodeId = new Map<string, BuiltTreeEdge[]>();

  const attachEdge = (nodeId: string, edge: BuiltTreeEdge) => {
    const list = edgesByNodeId.get(nodeId);
    if (list) list.push(edge);
    else edgesByNodeId.set(nodeId, [edge]);
  };

  for (const u of allNodesList) {
    if (!u.out || u.isMastery || u.isBlighted) continue;
    for (const vId of u.out) {
      const v = nodes[vId];
      if (!v || v.isMastery || v.isBlighted) continue;
      if (Boolean(u.ascendancyName) !== Boolean(v.ascendancyName)) continue;
      const key = u.id < v.id ? `${u.id}-${v.id}` : `${v.id}-${u.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const edge: BuiltTreeEdge = {
        key,
        fromId: u.id,
        toId: v.id,
        svgPath: buildEdgePath(u, v, meta),
        ascendancyName: u.ascendancyName ?? v.ascendancyName,
      };
      edges.push(edge);
      attachEdge(u.id, edge);
      attachEdge(v.id, edge);
    }
  }

  cachedGeometry = { nodes, allNodesList, edges, edgesByNodeId, meta };
  return cachedGeometry;
}

/** Determines which Ascendancy clusters should be rendered for the current build/spec. */
export function resolveVisibleAscendancies(params: {
  characterClass: string;
  ascendancyName: string;
  activeSpecNodeIds: Iterable<string>;
  geometry: BuiltPoe1TreeGeometry;
}): Set<string> {
  const { characterClass, ascendancyName, activeSpecNodeIds, geometry } = params;
  const visible = new Set<string>();
  if (ascendancyName && ascendancyName !== "None") {
    visible.add(ascendancyName);
  } else {
    const cls = geometry.meta.classes.find(
      (c) => c.name.toLowerCase() === characterClass.toLowerCase(),
    );
    for (const asc of cls?.ascendancies ?? []) visible.add(asc);
  }
  for (const id of activeSpecNodeIds) {
    const node = geometry.nodes[id];
    if (node?.ascendancyName) visible.add(node.ascendancyName);
  }
  return visible;
}

/** Computes a padded world-space bounding box around a set of passive tree node IDs. */
export function computeNodeSetBounds(
  nodeIds: Iterable<string>,
  nodes: Record<string, PassiveTreeNodeMetadata>,
  fallback: TreeWorldBounds = { minX: -4800, minY: -5200, maxX: 4800, maxY: 4800 },
): TreeWorldBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (const id of nodeIds) {
    const n = nodes[id];
    if (!n) continue;
    count++;
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  if (count === 0) return fallback;
  const padX = Math.max(950, (maxX - minX) * 0.16);
  const padY = Math.max(950, (maxY - minY) * 0.16);
  return {
    minX: Math.round(minX - padX),
    minY: Math.round(minY - padY),
    maxX: Math.round(maxX + padX),
    maxY: Math.round(maxY + padY),
  };
}

/** Computes overview bounds for a bracket, preferring main-tree nodes before falling back to Ascendancy islands. */
export function computeBracketOverviewBounds(
  targetIds: Iterable<string>,
  nodes: Record<string, PassiveTreeNodeMetadata>,
): TreeWorldBounds {
  const mainIds: string[] = [];
  const allIds: string[] = [];
  for (const id of targetIds) {
    const n = nodes[id];
    if (!n) continue;
    allIds.push(id);
    if (!n.ascendancyName) mainIds.push(id);
  }
  return computeNodeSetBounds(mainIds.length > 0 ? mainIds : allIds, nodes);
}

/** Computes a tightly zoomed viewport box centered on the immediate next passives to place. */
export function computeNextPassivesBounds(params: {
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  characterClass: string;
  geometry: BuiltPoe1TreeGeometry;
}): TreeWorldBounds {
  const { diff, allocatedIds, characterClass, geometry } = params;
  const { nodes } = geometry;
  const isMain = (id: string) => Boolean(nodes[id] && !nodes[id]!.ascendancyName);

  const mainUnalloc: string[] = [];
  const ascUnalloc: string[] = [];
  for (const id of [...diff.earlierMissedIds, ...diff.unallocatedAddedIds]) {
    const n = nodes[id];
    if (!n) continue;
    if (n.ascendancyName) ascUnalloc.push(id);
    else mainUnalloc.push(id);
  }

  const classStartId = geometry.meta.classes.find(
    (c) => c.name.toLowerCase() === characterClass.toLowerCase(),
  )?.startNodeId;

  const orderedCandidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (id: string) => {
    if (!id || !nodes[id] || seen.has(id)) return;
    seen.add(id);
    orderedCandidates.push(id);
  };

  if (mainUnalloc.length > 0) {
    const sortedTargets = diff.nextNotableTargets
      .filter((t) => isMain(t.nodeId))
      .sort((a, b) => a.pathToAllocateIds.length - b.pathToAllocateIds.length || Number(a.isNewInBracket) - Number(b.isNewInBracket));
    for (const target of sortedTargets) {
      for (const id of target.pathToAllocateIds) {
        if (isMain(id)) pushCandidate(id);
      }
      pushCandidate(target.nodeId);
    }
    const anchor = (orderedCandidates[0] ? nodes[orderedCandidates[0]] : undefined) ?? (classStartId ? nodes[classStartId] : undefined);
    const remaining = [...mainUnalloc].sort((a, b) => {
      if (!anchor) return 0;
      const na = nodes[a]!;
      const nb = nodes[b]!;
      return (na.x - anchor.x) ** 2 + (na.y - anchor.y) ** 2 - ((nb.x - anchor.x) ** 2 + (nb.y - anchor.y) ** 2);
    });
    for (const id of remaining) pushCandidate(id);
  } else if (ascUnalloc.length > 0) {
    for (const id of ascUnalloc) pushCandidate(id);
  } else {
    const respecMain = [...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds].filter(isMain);
    const futureMain = diff.futureBracketIds.filter(isMain);
    const allocMain = diff.allocatedInTargetIds.filter(isMain);
    const fallbackIds = respecMain.length > 0 ? respecMain : futureMain.length > 0 ? futureMain : allocMain.length > 0 ? allocMain : classStartId ? [classStartId] : [];
    for (const id of fallbackIds) pushCandidate(id);
  }

  if (orderedCandidates.length === 0) return computeBracketOverviewBounds(diff.targetSet, nodes);

  const first = nodes[orderedCandidates[0]!]!;
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;

  const tryInclude = (id: string, maxSpan: number) => {
    const n = nodes[id];
    if (!n) return;
    const nextMinX = Math.min(minX, n.x);
    const nextMaxX = Math.max(maxX, n.x);
    const nextMinY = Math.min(minY, n.y);
    const nextMaxY = Math.max(maxY, n.y);
    if (nextMaxX - nextMinX <= maxSpan && nextMaxY - nextMinY <= maxSpan) {
      minX = nextMinX;
      maxX = nextMaxX;
      minY = nextMinY;
      maxY = nextMaxY;
    }
  };

  for (const edge of geometry.edgesByNodeId.get(first.id) ?? []) {
    const nbrId = edge.fromId === first.id ? edge.toId : edge.fromId;
    if (allocatedIds.has(nbrId)) tryInclude(nbrId, 1400);
  }
  for (let i = 1; i < orderedCandidates.length; i++) {
    tryInclude(orderedCandidates[i]!, i < 3 ? 2500 : 1900);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfW = Math.max(1000, (maxX - minX) / 2 + 480);
  const halfH = Math.max(1000, (maxY - minY) / 2 + 480);
  return {
    minX: Math.round(cx - halfW),
    minY: Math.round(cy - halfH),
    maxX: Math.round(cx + halfW),
    maxY: Math.round(cy + halfH),
  };
}
