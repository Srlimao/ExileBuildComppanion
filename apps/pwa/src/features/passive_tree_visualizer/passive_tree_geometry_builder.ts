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
