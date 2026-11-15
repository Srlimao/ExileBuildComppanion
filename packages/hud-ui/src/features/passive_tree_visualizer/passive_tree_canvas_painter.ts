import type { PassiveTreeThemePalette } from "../theme/theme_tokens_and_palettes.js";
import {
  resolveEdgeBucketColor,
  resolveEdgeBucketWidth,
  resolveRoleColor,
  traceEdge,
  traceRoundedSquare,
} from "./passive_tree_painter_styles.js";
import {
  EDGE_STYLE_ALLOCATED,
  EDGE_STYLE_FUTURE,
  EDGE_STYLE_RESPEC,
  NODE_FLAG_POB_MASTERY,
  NODE_FLAG_RESPEC_DASH,
  NODE_FLAG_SEARCH,
  NODE_FLAG_SELECTED,
  queryVisibleTreePrimitives,
  type SpatialTreeIndex,
  type TreeHighlightLookup,
} from "./passive_tree_spatial_index.js";
import type { ViewportCamera } from "./pinch_zoom_math.js";

export { resolveAdaptiveCanvasDpr, type AdaptiveDprEnv } from "./passive_tree_painter_styles.js";

export interface PaintPassiveTreeParams {
  canvasWidth: number;
  canvasHeight: number;
  camera: ViewportCamera;
  isInteracting: boolean;
  spatialIndex: SpatialTreeIndex;
  lookup: TreeHighlightLookup;
  palette: PassiveTreeThemePalette;
}

const TAU = Math.PI * 2;
const RESPEC_EDGE_DASH = [32, 20];
const RESPEC_NODE_DASH = [16, 10];
const EMPTY_DASH: number[] = [];
const bucketHasEdge = new Uint8Array(6);

