export interface ViewportCamera {
  centerX: number;
  centerY: number;
  width: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PointerPoint {
  x: number;
  y: number;
}

export interface PinchAnchor {
  startDist: number;
  startWidth: number;
  worldX: number;
  worldY: number;
}

export interface PanAnchor {
  pointerId: number;
  startX: number;
  startY: number;
  origCenterX: number;
  origCenterY: number;
}

export interface GestureState {
  pointers: Map<number, PointerPoint>;
  pan: PanAnchor | null;
  pinch: PinchAnchor | null;
  tapStartX: number;
  tapStartY: number;
  moved: boolean;
  hadMultiTouch: boolean;
}

export interface WorldPointHit {
  worldX: number;
  worldY: number;
  worldPerPx: number;
}

export function createGestureState(): GestureState {
  return {
    pointers: new Map(),
    pan: null,
    pinch: null,
    tapStartX: 0,
    tapStartY: 0,
    moved: false,
    hadMultiTouch: false,
  };
}

export function resetGestureState(g: GestureState): void {
  g.pointers.clear();
  g.pan = null;
  g.pinch = null;
  g.tapStartX = 0;
  g.tapStartY = 0;
  g.moved = false;
  g.hadMultiTouch = false;
}

export function reanchorGestureState(g: GestureState, camera: ViewportCamera, rect: ViewportRect): void {
  if (g.pointers.size === 0) {
    g.pan = null;
    g.pinch = null;
    return;
  }
  if (g.pointers.size === 1) {
    const [entry] = g.pointers.entries();
    if (!entry) return;
    g.pinch = null;
    g.pan = {
      pointerId: entry[0],
      startX: entry[1].x,
      startY: entry[1].y,
      origCenterX: camera.centerX,
      origCenterY: camera.centerY,
    };
    return;
  }
  const [p1, p2] = [...g.pointers.values()];
  if (!p1 || !p2) return;
  g.pan = null;
  g.pinch = createPinchAnchor(p1, p2, camera, rect);
}

export function computeSinglePanCamera(
  pan: PanAnchor,
  clientX: number,
  clientY: number,
  camera: ViewportCamera,
  rectWidth: number,
): ViewportCamera {
  const worldPerPx = camera.width / Math.max(1, rectWidth);
  return {
    ...camera,
    centerX: pan.origCenterX - (clientX - pan.startX) * worldPerPx,
    centerY: pan.origCenterY - (clientY - pan.startY) * worldPerPx,
  };
}

export const MIN_VIEW_WIDTH = 650;
export const MAX_VIEW_WIDTH = 30000;

export function clampViewWidth(w: number): number {
  return Math.max(MIN_VIEW_WIDTH, Math.min(MAX_VIEW_WIDTH, w));
}

export function createPinchAnchor(
  p1: PointerPoint,
  p2: PointerPoint,
  camera: ViewportCamera,
  rect: ViewportRect,
): PinchAnchor {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const startDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const fx = (midX - rect.left) / w - 0.5;
  const fy = (midY - rect.top) / h - 0.5;
  const curHeight = camera.width * (h / w);
  return {
    startDist,
    startWidth: camera.width,
    worldX: camera.centerX + fx * camera.width,
    worldY: camera.centerY + fy * curHeight,
  };
}

export function computePinchedCamera(
  p1: PointerPoint,
  p2: PointerPoint,
  anchor: PinchAnchor,
  rect: ViewportRect,
): ViewportCamera {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const curDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const nextWidth = clampViewWidth(anchor.startWidth * (anchor.startDist / curDist));
  const nextHeight = nextWidth * (h / w);
  const fx = (midX - rect.left) / w - 0.5;
  const fy = (midY - rect.top) / h - 0.5;
  return {
    centerX: anchor.worldX - fx * nextWidth,
    centerY: anchor.worldY - fy * nextHeight,
    width: nextWidth,
  };
}

export function computeCursorZoomCamera(
  clientX: number,
  clientY: number,
  factor: number,
  prev: ViewportCamera,
  rect: ViewportRect,
): ViewportCamera {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const fx = (clientX - rect.left) / w - 0.5;
  const fy = (clientY - rect.top) / h - 0.5;
  const curH = prev.width * (h / w);
  const nextW = clampViewWidth(prev.width * factor);
  const nextH = nextW * (h / w);
  return {
    centerX: prev.centerX + fx * (prev.width - nextW),
    centerY: prev.centerY + fy * (curH - nextH),
    width: nextW,
  };
}

/** Converts a client-space pointer coordinate into passive-tree world coordinates and scale. */
export function screenPointToWorld(
  clientX: number,
  clientY: number,
  camera: ViewportCamera,
  rect: ViewportRect,
): WorldPointHit {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const worldPerPx = camera.width / w;
  const fx = (clientX - rect.left) / w - 0.5;
  const fy = (clientY - rect.top) / h - 0.5;
  const viewHeight = camera.width * (h / w);
  return {
    worldX: camera.centerX + fx * camera.width,
    worldY: camera.centerY + fy * viewHeight,
    worldPerPx,
  };
}
