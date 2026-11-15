import type { PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import type { TreeWorldBounds } from "./passive_tree_camera_bounds.js";
import type { BuiltTreeEdge } from "./passive_tree_geometry_builder.js";
import type { TreeHighlightLookup } from "./passive_tree_highlight_lookup.js";

export * from "./passive_tree_highlight_lookup.js";

const GRID_CELL_SIZE = 1024;
const NODE_BOUND_PAD = 88;
const FRUSTUM_CULL_PAD = 96;
const STAMP_RESET_THRESHOLD = 0x7ffffff0;

export interface SpatialTreeIndex {
  readonly nodes: readonly PassiveTreeNodeMetadata[];
  readonly edges: readonly BuiltTreeEdge[];
  readonly cellSize: number;
  readonly minX: number;
  readonly minY: number;
  readonly cols: number;
  readonly rows: number;
  readonly nodeCells: (number[] | undefined)[];
  readonly edgeCells: (number[] | undefined)[];
  readonly nodeVisited: Uint32Array;
  readonly edgeVisited: Uint32Array;
  readonly scratchNodeIndices: Int32Array;
  readonly scratchEdgeIndices: Int32Array;
  stamp: number;
}

export interface SpatialTreeQueryResult {
  readonly nodeIndices: Int32Array;
  readonly nodeCount: number;
  readonly edgeIndices: Int32Array;
  readonly edgeCount: number;
}

function clampCell(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function insertBoxIntoGrid(
  cells: (number[] | undefined)[],
  itemIndex: number,
  bounds: TreeWorldBounds,
  gridMinX: number,
  gridMinY: number,
  cols: number,
  rows: number,
): void {
  const c0 = clampCell(Math.floor((bounds.minX - gridMinX) / GRID_CELL_SIZE), 0, cols - 1);
  const c1 = clampCell(Math.floor((bounds.maxX - gridMinX) / GRID_CELL_SIZE), 0, cols - 1);
  const r0 = clampCell(Math.floor((bounds.minY - gridMinY) / GRID_CELL_SIZE), 0, rows - 1);
  const r1 = clampCell(Math.floor((bounds.maxY - gridMinY) / GRID_CELL_SIZE), 0, rows - 1);

  for (let r = r0; r <= r1; r++) {
    const rowOffset = r * cols;
    for (let c = c0; c <= c1; c++) {
      const idx = rowOffset + c;
      let bucket = cells[idx];
      if (!bucket) {
        bucket = [];
        cells[idx] = bucket;
      }
      bucket.push(itemIndex);
    }
  }
}

/** Builds a uniform 2D spatial hash grid and reusable stamp buffers for zero-allocation frustum culling. */
export function buildSpatialTreeIndex(
  visibleNodes: readonly PassiveTreeNodeMetadata[],
  visibleEdges: readonly BuiltTreeEdge[],
): SpatialTreeIndex {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of visibleNodes) {
    if (node.x - NODE_BOUND_PAD < minX) minX = node.x - NODE_BOUND_PAD;
    if (node.y - NODE_BOUND_PAD < minY) minY = node.y - NODE_BOUND_PAD;
    if (node.x + NODE_BOUND_PAD > maxX) maxX = node.x + NODE_BOUND_PAD;
    if (node.y + NODE_BOUND_PAD > maxY) maxY = node.y + NODE_BOUND_PAD;
  }
  for (const edge of visibleEdges) {
    if (edge.minX < minX) minX = edge.minX;
    if (edge.minY < minY) minY = edge.minY;
    if (edge.maxX > maxX) maxX = edge.maxX;
    if (edge.maxY > maxY) maxY = edge.maxY;
  }

  if (!Number.isFinite(minX)) {
    minX = -15000;
    minY = -12000;
    maxX = 14000;
    maxY = 12000;
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / GRID_CELL_SIZE) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / GRID_CELL_SIZE) + 1);
  const totalCells = cols * rows;
  const nodeCells = new Array<number[] | undefined>(totalCells);
  const edgeCells = new Array<number[] | undefined>(totalCells);

  for (let i = 0; i < visibleNodes.length; i++) {
    const n = visibleNodes[i]!;
    const box = {
      minX: n.x - NODE_BOUND_PAD,
      minY: n.y - NODE_BOUND_PAD,
      maxX: n.x + NODE_BOUND_PAD,
      maxY: n.y + NODE_BOUND_PAD,
    };
    insertBoxIntoGrid(nodeCells, i, box, minX, minY, cols, rows);
  }

  for (let i = 0; i < visibleEdges.length; i++) {
    insertBoxIntoGrid(edgeCells, i, visibleEdges[i]!, minX, minY, cols, rows);
  }

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    cellSize: GRID_CELL_SIZE,
    minX,
    minY,
    cols,
    rows,
    nodeCells,
    edgeCells,
    nodeVisited: new Uint32Array(visibleNodes.length),
    edgeVisited: new Uint32Array(visibleEdges.length),
    scratchNodeIndices: new Int32Array(visibleNodes.length),
    scratchEdgeIndices: new Int32Array(visibleEdges.length),
    stamp: 1,
  };
}