/** Paints a frustum-culled, batched, zoom-LOD frame of the PoE1 passive tree onto a 2D canvas. */
export function paintPassiveTreeFrame(
  ctx: CanvasRenderingContext2D,
  params: PaintPassiveTreeParams,
): void {
  const { canvasWidth, canvasHeight, camera, isInteracting, spatialIndex, lookup, palette } = params;
  if (canvasWidth <= 0 || canvasHeight <= 0 || camera.width <= 0) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const scale = canvasWidth / camera.width;
  const viewHeight = camera.width * (canvasHeight / canvasWidth);
  const minX = camera.centerX - camera.width / 2;
  const minY = camera.centerY - viewHeight / 2;
  ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);

  const query = queryVisibleTreePrimitives(spatialIndex, {
    minX,
    minY,
    maxX: minX + camera.width,
    maxY: minY + viewHeight,
  });

  const wideZoom = camera.width > 9500 || (isInteracting && camera.width > 7200);
  const ultraWideZoom = camera.width > 16500;
  const allowDashes = camera.width <= 14000;
  const lineCap: CanvasLineCap = wideZoom ? "butt" : "round";
  const { edges, nodes } = spatialIndex;
  const { edgeIndices, edgeCount, nodeIndices, nodeCount } = query;

  // Pass 1: Static wireframe edges (single batched stroke).
  ctx.beginPath();
  for (let i = 0; i < edgeCount; i++) {
    traceEdge(ctx, edges[edgeIndices[i]!]!, scale);
  }
  ctx.strokeStyle = palette.wireframeEdge;
  ctx.lineWidth = 14;
  ctx.lineCap = lineCap;
  ctx.stroke();

  // Pass 2: Static wireframe nodes with semantic zoom LOD.
  if (!ultraWideZoom) {
    ctx.beginPath();
    for (let i = 0; i < nodeCount; i++) {
      const n = nodes[nodeIndices[i]!]!;
      if (!n.isMastery) continue;
      ctx.moveTo(n.x + 30, n.y);
      ctx.arc(n.x, n.y, 30, 0, TAU);
    }
    ctx.fillStyle = palette.masteryFill;
    ctx.fill();
    if (!wideZoom) {
      ctx.strokeStyle = palette.nodeStroke;
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i < nodeCount; i++) {
      const n = nodes[nodeIndices[i]!]!;
      if (n.isMastery || n.isNotable || n.isKeystone) continue;
      ctx.moveTo(n.x + 18, n.y);
      ctx.arc(n.x, n.y, 18, 0, TAU);
    }
    ctx.fillStyle = palette.nodeFill;
    ctx.fill();
    if (!wideZoom) {
      ctx.strokeStyle = palette.nodeStroke;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  for (let i = 0; i < nodeCount; i++) {
    const n = nodes[nodeIndices[i]!]!;
    if (!n.isNotable && !n.isKeystone) continue;
    const r = n.isKeystone ? 42 : 32;
    ctx.moveTo(n.x + r, n.y);
    ctx.arc(n.x, n.y, r, 0, TAU);
  }
  ctx.fillStyle = palette.nodeFill;
  ctx.fill();
  if (!ultraWideZoom) {
    ctx.strokeStyle = palette.nodeStroke;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // Pass 3: Active build/progression highlight edges batched per palette bucket.
  bucketHasEdge.fill(0);
  for (let i = 0; i < edgeCount; i++) {
    const b = lookup.edgeBuckets[edgeIndices[i]!]!;
    if (b !== 0) bucketHasEdge[b] = 1;
  }

  ctx.globalAlpha = 0.92;
  ctx.lineCap = lineCap;
  for (let bucket = EDGE_STYLE_FUTURE; bucket >= EDGE_STYLE_ALLOCATED; bucket--) {
    if (bucketHasEdge[bucket] === 0) continue;
    ctx.beginPath();
    for (let i = 0; i < edgeCount; i++) {
      const eIdx = edgeIndices[i]!;
      if (lookup.edgeBuckets[eIdx] === bucket) traceEdge(ctx, edges[eIdx]!, scale);
    }
    ctx.strokeStyle = resolveEdgeBucketColor(bucket, palette);
    ctx.lineWidth = resolveEdgeBucketWidth(bucket);
    ctx.setLineDash(bucket === EDGE_STYLE_RESPEC && allowDashes ? RESPEC_EDGE_DASH : EMPTY_DASH);
    ctx.stroke();
  }
  ctx.setLineDash(EMPTY_DASH);
  ctx.globalAlpha = 1;

  // Pass 4: Highlighted, searched, and selected nodes.
  for (let i = 0; i < nodeCount; i++) {
    const nIdx = nodeIndices[i]!;
    const role = lookup.nodeRoles[nIdx]!;
    const flags = lookup.nodeFlags[nIdx]!;
    if (role === 0 && flags === 0) continue;

    const n = nodes[nIdx]!;
    const hasPobMastery = (flags & NODE_FLAG_POB_MASTERY) !== 0;
    const r = n.isKeystone ? 48 : n.isNotable || hasPobMastery ? 36 : n.isJewelSocket ? 32 : 23;
    const fill = resolveRoleColor(role, n.isMastery, palette);

    if ((flags & NODE_FLAG_SEARCH) !== 0) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 36, 0, TAU);
      ctx.strokeStyle = palette.searchRing;
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if ((flags & NODE_FLAG_SELECTED) !== 0) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 22, 0, TAU);
      ctx.strokeStyle = palette.selectedRing;
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    if (n.isKeystone) {
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - r);
      ctx.lineTo(n.x + r, n.y);
      ctx.lineTo(n.x, n.y + r);
      ctx.lineTo(n.x - r, n.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = palette.nodeRim;
      ctx.lineWidth = 8;
      ctx.stroke();
    } else if (n.isJewelSocket) {
      traceRoundedSquare(ctx, n.x, n.y, r, 8);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = palette.nodeRim;
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = n.isNotable ? palette.notableRim : palette.nodeRim;
      ctx.lineWidth = n.isNotable ? 9 : 6;
      if ((flags & NODE_FLAG_RESPEC_DASH) !== 0 && allowDashes) {
        ctx.setLineDash(RESPEC_NODE_DASH);
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);
      } else {
        ctx.stroke();
      }
    }
  }
}
