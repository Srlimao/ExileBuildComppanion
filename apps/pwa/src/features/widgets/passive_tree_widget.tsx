import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { GitBranch, Maximize2 } from "lucide-react";

interface PassiveTreeWidgetProps {
  snapshot: HudSessionSnapshot;
  onOpenFullTree?: () => void;
}

export function PassiveTreeWidget({ snapshot, onOpenFullTree }: PassiveTreeWidgetProps) {
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
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">{tree.specName}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {tree.allocatedTargetCount}/{tree.targetNodeCount}
          </span>
          {tree.respecPointsNeeded > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Respec: {tree.respecPointsNeeded}
            </span>
          )}
          {onOpenFullTree && (
            <button
              type="button"
              onClick={onOpenFullTree}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-sans font-semibold cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Open Full Tree →</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="rounded-lg bg-black border border-neutral-800 p-2 flex items-center justify-center min-h-[120px]">
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
                stroke={edge.allocated ? "#10b981" : "#eab308"}
                strokeWidth={edge.allocated ? 36 : 26}
                strokeLinecap="round"
                opacity={edge.allocated ? 0.75 : 0.45}
              />
            ))}
            {pts.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.allocated ? 140 : 175}
                fill={node.allocated ? "#22C55E" : "#EAB308"}
                opacity={node.allocated ? 0.85 : 0.95}
              >
                <title>{node.label}</title>
              </circle>
            ))}
          </svg>
        </div>

        <div className="space-y-1.5 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Next Target Notables</div>
          {tree.remainingNotableNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tree.remainingNotableNames.map((name) => (
                <span
                  key={name}
                  className="px-2 py-1 rounded-lg bg-black border border-neutral-800 text-xs text-neutral-200"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-400">All target notables allocated!</p>
          )}
        </div>
      </div>
    </div>
  );
}
