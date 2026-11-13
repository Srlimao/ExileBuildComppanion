import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import type { PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { memo } from "react";
import type { BuiltPoe1TreeGeometry, BuiltTreeEdge } from "./passive_tree_geometry_builder.js";
import { PassiveTreeCanvasOverlays } from "./passive_tree_node_tooltip.js";

const StaticWireframeLayer = memo(function StaticWireframeLayer({
  edges,
  nodes,
}: {
  edges: BuiltTreeEdge[];
  nodes: PassiveTreeNodeMetadata[];
}) {
  return (
    <g>
      {edges.map((edge) => (
        <path
          key={edge.key}
          d={edge.svgPath}
          fill="none"
          stroke="#1e293b"
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
          fill={node.isMastery ? "#090f1d" : "#0f172a"}
          stroke="#334155"
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
  onToggleAllocatedNodes: (nodeIds: string[], allocated: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  consumeDragMoved: () => boolean;
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
  onToggleAllocatedNodes,
  onZoomIn,
  onZoomOut,
  onPointerDown,
  onPointerMove,
  consumeDragMoved,
}: PassiveTreeCanvasSvgProps) {
  const addedSet = new Set(diff.addedInBracketIds);
  const missedSet = new Set(diff.earlierMissedIds);
  const respecSet = new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds]);
  const futureSet = new Set(diff.futureBracketIds);
  const specMasteries = diff.selectedSpec?.masteries ?? {};

  const activeEdgeStyle = (e: BuiltTreeEdge): { stroke: string; width: number; dash?: string } | null => {
    const aAlloc = allocatedIds.has(e.fromId);
    const bAlloc = allocatedIds.has(e.toId);
    if (aAlloc && bAlloc) return { stroke: "#10b981", width: 28 };
    const bothInTarget = diff.targetSet.has(e.fromId) && diff.targetSet.has(e.toId);
    if (bothInTarget) {
      if (addedSet.has(e.fromId) || addedSet.has(e.toId)) return { stroke: "#f59e0b", width: 24 };
      return { stroke: "#06b6d4", width: 22 };
    }
    if (respecSet.has(e.fromId) || respecSet.has(e.toId)) {
      return { stroke: "#f43f5e", width: 22, dash: "32 20" };
    }
    if (showFuture && (futureSet.has(e.fromId) || futureSet.has(e.toId))) {
      return { stroke: "#7c3aed", width: 16 };
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        if (!consumeDragMoved()) onSelectNode(null);
      }}
      className="relative flex-1 min-h-[430px] lg:min-h-[600px] rounded-xl border border-neutral-800 bg-[#020813] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
    >
      <svg viewBox={viewBox} className="w-full h-full block">
        <StaticWireframeLayer edges={visibleEdges} nodes={visibleNodes} />

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
              ? "#10b981"
              : isAdded && isTarget
                ? "#f59e0b"
                : isMissed
                  ? "#06b6d4"
                  : isRespec
                    ? "#f43f5e"
                    : hasPobMastery
                      ? "#6366f1"
                      : "#4c1d95";

            return (
              <g
                key={`n_${node.id}`}
                className="cursor-pointer"
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (!consumeDragMoved()) onSelectNode(node.id);
                }}
              >
                {isSearch && <circle cx={node.x} cy={node.y} r={r + 36} fill="none" stroke="#818cf8" strokeWidth={14} opacity={0.9} />}
                {isSel && <circle cx={node.x} cy={node.y} r={r + 22} fill="none" stroke="#ffffff" strokeWidth={10} />}
                {node.isKeystone ? (
                  <polygon
                    points={`${node.x},${node.y - r} ${node.x + r},${node.y} ${node.x},${node.y + r} ${node.x - r},${node.y}`}
                    fill={fill}
                    stroke="#020617"
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
                    stroke="#020617"
                    strokeWidth={8}
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={fill}
                    stroke={node.isNotable ? "#fef3c7" : "#020617"}
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
        onToggleAllocatedNodes={onToggleAllocatedNodes}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    </div>
  );
}
