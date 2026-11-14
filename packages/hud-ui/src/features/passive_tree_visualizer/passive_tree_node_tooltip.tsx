import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import { computeShortestPathToNode, resolveMasteryEffectStats } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { Minus, Plus, X } from "lucide-react";
import type { BuiltPoe1TreeGeometry } from "./passive_tree_geometry_builder.js";

interface PassiveTreeCanvasOverlaysProps {
  geometry: BuiltPoe1TreeGeometry;
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  characterClass: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/** Legend, zoom controls, and read-only node inspector tooltip overlaid on the passive tree SVG. */
export function PassiveTreeCanvasOverlays({
  geometry,
  diff,
  allocatedIds,
  characterClass,
  selectedNodeId,
  onSelectNode,
  onZoomIn,
  onZoomOut,
}: PassiveTreeCanvasOverlaysProps) {
  const specMasteries = diff.selectedSpec?.masteries ?? {};
  const inspectedNode = selectedNodeId ? geometry.nodes[selectedNodeId] ?? null : null;
  const inspectedAllocated = inspectedNode ? allocatedIds.has(inspectedNode.id) : false;
  const inspectedMasteryStats = inspectedNode?.isMastery
    ? resolveMasteryEffectStats(inspectedNode.id, specMasteries[inspectedNode.id], poe1GameAdapter)
    : null;
  const inspectedPath =
    inspectedNode && !inspectedAllocated && diff.targetSet.has(inspectedNode.id)
      ? computeShortestPathToNode({
          targetNodeId: inspectedNode.id,
          targetSet: diff.targetSet,
          allocatedIds,
          characterClass,
          adapter: poe1GameAdapter,
        })
      : [];

  return (
    <>
      <div
        data-tree-overlay-ui="true"
        className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-lg bg-black/85 border border-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-300 backdrop-blur"
      >
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Allocated</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />New Bracket</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />Earlier</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Respec</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />Mastery</span>
      </div>

      <div
        data-tree-overlay-ui="true"
        className="absolute bottom-3 right-3 flex flex-col gap-1"
      >
        <button
          type="button"
          onClick={onZoomIn}
          className="p-2 rounded-lg bg-neutral-950/90 border border-neutral-800 hover:border-neutral-600 text-neutral-200 cursor-pointer"
          title="Zoom In"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-2 rounded-lg bg-neutral-950/90 border border-neutral-800 hover:border-neutral-600 text-neutral-200 cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {inspectedNode && (
        <div
          data-tree-overlay-ui="true"
          className="absolute top-3 left-3 max-w-xs sm:max-w-sm rounded-xl bg-neutral-950/95 border border-neutral-700 p-3 shadow-2xl space-y-2 backdrop-blur"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white leading-tight">{inspectedNode.name}</div>
              <div className="text-[11px] font-mono text-neutral-400">
                {inspectedNode.ascendancyName ? `${inspectedNode.ascendancyName} · ` : ""}
                {inspectedNode.isKeystone ? "Keystone" : inspectedNode.isMastery ? "Mastery" : inspectedNode.isNotable ? "Notable" : inspectedNode.isJewelSocket ? "Jewel Socket" : "Passive"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="text-neutral-400 hover:text-white cursor-pointer"
              title="Close Inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {inspectedMasteryStats && (
            <div className="rounded-lg bg-indigo-500/15 border border-indigo-500/40 p-2 text-xs text-indigo-100 space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">PoB Chosen Mastery</div>
              {inspectedMasteryStats.map((st, idx) => (
                <div key={idx}>{st}</div>
              ))}
            </div>
          )}

          {inspectedNode.stats.length > 0 && (
            <ul className="space-y-0.5 text-xs text-neutral-200">
              {inspectedNode.stats.map((st, idx) => (
                <li key={idx}>• {st}</li>
              ))}
            </ul>
          )}

          {(inspectedAllocated ||
            diff.targetSet.has(inspectedNode.id) ||
            diff.respecFromPrevIds.includes(inspectedNode.id) ||
            diff.offSpecAllocatedIds.includes(inspectedNode.id)) && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-800">
              {inspectedAllocated ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
                  Allocated
                </span>
              ) : diff.targetSet.has(inspectedNode.id) ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-semibold ${
                    diff.addedInBracketIds.includes(inspectedNode.id)
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                      : "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                  }`}
                >
                  Unallocated · {inspectedPath.length} pt{inspectedPath.length === 1 ? "" : "s"} away
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold">
                  Respec Target
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
