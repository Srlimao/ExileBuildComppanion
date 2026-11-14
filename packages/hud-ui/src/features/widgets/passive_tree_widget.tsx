import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { Maximize2 } from "lucide-react";
import { useHudTheme } from "../theme/hud_theme_provider.js";

interface PassiveTreeWidgetProps {
  snapshot: HudSessionSnapshot;
  onOpenFullTree?: () => void;
}

export function PassiveTreeWidget({ snapshot, onOpenFullTree }: PassiveTreeWidgetProps) {
  const { treePalette } = useHudTheme();
  const tree = snapshot.passiveTree;
  const pts = tree.targetNodesPreview;
  const graphNodes = poe1GameAdapter.getPassiveTreeNodes();
  const ptById = new Map(pts.map((pt) => [pt.id, pt]));

  const edges: { key: string; x1: number; y1: number; x2: number; y2: number; allocated: boolean }[] = [];
  for (const pt of pts) {
    const meta = graphNodes[pt.id];
    if (!meta?.out) continue;
    for (const nbrId of meta.out) {
      if (pt.id >= nbrId) continue;
      const nbr = ptById.get(nbrId);
      if (!nbr) continue;
      edges.push({
        key: `${pt.id}_${nbrId}`,
        x1: pt.x,
        y1: pt.y,
        x2: nbr.x,
        y2: nbr.y,
        allocated: pt.allocated && nbr.allocated,
      });
    }
  }

  let minX = -100;
  let maxX = 100;
  let minY = -100;
  let maxY = 100;
  if (pts.length > 0) {
    minX = Math.min(...pts.map((p) => p.x)) - 400;
    maxX = Math.max(...pts.map((p) => p.x)) + 400;
    minY = Math.min(...pts.map((p) => p.y)) - 400;
    maxY = Math.max(...pts.map((p) => p.y)) + 400;
  }

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">{tree.specName}</h2>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-hud-ok">
            {tree.allocatedTargetCount}/{tree.targetNodeCount}
          </span>
          {tree.respecPointsNeeded > 0 && (
            <span className="text-hud-warn">Respec {tree.respecPointsNeeded}</span>
          )}
          {onOpenFullTree && (
            <button
              type="button"
              onClick={onOpenFullTree}
              className="inline-flex items-center gap-1 text-hud-accent hover:opacity-80 font-sans font-semibold cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Full Tree</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0">
        <div
          className="rounded-md p-2 flex items-center justify-center min-h-[120px]"
          style={{ backgroundColor: treePalette.canvasBg }}
        >
          <svg
            viewBox={`${minX} ${minY} ${Math.max(100, maxX - minX)} ${Math.max(100, maxY - minY)}`}
            className="w-full h-36"
          >
            {edges.map((edge) => (
              <line
                key={edge.key}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={edge.allocated ? treePalette.allocated : treePalette.newBracket}
                strokeWidth={edge.allocated ? 36 : 26}
                strokeLinecap="round"
                opacity={edge.allocated ? 0.8 : 0.55}
              />
            ))}
            {pts.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.allocated ? 140 : 175}
                fill={node.allocated ? treePalette.allocated : treePalette.newBracket}
                opacity={node.allocated ? 0.88 : 0.96}
              >
                <title>{node.label}</title>
              </circle>
            ))}
          </svg>
        </div>

        <div className="space-y-1.5 overflow-y-auto">
          <div className="text-[11px] uppercase tracking-[0.12em] text-hud-muted font-semibold">
            Next Notables
          </div>
          {tree.remainingNotableNames.length > 0 ? (
            <ul className="space-y-1">
              {tree.remainingNotableNames.map((name) => (
                <li key={name} className="text-xs text-hud-text/90 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-hud-quest shrink-0" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-hud-ok">All target notables allocated.</p>
          )}
        </div>
      </div>
    </div>
  );
}
