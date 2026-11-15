import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TreeWorldBounds } from "./passive_tree_camera_bounds.js";
import {
  clampViewWidth,
  computePinchedCamera,
  computeSinglePanCamera,
  createGestureState,
  reanchorGestureState,
  resetGestureState,
  screenPointToWorld,
  type ViewportCamera,
  type ViewportRect,
  type WorldPointHit,
} from "./pinch_zoom_math.js";
import { syncElementRect, useViewportWheelZoom } from "./use_viewport_wheel_zoom.js";

export type { ViewportCamera, WorldPointHit } from "./pinch_zoom_math.js";

export type CameraFrameListener = (camera: ViewportCamera, isInteracting: boolean) => void;

export interface UsePanZoomViewportOptions {
  initialBounds: TreeWorldBounds;
  initialCameraOverride?: ViewportCamera | null;
  onTapWorldPoint?: (hit: WorldPointHit, viewWidth: number) => void;
  onCameraSettled?: (camera: ViewportCamera) => void;
}

/** Imperative rAF pan/pinch/wheel viewport hook that drives the 2D canvas without React re-renders. */
export function usePanZoomViewport({
  initialBounds,
  initialCameraOverride,
  onTapWorldPoint,
  onCameraSettled,
}: UsePanZoomViewportOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<ViewportRect>({ left: 0, top: 0, width: 1000, height: 700 });

  const initialCamera: ViewportCamera = initialCameraOverride
    ? {
        centerX: initialCameraOverride.centerX,
        centerY: initialCameraOverride.centerY,
        width: clampViewWidth(initialCameraOverride.width),
      }
    : {
        centerX: (initialBounds.minX + initialBounds.maxX) / 2,
        centerY: (initialBounds.minY + initialBounds.maxY) / 2,
        width: clampViewWidth(initialBounds.maxX - initialBounds.minX),
      };

  const cameraRef = useRef<ViewportCamera>(initialCamera);
  const gestureRef = useRef(createGestureState());
  const subscribersRef = useRef(new Set<CameraFrameListener>());
  const rafIdRef = useRef<number | null>(null);
  const interactingRef = useRef(false);

  const onTapWorldPointRef = useRef(onTapWorldPoint);
  onTapWorldPointRef.current = onTapWorldPoint;
  const onCameraSettledRef = useRef(onCameraSettled);
  onCameraSettledRef.current = onCameraSettled;

  const scheduleFrame = useCallback((isInteracting: boolean) => {
    if (isInteracting) interactingRef.current = true;
    if (rafIdRef.current !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      const interacting = interactingRef.current;
      interactingRef.current = false;
      for (const listener of subscribersRef.current) listener(cameraRef.current, interacting);
      return;
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const interacting = interactingRef.current;
      interactingRef.current = false;
      for (const listener of subscribersRef.current) listener(cameraRef.current, interacting);
    });
  }, []);

  const applyCamera = useCallback(
    (next: ViewportCamera, isInteracting: boolean, settleImmediately = false) => {
      cameraRef.current = next;
      scheduleFrame(isInteracting);
      if (settleImmediately) onCameraSettledRef.current?.(next);
    },
    [scheduleFrame],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onResize = () => {
      if (syncElementRect(el, rectRef, 40)) scheduleFrame(false);
    };
    onResize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleFrame]);

  useEffect(
    () => () => {
      if (rafIdRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    },
    [],
  );

  useViewportWheelZoom({
    containerRef,
    rectRef,
    cameraRef,
    gestureRef,
    applyCamera,
    scheduleFrame,
    onCameraSettledRef,
  });

  const fitBounds = useCallback(
    (bounds: TreeWorldBounds) => {
      const spanW = Math.max(1400, bounds.maxX - bounds.minX);
      const spanH = Math.max(1400, bounds.maxY - bounds.minY);
      syncElementRect(containerRef.current, rectRef, 40);
      const rect = rectRef.current;
      const curAspect = rect.width > 40 ? rect.height / rect.width : 0.7;
      applyCamera(
        {
          centerX: (bounds.minX + bounds.maxX) / 2,
          centerY: (bounds.minY + bounds.maxY) / 2,
          width: clampViewWidth(Math.max(spanW, spanH / Math.max(0.35, curAspect))),
        },
        false,
        true,
      );
    },
    [applyCamera],
  );

  const focusPoint = useCallback(
    (x: number, y: number, targetWidth = 3400) => {
      applyCamera({ centerX: x, centerY: y, width: clampViewWidth(targetWidth) }, false, true);
    },
    [applyCamera],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const prev = cameraRef.current;
      applyCamera({ ...prev, width: clampViewWidth(prev.width * factor) }, false, true);
    },
    [applyCamera],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const targetEl = e.target as Element | null;
    if (targetEl?.closest?.("[data-tree-overlay-ui='true']")) return;
    const el = containerRef.current;
    if (!el) return;

    syncElementRect(el, rectRef);
    const g = gestureRef.current;
    if (g.pointers.size === 0) {
      g.moved = false;
      g.hadMultiTouch = false;
      g.tapStartX = e.clientX;
      g.tapStartY = e.clientY;
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
    }
    reanchorGestureState(g, cameraRef.current, rectRef.current);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g.pointers.has(e.pointerId)) return;

      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = rectRef.current;
      if (g.pointers.size >= 2 && g.pinch) {
        const [p1, p2] = [...g.pointers.values()];
        if (p1 && p2) applyCamera(computePinchedCamera(p1, p2, g.pinch, rect), true);
        return;
      }
      if (g.pointers.size === 1 && g.pan && g.pan.pointerId === e.pointerId) {
        if (Math.hypot(e.clientX - g.pan.startX, e.clientY - g.pan.startY) > 6) g.moved = true;
        if (g.moved) {
          applyCamera(
            computeSinglePanCamera(g.pan, e.clientX, e.clientY, cameraRef.current, rect.width),
            true,
          );
        }
      }
    },
    [applyCamera],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, allowTap: boolean) => {
      const g = gestureRef.current;
      if (!g.pointers.has(e.pointerId)) return;

      const el = containerRef.current;
      g.pointers.delete(e.pointerId);
      try {
        if (el?.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore release error
      }
      if (g.pointers.size > 0) {
        reanchorGestureState(g, cameraRef.current, rectRef.current);
        return;
      }

      const wasDragging = g.moved || g.hadMultiTouch;
      const shouldTap = allowTap && !wasDragging;
      const tapX = g.tapStartX;
      const tapY = g.tapStartY;
      resetGestureState(g);

      if (wasDragging) {
        scheduleFrame(false);
        onCameraSettledRef.current?.(cameraRef.current);
      } else if (shouldTap) {
        const cam = cameraRef.current;
        onTapWorldPointRef.current?.(screenPointToWorld(tapX, tapY, cam, rectRef.current), cam.width);
      }
    },
    [scheduleFrame],
  );

  const subscribeCamera = useCallback((listener: CameraFrameListener) => {
    subscribersRef.current.add(listener);
    return () => {
      subscribersRef.current.delete(listener);
    };
  }, []);

  const getCamera = useCallback(() => cameraRef.current, []);

  const pointerHandlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => finishPointer(e, true),
      onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => finishPointer(e, false),
    }),
    [onPointerDown, onPointerMove, finishPointer],
  );

  return { containerRef, getCamera, subscribeCamera, fitBounds, focusPoint, zoomBy, pointerHandlers };
}
