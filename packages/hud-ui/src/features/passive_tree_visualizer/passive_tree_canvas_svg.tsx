import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import type { PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import type React from "react";
import { memo } from "react";
import { useHudTheme } from "../theme/hud_theme_provider.js";
import type { PassiveTreeThemePalette } from "../theme/theme_tokens_and_palettes.js";
import type { BuiltPoe1TreeGeometry, BuiltTreeEdge } from "./passive_tree_geometry_builder.js";
import { PassiveTreeCanvasOverlays } from "./passive_tree_node_tooltip.js";

const StaticWireframeLayer = memo(function StaticWireframeLayer({
  edges,
  nodes,
  palette,
}: {
  edges: BuiltTreeEdge[];
  nodes: PassiveTreeNodeMetadata[];
  palette: PassiveTreeThemePalette;
}) {
  return (
    <g>
      {edges.map((edge) => (
        <path
          key={edge.key}
          d={edge.svgPath}
          fill="none"
          stroke={palette.wireframeEdge}
          strokeWidth={14}
          strokeLinecap="round"
        />
      ))}
      {nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={node.isKeystone ? 42 : node.isNotable ? 32 : node.isMastery ? 30 : 18}
          fill={node.isMastery ? palette.masteryFill : palette.nodeFill}
          stroke={palette.nodeStroke}
          strokeWidth={node.isNotable || node.isKeystone ? 8 : 5}
        />
      ))}
    </g>
  );
});

interface PassiveTreeCanvasSvgProps {
  geometry: BuiltPoe1TreeGeometry;
  visibleEdges: BuiltTreeEdge[];
  visibleNodes: PassiveTreeNodeMetadata[];
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  characterClass: string;
  showFuture: boolean;
  searchMatchIds: ReadonlySet<string>;
  selectedNodeId: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewBox: string;
  onSelectNode: (id: string | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  pointerHandlers: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
  >;
}

export function PassiveTreeCanvasSvg({
  geometry,
  visibleEdges,
  visibleNodes,
  diff,
  allocatedIds,
  characterClass,
  showFuture,
  searchMatchIds,
  selectedNodeId,
  containerRef,
  viewBox,
  onSelectNode,
  onZoomIn,
  onZoomOut,
  pointerHandlers,
}: PassiveTreeCanvasSvgProps) {
  const { treePalette } = useHudTheme();
  const addedSet = new Set(diff.addedInBracketIds);
  const missedSet = new Set(diff.earlierMissedIds);
  const respecSet = new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds]);
  const futureSet = new Set(diff.futureBracketIds);
  const specMasteries = diff.selectedSpec?.masteries ?? {};

  const activeEdgeStyle = (e: BuiltTreeEdge): { stroke: string; width: number; dash?: string } | null => {
    const aAlloc = allocatedIds.has(e.fromId);
    const bAlloc = allocatedIds.has(e.toId);
    if (aAlloc && bAlloc) return { stroke: treePalette.allocated, width: 28 };
    const bothInTarget = diff.targetSet.has(e.fromId) && diff.targetSet.has(e.toId);
    if (bothInTarget) {
      if (addedSet.has(e.fromId) || addedSet.has(e.toId)) return { stroke: treePalette.newBracket, width: 24 };
      return { stroke: treePalette.earlier, width: 22 };
    }
    if (respecSet.has(e.fromId) || respecSet.has(e.toId)) {
      return { stroke: treePalette.respec, width: 22, dash: "32 20" };
    }
    if (showFuture && (futureSet.has(e.fromId) || futureSet.has(e.toId))) {
      return { stroke: treePalette.future, width: 16 };
    }
    return null;
  };

  const highlightNodeIds = new Set<string>([
    ...allocatedIds,
    ...diff.targetSet,
    ...respecSet,
    ...(showFuture ? futureSet : []),
    ...searchMatchIds,
    ...(selectedNodeId ? [selectedNodeId] : []),
  ]);

  return (
    <div
      ref={containerRef}
      {...pointerHandlers}
      data-testid="passive-tree-canvas"
      style={{ backgroundColor: treePalette.canvasBg }}
      className="relative flex-1 min-h-[430px] lg:min-h-[600px] rounded-lg border border-hud-hairline overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
    >
      <svg viewBox={viewBox} className="w-full h-full block touch-none">
        <StaticWireframeLayer edges={visibleEdges} nodes={visibleNodes} palette={treePalette} />

        <g>
          {visibleEdges.map((edge) => {
            const st = activeEdgeStyle(edge);
            if (!st) return null;
            return (
              <path
                key={`hi_${edge.key}`}
                d={edge.svgPath}
                fill="none"
                stroke={st.stroke}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                strokeLinecap="round"
                opacity={0.92}
              />
            );
          })}
        </g>

        <g>
          {visibleNodes.map((node) => {
            if (!highlightNodeIds.has(node.id)) return null;
            const isAlloc = allocatedIds.has(node.id);
            const isTarget = diff.targetSet.has(node.id);
            const isAdded = addedSet.has(node.id);
            const isMissed = missedSet.has(node.id);
            const isRespec = respecSet.has(node.id);
            const isSearch = searchMatchIds.has(node.id);
            const isSel = selectedNodeId === node.id;
            const hasPobMastery = Boolean(node.isMastery && specMasteries[node.id]);

            const r = node.isKeystone ? 48 : node.isNotable || hasPobMastery ? 36 : node.isJewelSocket ? 32 : 23;
            const fill = isAlloc
              ? treePalette.allocated
              : isAdded && isTarget
                ? treePalette.newBracket
                : isMissed
                  ? treePalette.earlier
                  : isRespec
                    ? treePalette.respec
                    : hasPobMastery
                      ? treePalette.masteryActive
                      : treePalette.future;

            return (
              <g key={`n_${node.id}`} data-tree-node-id={node.id} className="cursor-pointer">
                {isSearch && (
                  <circle cx={node.x} cy={node.y} r={r + 36} fill="none" stroke={treePalette.searchRing} strokeWidth={14} opacity={0.9} />
                )}
                {isSel && (
                  <circle cx={node.x} cy={node.y} r={r + 22} fill="none" stroke={treePalette.selectedRing} strokeWidth={10} />
                )}
                {node.isKeystone ? (
                  <polygon
                    points={`${node.x},${node.y - r} ${node.x + r},${node.y} ${node.x},${node.y + r} ${node.x - r},${node.y}`}
                    fill={fill}
                    stroke={treePalette.nodeRim}
                    strokeWidth={8}
                  />
                ) : node.isJewelSocket ? (
                  <rect
                    x={node.x - r}
                    y={node.y - r}
                    width={r * 2}
                    height={r * 2}
                    rx={8}
                    fill={fill}
                    stroke={treePalette.nodeRim}
                    strokeWidth={8}
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={fill}
                    stroke={node.isNotable ? treePalette.notableRim : treePalette.nodeRim}
                    strokeWidth={node.isNotable ? 9 : 6}
                    strokeDasharray={isRespec ? "16 10" : undefined}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <PassiveTreeCanvasOverlays
        geometry={geometry}
        diff={diff}
        allocatedIds={allocatedIds}
        characterClass={characterClass}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    </div>
  );
}
