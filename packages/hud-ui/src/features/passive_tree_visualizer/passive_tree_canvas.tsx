import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import type { SupportedGameId } from "@exile-hud/game-data";
import type React from "react";
import { memo, useEffect, useRef } from "react";
import { useHudTheme } from "../theme/hud_theme_provider.js";
import { paintPassiveTreeFrame, resolveAdaptiveCanvasDpr } from "./passive_tree_canvas_painter.js";
import type { BuiltTreeGeometry } from "./passive_tree_geometry_builder.js";
import { PassiveTreeCanvasOverlays } from "./passive_tree_node_tooltip.js";
import type {
  SpatialTreeIndex,
  TreeHighlightLookup,
  WeaponSetOverlayFilter,
} from "./passive_tree_spatial_index.js";
import type { CameraFrameListener, ViewportCamera } from "./use_pan_zoom_viewport.js";

interface PassiveTreeCanvasProps {
  gameId?: SupportedGameId;
  geometry: BuiltTreeGeometry;
  spatialIndex: SpatialTreeIndex;
  highlightLookup: TreeHighlightLookup;
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  characterClass: string;
  selectedNodeId: string | null;
  weaponSetFilter: WeaponSetOverlayFilter;
  onChangeWeaponSetFilter: (next: WeaponSetOverlayFilter) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getCamera: () => ViewportCamera;
  subscribeCamera: (listener: CameraFrameListener) => () => void;
  onSelectNode: (id: string | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  pointerHandlers: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
  >;
}

/** Hardware-friendly 2D Canvas passive tree renderer driven by imperative rAF viewport updates. */
export const PassiveTreeCanvas = memo(function PassiveTreeCanvas({
  gameId,
  geometry,
  spatialIndex,
  highlightLookup,
  diff,
  allocatedIds,
  characterClass,
  selectedNodeId,
  weaponSetFilter,
  onChangeWeaponSetFilter,
  containerRef,
  getCamera,
  subscribeCamera,
  onSelectNode,
  onZoomIn,
  onZoomOut,
  pointerHandlers,
}: PassiveTreeCanvasProps) {
  const { treePalette } = useHudTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawDepsRef = useRef({ spatialIndex, highlightLookup, treePalette, getCamera });
  drawDepsRef.current = { spatialIndex, highlightLookup, treePalette, getCamera };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctxRef.current = ctx;

    const drawCamera = (camera: ViewportCamera, isInteracting: boolean) => {
      const deps = drawDepsRef.current;
      paintPassiveTreeFrame(ctx, {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        camera,
        isInteracting,
        spatialIndex: deps.spatialIndex,
        lookup: deps.highlightLookup,
        palette: deps.treePalette,
      });
    };

    const syncBackingSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = resolveAdaptiveCanvasDpr();
      const targetW = Math.max(1, Math.round(rect.width * dpr));
      const targetH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      drawCamera(drawDepsRef.current.getCamera(), false);
    };

    syncBackingSize();
    const unsubscribe = subscribeCamera(drawCamera);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncBackingSize) : null;
    ro?.observe(container);

    return () => {
      unsubscribe();
      ro?.disconnect();
      ctxRef.current = null;
    };
  }, [containerRef, subscribeCamera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || canvas.width <= 0 || canvas.height <= 0) return;

    const render = () => {
      paintPassiveTreeFrame(ctx, {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        camera: getCamera(),
        isInteracting: false,
        spatialIndex,
        lookup: highlightLookup,
        palette: treePalette,
      });
    };

    if (typeof requestAnimationFrame !== "function") {
      render();
      return;
    }
    const rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [spatialIndex, highlightLookup, treePalette, getCamera]);

  return (
    <div
      ref={containerRef}
      {...pointerHandlers}
      data-testid="passive-tree-canvas"
      style={{ backgroundColor: treePalette.canvasBg }}
      className="relative flex-1 min-h-[430px] lg:min-h-[600px] rounded-lg border border-hud-hairline overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
    >
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />

      <PassiveTreeCanvasOverlays
        gameId={gameId}
        geometry={geometry}
        diff={diff}
        allocatedIds={allocatedIds}
        characterClass={characterClass}
        selectedNodeId={selectedNodeId}
        weaponSetFilter={weaponSetFilter}
        onChangeWeaponSetFilter={onChangeWeaponSetFilter}
        onSelectNode={onSelectNode}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    </div>
  );
});