/** Queries nodes and edges intersecting the padded world frustum using reusable scratch buffers. */
export function queryVisibleTreePrimitives(
  index: SpatialTreeIndex,
  frustum: TreeWorldBounds,
): SpatialTreeQueryResult {
  if (index.stamp >= STAMP_RESET_THRESHOLD) {
    index.nodeVisited.fill(0);
    index.edgeVisited.fill(0);
    index.stamp = 1;
  } else {
    index.stamp += 1;
  }
  const stamp = index.stamp;
  const minX = frustum.minX - FRUSTUM_CULL_PAD;
  const minY = frustum.minY - FRUSTUM_CULL_PAD;
  const maxX = frustum.maxX + FRUSTUM_CULL_PAD;
  const maxY = frustum.maxY + FRUSTUM_CULL_PAD;

  const c0 = clampCell(Math.floor((minX - index.minX) / index.cellSize), 0, index.cols - 1);
  const c1 = clampCell(Math.floor((maxX - index.minX) / index.cellSize), 0, index.cols - 1);
  const r0 = clampCell(Math.floor((minY - index.minY) / index.cellSize), 0, index.rows - 1);
  const r1 = clampCell(Math.floor((maxY - index.minY) / index.cellSize), 0, index.rows - 1);

  let edgeCount = 0;
  let nodeCount = 0;
  const { edgeVisited, nodeVisited, scratchEdgeIndices, scratchNodeIndices, edges, nodes } = index;

  for (let r = r0; r <= r1; r++) {
    const rowOffset = r * index.cols;
    for (let c = c0; c <= c1; c++) {
      const cellIdx = rowOffset + c;
      const eBucket = index.edgeCells[cellIdx];
      if (eBucket) {
        for (let k = 0; k < eBucket.length; k++) {
          const eIdx = eBucket[k]!;
          if (edgeVisited[eIdx] === stamp) continue;
          edgeVisited[eIdx] = stamp;
          const e = edges[eIdx]!;
          if (e.maxX >= minX && e.minX <= maxX && e.maxY >= minY && e.minY <= maxY) {
            scratchEdgeIndices[edgeCount++] = eIdx;
          }
        }
      }

      const nBucket = index.nodeCells[cellIdx];
      if (nBucket) {
        for (let k = 0; k < nBucket.length; k++) {
          const nIdx = nBucket[k]!;
          if (nodeVisited[nIdx] === stamp) continue;
          nodeVisited[nIdx] = stamp;
          const n = nodes[nIdx]!;
          if (
            n.x + NODE_BOUND_PAD >= minX &&
            n.x - NODE_BOUND_PAD <= maxX &&
            n.y + NODE_BOUND_PAD >= minY &&
            n.y - NODE_BOUND_PAD <= maxY
          ) {
            scratchNodeIndices[nodeCount++] = nIdx;
          }
        }
      }
    }
  }

  return { nodeIndices: scratchNodeIndices, nodeCount, edgeIndices: scratchEdgeIndices, edgeCount };
}

/** Finds the closest passive node within a finger-friendly touch radius around a tapped world point. */
export function hitTestPassiveTreeNode(params: {
  index: SpatialTreeIndex;
  lookup: TreeHighlightLookup;
  worldX: number;
  worldY: number;
  worldPerPx: number;
  viewWidth: number;
}): string | null {
  const { index, lookup, worldX, worldY, worldPerPx, viewWidth } = params;
  const touchPad = Math.min(260, Math.max(14, 22 * worldPerPx));
  const span = touchPad + 64;
  const c0 = clampCell(Math.floor((worldX - span - index.minX) / index.cellSize), 0, index.cols - 1);
  const c1 = clampCell(Math.floor((worldX + span - index.minX) / index.cellSize), 0, index.cols - 1);
  const r0 = clampCell(Math.floor((worldY - span - index.minY) / index.cellSize), 0, index.rows - 1);
  const r1 = clampCell(Math.floor((worldY + span - index.minY) / index.cellSize), 0, index.rows - 1);

  let bestId: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const hideMinorWireframe = viewWidth > 16500;

  for (let r = r0; r <= r1; r++) {
    const rowOffset = r * index.cols;
    for (let c = c0; c <= c1; c++) {
      const bucket = index.nodeCells[rowOffset + c];
      if (!bucket) continue;
      for (let k = 0; k < bucket.length; k++) {
        const idx = bucket[k]!;
        const node = index.nodes[idx]!;
        const role = lookup.nodeRoles[idx] ?? 0;
        const flags = lookup.nodeFlags[idx] ?? 0;
        if (hideMinorWireframe && role === 0 && flags === 0 && !node.isNotable && !node.isKeystone) {
          continue;
        }
        const baseR = node.isKeystone ? 48 : node.isNotable ? 36 : node.isJewelSocket || node.isMastery ? 32 : 22;
        const hitRadius = Math.max(baseR + 12, touchPad + baseR * 0.35);
        const dist = Math.hypot(node.x - worldX, node.y - worldY);
        if (dist > hitRadius) continue;

        const score = dist - (role !== 0 || node.isKeystone || node.isNotable ? 14 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestId = node.id;
        }
      }
    }
  }

  return bestId;
}
