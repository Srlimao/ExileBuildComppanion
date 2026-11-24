import type {
  PassiveTreeGraphMetadata,
  PassiveTreeNodeMetadata,
  SupportedGameId,
} from "@exile-hud/game-data";
import { loadPassiveTreeDataset, poe1GameAdapter } from "@exile-hud/game-data";
import {
  computeBracketOverviewBounds,
  computeNextPassivesBounds,
  computeNodeSetBounds,
  type TreeWorldBounds,
} from "./passive_tree_camera_bounds.js";

export { computeBracketOverviewBounds, computeNextPassivesBounds, computeNodeSetBounds, type TreeWorldBounds };

export interface TreeEdgeArc {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise: boolean;
}

export interface BuiltTreeEdge {
  key: string;
  index: number;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arc: TreeEdgeArc | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  svgPath: string;
  ascendancyName?: string;
}

export interface BuiltTreeGeometry {
  nodes: Record<string, PassiveTreeNodeMetadata>;
  allNodesList: PassiveTreeNodeMetadata[];
  edges: BuiltTreeEdge[];
  edgesByNodeId: Map<string, BuiltTreeEdge[]>;
  searchTextByNodeId: Map<string, string>;
  meta: PassiveTreeGraphMetadata;
}

export type BuiltPoe1TreeGeometry = BuiltTreeGeometry;

const geometryCacheByGame = new Map<SupportedGameId, BuiltTreeGeometry>();

function buildEdgeGeometry(
  u: PassiveTreeNodeMetadata,
  v: PassiveTreeNodeMetadata,
  meta: PassiveTreeGraphMetadata,
): Pick<BuiltTreeEdge, "arc" | "minX" | "minY" | "maxX" | "maxY" | "svgPath"> {
  const baseMinX = Math.min(u.x, v.x);
  const baseMaxX = Math.max(u.x, v.x);
  const baseMinY = Math.min(u.y, v.y);
  const baseMaxY = Math.max(u.y, v.y);

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
        const pad = radius * (1 - Math.cos(Math.abs(delta) * 0.5)) + 32;
        return {
          arc: {
            cx: grp.x,
            cy: grp.y,
            radius,
            startAngle: a1,
            endAngle: a2,
            counterclockwise: delta < 0,
          },
          minX: baseMinX - pad,
          minY: baseMinY - pad,
          maxX: baseMaxX + pad,
          maxY: baseMaxY + pad,
          svgPath: `M${u.x} ${u.y}A${radius} ${radius} 0 0 ${sweep} ${v.x} ${v.y}`,
        };
      }
    }
  }

  return {
    arc: null,
    minX: baseMinX - 32,
    minY: baseMinY - 32,
    maxX: baseMaxX + 32,
    maxY: baseMaxY + 32,
    svgPath: `M${u.x} ${u.y}L${v.x} ${v.y}`,
  };
}

/** Builds undirected edge geometry, AABBs, and search text from raw passive tree datasets. */
export function buildTreeGeometryFromData(
  nodes: Record<string, PassiveTreeNodeMetadata>,
  meta: PassiveTreeGraphMetadata,
): BuiltTreeGeometry {
  const allNodesList = Object.values(nodes);
  const edges: BuiltTreeEdge[] = [];
  const seenKeys = new Set<string>();
  const edgesByNodeId = new Map<string, BuiltTreeEdge[]>();
  const searchTextByNodeId = new Map<string, string>();

  for (const node of allNodesList) {
    searchTextByNodeId.set(node.id, `${node.name}\n${node.stats.join("\n")}`.toLowerCase());
  }

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
      const edgeGeom = buildEdgeGeometry(u, v, meta);
      const edge: BuiltTreeEdge = {
        key,
        index: edges.length,
        fromId: u.id,
        toId: v.id,
        x1: u.x,
        y1: u.y,
        x2: v.x,
        y2: v.y,
        ...edgeGeom,
        ascendancyName: u.ascendancyName ?? v.ascendancyName,
      };
      edges.push(edge);
      attachEdge(u.id, edge);
      attachEdge(v.id, edge);
    }
  }

  return { nodes, allNodesList, edges, edgesByNodeId, searchTextByNodeId, meta };
}

/** Builds and caches undirected edge geometry for the PoE 1 3.30.0 passive tree synchronously. */
export function getBuiltPoe1TreeGeometry(): BuiltTreeGeometry {
  const existing = geometryCacheByGame.get("poe1");
  if (existing) return existing;
  const built = buildTreeGeometryFromData(
    poe1GameAdapter.getPassiveTreeNodes(),
    poe1GameAdapter.getPassiveTreeGraphMeta(),
  );
  geometryCacheByGame.set("poe1", built);
  return built;
}

/** Returns already-hydrated tree geometry synchronously (`poe1` always built synchronously). */
export function getCachedPassiveTreeGeometry(gameId: SupportedGameId = "poe1"): BuiltTreeGeometry | null {
  if (gameId !== "poe2") return getBuiltPoe1TreeGeometry();
  return geometryCacheByGame.get("poe2") ?? null;
}

/** Lazily loads (for PoE 2) and caches built passive tree geometry per game ID. */
export async function loadBuiltPassiveTreeGeometry(
  gameId: SupportedGameId = "poe1",
): Promise<BuiltTreeGeometry> {
  const existing = getCachedPassiveTreeGeometry(gameId);
  if (existing) return existing;
  const dataset = await loadPassiveTreeDataset(gameId);
  const rechecked = geometryCacheByGame.get(gameId);
  if (rechecked) return rechecked;
  const built = buildTreeGeometryFromData(dataset.nodes, dataset.meta);
  geometryCacheByGame.set(gameId, built);
  return built;
}

/** Determines which Ascendancy clusters should be rendered for the current build/spec. */
export function resolveVisibleAscendancies(params: {
  characterClass: string;
  ascendancyName: string;
  activeSpecNodeIds: Iterable<string>;
  geometry: BuiltTreeGeometry;
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
