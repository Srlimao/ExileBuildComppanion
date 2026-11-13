import { useCallback, useEffect, useRef, useState } from "react";
import type { TreeWorldBounds } from "./passive_tree_geometry_builder.js";

export interface ViewportCamera {
  centerX: number;
  centerY: number;
  width: number;
}

const MIN_VIEW_WIDTH = 1400;
const MAX_VIEW_WIDTH = 28000;

function clampWidth(w: number): number {
  return Math.max(MIN_VIEW_WIDTH, Math.min(MAX_VIEW_WIDTH, w));
}

/** Manages pointer drag pan, cursor-anchored wheel zoom, and camera fitting on SVG viewBox. */
export function usePanZoomViewport(initialBounds: TreeWorldBounds) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [camera, setCamera] = useState<ViewportCamera>(() => ({
    centerX: (initialBounds.minX + initialBounds.maxX) / 2,
    centerY: (initialBounds.minY + initialBounds.maxY) / 2,
    width: clampWidth(initialBounds.maxX - initialBounds.minX),
  }));

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origCenterX: number;
    origCenterY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setSize({ w: rect.width, h: rect.height });
      }
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
      const targetWidth = Math.max(spanW, spanH / Math.max(0.35, curAspect));
      setCamera({
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2,
        width: clampWidth(targetWidth),
      });
    },
    [aspect],
  );

  const focusPoint = useCallback((x: number, y: number, targetWidth = 3400) => {
    setCamera({ centerX: x, centerY: y, width: clampWidth(targetWidth) });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setCamera((prev) => ({ ...prev, width: clampWidth(prev.width * factor) }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const fx = (e.clientX - rect.left) / rect.width - 0.5;
      const fy = (e.clientY - rect.top) / rect.height - 0.5;
      const factor = e.deltaY > 0 ? 1.18 : 0.85;
      setCamera((prev) => {
        const curH = prev.width * (rect.height / rect.width);
        const nextW = clampWidth(prev.width * factor);
        const nextH = nextW * (rect.height / rect.width);
        return {
          centerX: prev.centerX + fx * (prev.width - nextW),
          centerY: prev.centerY + fy * (curH - nextH),
          width: nextW,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-tree-overlay-ui='true']")) return;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        origCenterX: camera.centerX,
        origCenterY: camera.centerY,
        moved: false,
      };
    },
    [camera.centerX, camera.centerY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const el = containerRef.current;
      if (!drag?.active || !el) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const rect = el.getBoundingClientRect();
      const worldPerPx = camera.width / Math.max(1, rect.width);
      setCamera((prev) => ({
        ...prev,
        centerX: drag.origCenterX - dx * worldPerPx,
        centerY: drag.origCenterY - dy * worldPerPx,
      }));
    },
    [camera.width],
  );

  const consumeDragMoved = useCallback(() => {
    const moved = Boolean(dragRef.current?.moved);
    dragRef.current = null;
    return moved;
  }, []);

  return {
    containerRef,
    viewBox,
    viewWidth: camera.width,
    fitBounds,
    focusPoint,
    zoomBy,
    onPointerDown,
    onPointerMove,
    consumeDragMoved,
  };
}
