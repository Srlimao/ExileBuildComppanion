import {
  isAscendancyMilestoneNode,
  type AscendancyOrderStep,
  type AscendancyProgressionPlan,
} from "@exile-hud/core";
import { memo, useMemo } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { getBuiltPoe1TreeGeometry } from "../passive_tree_visualizer/passive_tree_geometry_builder.js";
import { useHudTheme } from "../theme/hud_theme_provider.js";

interface AscendancyTreeSvgPreviewProps {
  plan: AscendancyProgressionPlan;
  focusedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onHoverNode: (nodeId: string | null) => void;
}

/** Read-only SVG diagram showing strictly the active Ascendancy cluster and numbered Lab path. */
export const AscendancyTreeSvgPreview = memo(function AscendancyTreeSvgPreview({
  plan,
  focusedNodeId,
  onSelectNode,
  onHoverNode,
}: AscendancyTreeSvgPreviewProps) {
  const { theme, treePalette } = useHudTheme();
  const { msg } = useHudI18n();
  const t = msg.widgets.ascendancyOrder;

  const { nodes, edges, viewBox } = useMemo(() => {
    if (!plan.clusterKey) {
      return { nodes: [], edges: [], viewBox: "-100 -100 200 200" };
    }
    const geometry = getBuiltPoe1TreeGeometry();
    const clusterNodes = geometry.allNodesList.filter(
      (n) => !n.isBlighted && n.ascendancyName === plan.clusterKey,
    );
    const clusterEdges = geometry.edges.filter((e) => e.ascendancyName === plan.clusterKey);

    let minX = -100;
    let maxX = 100;
    let minY = -100;
    let maxY = 100;
    if (clusterNodes.length > 0) {
      minX = Number.POSITIVE_INFINITY;
      maxX = Number.NEGATIVE_INFINITY;
      minY = Number.POSITIVE_INFINITY;
      maxY = Number.NEGATIVE_INFINITY;
      for (const n of clusterNodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      }
      minX -= 110;
      maxX += 110;
      minY -= 110;
      maxY += 110;
    }

    return {
      nodes: clusterNodes,
      edges: clusterEdges,
      viewBox: `${minX} ${minY} ${Math.max(120, maxX - minX)} ${Math.max(120, maxY - minY)}`,
    };
  }, [plan.clusterKey]);

  const plannedSet = useMemo(() => new Set(plan.plannedNodeIds), [plan.plannedNodeIds]);
  const allocSet = useMemo(() => new Set(plan.allocatedAscendancyNodeIds), [plan.allocatedAscendancyNodeIds]);
  const respecSet = useMemo(() => new Set(plan.respecSteps.map((r) => r.nodeId)), [plan.respecSteps]);
  const stepById = useMemo(
    () => new Map<string, AscendancyOrderStep>(plan.steps.map((s) => [s.nodeId, s])),
    [plan.steps],
  );

  const isEndpointAllocated = (id: string) =>
    allocSet.has(id) || (id === plan.startNodeId && plan.allocatedPoints > 0);
  const startActive =
    plan.allocatedPoints > 0 || (plan.startNodeId ? allocSet.has(plan.startNodeId) : false);

  const isMilestone = (node: (typeof nodes)[number]) =>
    Boolean(plan.clusterKey && isAscendancyMilestoneNode(node, plan.clusterKey));

  const unplannedSmalls = nodes.filter(
    (n) =>
      !isMilestone(n) &&
      !n.isAscendancyStart &&
      !stepById.has(n.id) &&
      !plannedSet.has(n.id) &&
      !allocSet.has(n.id),
  );
  const plannedSmalls = nodes.filter(
    (n) =>
      !isMilestone(n) &&
      !n.isAscendancyStart &&
      !stepById.has(n.id) &&
      (plannedSet.has(n.id) || allocSet.has(n.id)),
  );
  const unplannedNotables = nodes.filter(
    (n) => isMilestone(n) && !n.isAscendancyStart && !stepById.has(n.id),
  );
  const startNodes = nodes.filter((n) => n.isAscendancyStart);
  const plannedStepNodes = nodes.filter((n) => stepById.has(n.id));

  return (
    <div
      className="rounded-lg p-2 flex items-center justify-center min-h-[150px] border border-hud-hairline/70"
      style={{ backgroundColor: treePalette.canvasBg }}
    >
      <svg
        viewBox={viewBox}
        role="group"
        aria-label={t.svgAriaLabel(plan.displayName ?? plan.clusterKey ?? "")}
        className="w-full h-44 @md:h-full max-h-56 select-none"
      >
        {edges.map((edge) => {
          const allocated = isEndpointAllocated(edge.fromId) && isEndpointAllocated(edge.toId);
          const planned = plannedSet.has(edge.fromId) && plannedSet.has(edge.toId);
          return (
            <path
              key={edge.key}
              d={edge.svgPath}
              fill="none"
              stroke={
                allocated
                  ? treePalette.allocated
                  : planned
                    ? treePalette.newBracket
                    : treePalette.wireframeEdge
              }
              strokeWidth={allocated ? 26 : planned ? 22 : 14}
              strokeLinecap="round"
              opacity={allocated ? 0.95 : planned ? 0.9 : 0.55}
            />
          );
        })}

        {unplannedSmalls.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={18}
            fill={treePalette.nodeFill}
            stroke={treePalette.wireframeEdge}
            strokeWidth={6}
            opacity={0.85}
          >
            <title>{n.name}</title>
          </circle>
        ))}

        {plannedSmalls.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={22}
            fill={allocSet.has(n.id) ? treePalette.allocated : treePalette.newBracket}
            stroke={treePalette.nodeRim}
            strokeWidth={6}
          >
            <title>{n.name}</title>
          </circle>
        ))}

        {unplannedNotables.map((n) => {
          const isRespec = respecSet.has(n.id);
          return (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={isRespec ? 34 : 32}
              fill={treePalette.nodeFill}
              stroke={isRespec ? treePalette.respec : treePalette.nodeStroke}
              strokeWidth={isRespec ? 10 : 8}
            >
              <title>{isRespec ? `${n.name} (${t.respecNodesPrefix})` : n.name}</title>
            </circle>
          );
        })}

        {startNodes.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={40}
            fill={startActive ? treePalette.allocated : treePalette.nodeFill}
            stroke={treePalette.notableRim}
            strokeWidth={10}
          >
            <title>{plan.displayName ?? n.name}</title>
          </circle>
        ))}

        {plannedStepNodes.map((n) => {
          const step = stepById.get(n.id)!;
          const isFocused = focusedNodeId === n.id;
          const numeralFill = step.isNext
            ? "#09090b"
            : step.allocated
              ? theme.mode === "light"
                ? "#ffffff"
                : "#09090b"
              : treePalette.newBracket;

          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${step.order}. ${step.name}`}
              onClick={() => onSelectNode(n.id)}
              onMouseEnter={() => onHoverNode(n.id)}
              onMouseLeave={() => onHoverNode(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectNode(n.id);
                }
              }}
              className="cursor-pointer focus:outline-none"
            >
              <title>{`${step.order}. ${step.name}`}</title>
              {step.isNext && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={54}
                  fill="none"
                  stroke={treePalette.newBracket}
                  strokeWidth={8}
                  opacity={0.45}
                />
              )}
              {isFocused && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={52}
                  fill="none"
                  stroke={treePalette.selectedRing}
                  strokeWidth={6}
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={40}
                fill={
                  step.allocated
                    ? treePalette.allocated
                    : step.isNext
                      ? treePalette.newBracket
                      : treePalette.nodeFill
                }
                stroke={step.allocated || step.isNext ? treePalette.nodeRim : treePalette.newBracket}
                strokeWidth={step.allocated || step.isNext ? 6 : 10}
              />
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={42}
                fontWeight={800}
                fill={numeralFill}
                style={{ pointerEvents: "none", fontFamily: "var(--font-sans)" }}
              >
                {step.order}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});
