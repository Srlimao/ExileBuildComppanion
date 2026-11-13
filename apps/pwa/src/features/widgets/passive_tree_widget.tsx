import type { HudSessionSnapshot } from "@exile-hud/core";
import { GitBranch } from "lucide-react";

export function PassiveTreeWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const tree = snapshot.passiveTree;
  const pts = tree.targetNodesPreview;

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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="rounded-lg bg-black border border-neutral-800 p-2 flex items-center justify-center min-h-[120px]">
          <svg
            viewBox={`${minX} ${minY} ${Math.max(100, maxX - minX)} ${Math.max(100, maxY - minY)}`}
            className="w-full h-36"
          >
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
