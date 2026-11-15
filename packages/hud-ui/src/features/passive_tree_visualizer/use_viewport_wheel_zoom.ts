import type React from "react";
import { useEffect, useRef } from "react";
import {
  computeCursorZoomCamera,
  resetGestureState,
  type GestureState,
  type ViewportCamera,
  type ViewportRect,
} from "./pinch_zoom_math.js";

const WHEEL_SETTLE_DELAY_MS = 140;

export function syncElementRect(
  el: HTMLElement | null,
  rectRef: React.MutableRefObject<ViewportRect>,
  minSize = 1,
): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= minSize || r.height <= minSize) return false;
  rectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
  return true;
}

/** Attaches passive-false wheel zoom, Safari pinch-gesture guards, and blur gesture reset. */
export function useViewportWheelZoom(params: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rectRef: React.MutableRefObject<ViewportRect>;
  cameraRef: React.MutableRefObject<ViewportCamera>;
  gestureRef: React.MutableRefObject<GestureState>;
  applyCamera: (next: ViewportCamera, isInteracting: boolean, settleImmediately?: boolean) => void;
  scheduleFrame: (isInteracting: boolean) => void;
  onCameraSettledRef: React.MutableRefObject<((camera: ViewportCamera) => void) | undefined>;
}): void {
  const {
    containerRef,
    rectRef,
    cameraRef,
    gestureRef,
    applyCamera,
    scheduleFrame,
    onCameraSettledRef,
  } = params;
  const wheelSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelSettleTimerRef.current === null) syncElementRect(el, rectRef);
      else clearTimeout(wheelSettleTimerRef.current);

      const rect = rectRef.current;
      if (rect.width <= 0 || rect.height <= 0) return;
      const factor = e.ctrlKey
        ? Math.min(1.35, Math.max(0.74, Math.exp(e.deltaY * 0.01)))
        : e.deltaY > 0
          ? 1.18
          : 0.85;
      applyCamera(computeCursorZoomCamera(e.clientX, e.clientY, factor, cameraRef.current, rect), true);
      wheelSettleTimerRef.current = setTimeout(() => {
        wheelSettleTimerRef.current = null;
        scheduleFrame(false);
        onCameraSettledRef.current?.(cameraRef.current);
      }, WHEEL_SETTLE_DELAY_MS);
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
      if (wheelSettleTimerRef.current !== null) {
        clearTimeout(wheelSettleTimerRef.current);
        wheelSettleTimerRef.current = null;
      }
    };
  }, [containerRef, rectRef, cameraRef, gestureRef, applyCamera, scheduleFrame, onCameraSettledRef]);
}
