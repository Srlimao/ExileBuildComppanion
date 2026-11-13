import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeWorldBounds } from "./passive_tree_geometry_builder.js";
import {
  clampViewWidth,
  computeCursorZoomCamera,
  computePinchedCamera,
  computeSinglePanCamera,
  createGestureState,
  reanchorGestureState,
  resetGestureState,
  type ViewportCamera,
} from "./pinch_zoom_math.js";

export type { ViewportCamera } from "./pinch_zoom_math.js";

/** Manages multi-touch pinch-to-zoom, 1-finger/mouse pan, cursor wheel zoom, and node tap detection on SVG viewBox. */
export function usePanZoomViewport(
  initialBounds: TreeWorldBounds,
  onTapNode?: (nodeId: string | null) => void,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const initialCamera: ViewportCamera = {
    centerX: (initialBounds.minX + initialBounds.maxX) / 2,
    centerY: (initialBounds.minY + initialBounds.maxY) / 2,
    width: clampViewWidth(initialBounds.maxX - initialBounds.minX),
  };
  const [camera, setCamera] = useState<ViewportCamera>(initialCamera);
  const cameraRef = useRef<ViewportCamera>(initialCamera);
  const onTapNodeRef = useRef(onTapNode);
  onTapNodeRef.current = onTapNode;
  const gestureRef = useRef(createGestureState());

  const applyCamera = useCallback((next: ViewportCamera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aspect = Math.max(0.4, size.h / Math.max(1, size.w));
  const viewHeight = camera.width * aspect;
  const viewBox = `${Math.round(camera.centerX - camera.width / 2)} ${Math.round(camera.centerY - viewHeight / 2)} ${Math.round(camera.width)} ${Math.round(viewHeight)}`;

  const fitBounds = useCallback(
    (bounds: TreeWorldBounds) => {
      const spanW = Math.max(1400, bounds.maxX - bounds.minX);
      const spanH = Math.max(1400, bounds.maxY - bounds.minY);
      const rect = containerRef.current?.getBoundingClientRect();
      const curAspect = rect && rect.width > 40 ? rect.height / rect.width : aspect;
      applyCamera({
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2,
        width: clampViewWidth(Math.max(spanW, spanH / Math.max(0.35, curAspect))),
      });
    },
    [applyCamera, aspect],
  );

  const focusPoint = useCallback(
    (x: number, y: number, targetWidth = 3400) => {
      applyCamera({ centerX: x, centerY: y, width: clampViewWidth(targetWidth) });
    },
    [applyCamera],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const prev = cameraRef.current;
      applyCamera({ ...prev, width: clampViewWidth(prev.width * factor) });
    },
    [applyCamera],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const factor = e.ctrlKey
        ? Math.min(1.35, Math.max(0.74, Math.exp(e.deltaY * 0.01)))
        : e.deltaY > 0
          ? 1.18
          : 0.85;
      applyCamera(computeCursorZoomCamera(e.clientX, e.clientY, factor, cameraRef.current, rect));
    };
    const preventGesture = (e: Event) => e.preventDefault();
    const onBlur = () => resetGestureState(gestureRef.current);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", preventGesture, { passive: false });
    el.addEventListener("gesturechange", preventGesture, { passive: false });
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", preventGesture);
      el.removeEventListener("gesturechange", preventGesture);
      window.removeEventListener("blur", onBlur);
    };
  }, [applyCamera]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const targetEl = e.target as Element | null;
    if (targetEl?.closest?.("[data-tree-overlay-ui='true']")) return;
    const el = containerRef.current;
    if (!el) return;

    const g = gestureRef.current;
    if (g.pointers.size === 0) {
      g.moved = false;
      g.hadMultiTouch = false;
      g.tapCandidateNodeId = targetEl?.closest?.("[data-tree-node-id]")?.getAttribute("data-tree-node-id") ?? null;
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events where pointerId is inactive
    }
    if (g.pointers.size >= 2) {
      g.hadMultiTouch = true;
      g.moved = true;
      g.tapCandidateNodeId = null;
    }
    reanchorGestureState(g, cameraRef.current, el.getBoundingClientRect());
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      const el = containerRef.current;
      if (!el || !g.pointers.has(e.pointerId)) return;

      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = el.getBoundingClientRect();
      if (g.pointers.size >= 2 && g.pinch) {
        const [p1, p2] = [...g.pointers.values()];
        if (p1 && p2) applyCamera(computePinchedCamera(p1, p2, g.pinch, rect));
        return;
      }
      if (g.pointers.size === 1 && g.pan && g.pan.pointerId === e.pointerId) {
        if (Math.hypot(e.clientX - g.pan.startX, e.clientY - g.pan.startY) > 6) g.moved = true;
        if (g.moved) applyCamera(computeSinglePanCamera(g.pan, e.clientX, e.clientY, cameraRef.current, rect.width));
      }
    },
    [applyCamera],
  );

  const finishPointer = useCallback((e: React.PointerEvent<HTMLDivElement>, allowTap: boolean) => {
    const g = gestureRef.current;
    if (!g.pointers.has(e.pointerId)) return;

    const el = containerRef.current;
    g.pointers.delete(e.pointerId);
    if (el) {
      try {
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore release error
      }
    }
    if (g.pointers.size > 0) {
      if (el) reanchorGestureState(g, cameraRef.current, el.getBoundingClientRect());
      return;
    }
    const shouldTap = allowTap && !g.moved && !g.hadMultiTouch;
    const tappedNode = g.tapCandidateNodeId;
    resetGestureState(g);
    if (shouldTap) onTapNodeRef.current?.(tappedNode);
  }, []);

  const pointerHandlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => finishPointer(e, true),
      onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => finishPointer(e, false),
    }),
    [onPointerDown, onPointerMove, finishPointer],
  );

  return { containerRef, viewBox, viewWidth: camera.width, fitBounds, focusPoint, zoomBy, pointerHandlers };
}
