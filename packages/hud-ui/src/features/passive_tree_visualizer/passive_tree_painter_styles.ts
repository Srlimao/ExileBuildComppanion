import type { PassiveTreeThemePalette } from "../theme/theme_tokens_and_palettes.js";
import type { BuiltTreeEdge } from "./passive_tree_geometry_builder.js";
import {
  EDGE_STYLE_ALLOCATED,
  EDGE_STYLE_EARLIER,
  EDGE_STYLE_FUTURE,
  EDGE_STYLE_NEW_BRACKET,
  EDGE_STYLE_RESPEC,
  NODE_ROLE_ALLOCATED,
  NODE_ROLE_EARLIER,
  NODE_ROLE_FUTURE,
  NODE_ROLE_MASTERY_ACTIVE,
  NODE_ROLE_NEW_BRACKET,
  NODE_ROLE_RESPEC,
  NODE_ROLE_WIREFRAME,
} from "./passive_tree_highlight_lookup.js";

export interface AdaptiveDprEnv {
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  coarsePointer?: boolean;
}

/** Caps canvas backing-store DPR on low-end or coarse-pointer tablets to reduce tile-GPU fill-rate cost. */
export function resolveAdaptiveCanvasDpr(env?: AdaptiveDprEnv): number {
  const rawDpr =
    env?.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
  const cores =
    env?.hardwareConcurrency ??
    (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined);
  const memoryGb =
    env?.deviceMemory ??
    (typeof navigator !== "undefined" ? (navigator as { deviceMemory?: number }).deviceMemory : undefined);
  const coarsePointer =
    env?.coarsePointer ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false);

  const isLowEndTablet =
    (cores !== undefined && cores <= 4) ||
    (memoryGb !== undefined && memoryGb <= 4) ||
    (coarsePointer && cores !== undefined && cores <= 6);

  return Math.max(1, Math.min(dpr, isLowEndTablet ? 1.25 : 2.0));
}

export function traceEdge(ctx: CanvasRenderingContext2D, edge: BuiltTreeEdge, scale: number): void {
  ctx.moveTo(edge.x1, edge.y1);
  if (edge.arc && edge.arc.radius * scale >= 6) {
    ctx.arc(
      edge.arc.cx,
      edge.arc.cy,
      edge.arc.radius,
      edge.arc.startAngle,
      edge.arc.endAngle,
      edge.arc.counterclockwise,
    );
  } else {
    ctx.lineTo(edge.x2, edge.y2);
  }
}

export function traceRoundedSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  corner: number,
): void {
  const left = x - r;
  const top = y - r;
  const size = r * 2;
  ctx.beginPath();
  ctx.moveTo(left + corner, top);
  ctx.lineTo(left + size - corner, top);
  ctx.arcTo(left + size, top, left + size, top + corner, corner);
  ctx.lineTo(left + size, top + size - corner);
  ctx.arcTo(left + size, top + size, left + size - corner, top + size, corner);
  ctx.lineTo(left + corner, top + size);
  ctx.arcTo(left, top + size, left, top + size - corner, corner);
  ctx.lineTo(left, top + corner);
  ctx.arcTo(left, top, left + corner, top, corner);
  ctx.closePath();
}

export function resolveRoleColor(
  role: number,
  isMastery: boolean,
  palette: PassiveTreeThemePalette,
): string {
  switch (role) {
    case NODE_ROLE_ALLOCATED:
      return palette.allocated;
    case NODE_ROLE_NEW_BRACKET:
      return palette.newBracket;
    case NODE_ROLE_EARLIER:
      return palette.earlier;
    case NODE_ROLE_RESPEC:
      return palette.respec;
    case NODE_ROLE_MASTERY_ACTIVE:
      return palette.masteryActive;
    case NODE_ROLE_FUTURE:
      return palette.future;
    case NODE_ROLE_WIREFRAME:
    default:
      return isMastery ? palette.masteryFill : palette.nodeFill;
  }
}

export function resolveEdgeBucketColor(bucket: number, palette: PassiveTreeThemePalette): string {
  switch (bucket) {
    case EDGE_STYLE_ALLOCATED:
      return palette.allocated;
    case EDGE_STYLE_NEW_BRACKET:
      return palette.newBracket;
    case EDGE_STYLE_EARLIER:
      return palette.earlier;
    case EDGE_STYLE_RESPEC:
      return palette.respec;
    case EDGE_STYLE_FUTURE:
    default:
      return palette.future;
  }
}

export function resolveEdgeBucketWidth(bucket: number): number {
  switch (bucket) {
    case EDGE_STYLE_ALLOCATED:
      return 28;
    case EDGE_STYLE_NEW_BRACKET:
      return 24;
    case EDGE_STYLE_EARLIER:
    case EDGE_STYLE_RESPEC:
      return 22;
    case EDGE_STYLE_FUTURE:
    default:
      return 16;
  }
}
