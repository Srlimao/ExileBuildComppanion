import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import { computeShortestPathToNode, resolveMasteryEffectStats } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { Minus, Plus, X } from "lucide-react";
import { memo, useMemo } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
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

/** Legend, zoom controls, and read-only node inspector tooltip overlaid on the passive tree canvas. */
export const PassiveTreeCanvasOverlays = memo(function PassiveTreeCanvasOverlays({
  geometry,
  diff,
  allocatedIds,
  characterClass,
  selectedNodeId,
  onSelectNode,
  onZoomIn,
  onZoomOut,
}: PassiveTreeCanvasOverlaysProps) {
  const { msg } = useHudI18n();
  const specMasteries = diff.selectedSpec?.masteries ?? {};
  const inspectedNode = selectedNodeId ? geometry.nodes[selectedNodeId] ?? null : null;
  const inspectedAllocated = inspectedNode ? allocatedIds.has(inspectedNode.id) : false;
  const inspectedMasteryStats = inspectedNode?.isMastery
    ? resolveMasteryEffectStats(inspectedNode.id, specMasteries[inspectedNode.id], poe1GameAdapter)
    : null;
  const inspectedPath = useMemo(
    () =>
      inspectedNode && !inspectedAllocated && diff.targetSet.has(inspectedNode.id)
        ? computeShortestPathToNode({
            targetNodeId: inspectedNode.id,
            targetSet: diff.targetSet,
            allocatedIds,
            characterClass,
            adapter: poe1GameAdapter,
          })
        : [],
    [inspectedNode, inspectedAllocated, diff.targetSet, allocatedIds, characterClass],
  );

  return (
    <>
      <div
        data-tree-overlay-ui="true"
        className="absolute bottom-3 left-3 flex flex-wrap gap-2.5 rounded-lg bg-hud-surface/95 border border-hud-hairline px-3 py-1.5 text-[11px] text-hud-muted"
      >
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{msg.tree.legendAllocated}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{msg.tree.legendNewBracket}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500" />{msg.tree.legendEarlier}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />{msg.tree.legendRespec}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />{msg.tree.legendMastery}</span>
      </div>

      <div data-tree-overlay-ui="true" className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={onZoomIn}
          className="p-2 rounded-lg bg-hud-surface/95 border border-hud-hairline hover:bg-hud-subtle text-hud-text cursor-pointer"
          title={msg.tree.zoomIn}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-2 rounded-lg bg-hud-surface/95 border border-hud-hairline hover:bg-hud-subtle text-hud-text cursor-pointer"
          title={msg.tree.zoomOut}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {inspectedNode && (
        <div
          data-tree-overlay-ui="true"
          className="absolute top-3 left-3 max-w-xs sm:max-w-sm rounded-xl bg-hud-surface/95 border border-hud-hairline p-3.5 shadow-2xl space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-hud-text leading-tight">{inspectedNode.name}</div>
              <div className="text-[11px] font-mono text-hud-muted">
                {inspectedNode.ascendancyName ? `${inspectedNode.ascendancyName} · ` : ""}
                {inspectedNode.isKeystone
                  ? msg.tree.nodeKinds.keystone
                  : inspectedNode.isMastery
                    ? msg.tree.nodeKinds.mastery
                    : inspectedNode.isNotable
                      ? msg.tree.nodeKinds.notable
                      : inspectedNode.isJewelSocket
                        ? msg.tree.nodeKinds.jewel
                        : msg.tree.nodeKinds.passive}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="text-hud-muted hover:text-hud-text cursor-pointer"
              title={msg.tree.closeInspector}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {inspectedMasteryStats && (
            <div className="border-l-2 border-hud-accent pl-2.5 py-0.5 text-xs text-hud-text space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-hud-accent">
                {msg.tree.pobChosenMastery}
              </div>
              {inspectedMasteryStats.map((st, idx) => (
                <div key={idx}>{st}</div>
              ))}
            </div>
          )}

          {inspectedNode.stats.length > 0 && (
            <ul className="space-y-0.5 text-xs text-hud-text/90">
              {inspectedNode.stats.map((st, idx) => (
                <li key={idx}>· {st}</li>
              ))}
            </ul>
          )}

          {(inspectedAllocated ||
            diff.targetSet.has(inspectedNode.id) ||
            diff.respecFromPrevIds.includes(inspectedNode.id) ||
            diff.offSpecAllocatedIds.includes(inspectedNode.id)) && (
            <div className="pt-1.5 border-t border-hud-hairline text-xs font-semibold">
              {inspectedAllocated ? (
                <span className="text-hud-ok">{msg.tree.allocated}</span>
              ) : diff.targetSet.has(inspectedNode.id) ? (
                <span className={diff.addedInBracketIds.includes(inspectedNode.id) ? "text-hud-warn" : "text-hud-cold"}>
                  {msg.tree.unallocatedAway(inspectedPath.length)}
                </span>
              ) : (
                <span className="text-hud-danger">{msg.tree.respecTarget}</span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
});
