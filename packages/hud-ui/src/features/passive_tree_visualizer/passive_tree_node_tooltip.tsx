import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import { computeShortestPathToNode, resolveMasteryEffectStats } from "@exile-hud/core";
import { getGameAdapter, type SupportedGameId } from "@exile-hud/game-data";
import { Minus, Plus, X } from "lucide-react";
import { memo, useMemo } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { useHudTheme } from "../theme/hud_theme_provider.js";
import type { BuiltTreeGeometry } from "./passive_tree_geometry_builder.js";
import type { WeaponSetOverlayFilter } from "./passive_tree_spatial_index.js";
import { PassiveTreeWeaponSetLegend } from "./passive_tree_weapon_set_legend.js";

interface PassiveTreeCanvasOverlaysProps {
  gameId?: SupportedGameId;
  geometry: BuiltTreeGeometry;
  diff: PassiveTreeBracketDiff;
  allocatedIds: ReadonlySet<string>;
  characterClass: string;
  selectedNodeId: string | null;
  weaponSetFilter: WeaponSetOverlayFilter;
  onChangeWeaponSetFilter: (next: WeaponSetOverlayFilter) => void;
  onSelectNode: (id: string | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/** Legend, zoom controls, and read-only node inspector tooltip overlaid on the passive tree canvas. */
export const PassiveTreeCanvasOverlays = memo(function PassiveTreeCanvasOverlays({
  gameId,
  geometry,
  diff,
  allocatedIds,
  characterClass,
  selectedNodeId,
  weaponSetFilter,
  onChangeWeaponSetFilter,
  onSelectNode,
  onZoomIn,
  onZoomOut,
}: PassiveTreeCanvasOverlaysProps) {
  const { msg, appMsg } = useHudI18n();
  const { treePalette } = useHudTheme();
  const adapter = getGameAdapter(gameId);
  const specMasteries = diff.selectedSpec?.masteries ?? {};
  const ws1List = diff.selectedSpec?.weaponSet1NodeIds ?? [];
  const ws2List = diff.selectedSpec?.weaponSet2NodeIds ?? [];
  const inspectedNode = selectedNodeId ? geometry.nodes[selectedNodeId] ?? null : null;
  const inspectedWsNum = inspectedNode
    ? ws1List.includes(inspectedNode.id)
      ? 1
      : ws2List.includes(inspectedNode.id)
        ? 2
        : null
    : null;
  const inspectedAllocated = inspectedNode ? allocatedIds.has(inspectedNode.id) : false;
  const inspectedMasteryStats = inspectedNode?.isMastery
    ? resolveMasteryEffectStats(inspectedNode.id, specMasteries[inspectedNode.id], adapter)
    : null;
  const inspectedNote = inspectedNode ? diff.selectedSpec?.nodeNotes?.[inspectedNode.id] ?? null : null;
  const inspectedPath = useMemo(
    () =>
      inspectedNode && !inspectedAllocated && diff.targetSet.has(inspectedNode.id)
        ? computeShortestPathToNode({
            targetNodeId: inspectedNode.id,
            targetSet: diff.targetSet,
            allocatedIds,
            characterClass,
            adapter,
          })
        : [],
    [inspectedNode, inspectedAllocated, diff.targetSet, allocatedIds, characterClass, adapter],
  );

  return (
    <>
      <div
        data-tree-overlay-ui="true"
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 flex flex-wrap gap-2.5 rounded-lg bg-hud-surface/95 border border-hud-hairline px-3 py-1.5 text-[11px] text-hud-muted"
      >
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: treePalette.allocated }} />
          {msg.tree.legendAllocated}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: treePalette.newBracket }} />
          {msg.tree.legendNewBracket}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: treePalette.earlier }} />
          {msg.tree.legendEarlier}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: treePalette.respec }} />
          {msg.tree.legendRespec}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: treePalette.masteryActive }} />
          {msg.tree.legendMastery}
        </span>
        <PassiveTreeWeaponSetLegend
          weaponSet1Count={ws1List.length}
          weaponSet2Count={ws2List.length}
          filter={weaponSetFilter}
          onChangeFilter={onChangeWeaponSetFilter}
        />
      </div>

      <div
        data-tree-overlay-ui="true"
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 flex flex-col gap-1"
      >
        <button
          type="button"
          onClick={onZoomIn}
          aria-label={msg.tree.zoomIn}
          title={msg.tree.zoomIn}
          className="p-2.5 rounded-lg bg-hud-surface/95 border border-hud-hairline hover:bg-hud-subtle text-hud-text cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label={msg.tree.zoomOut}
          title={msg.tree.zoomOut}
          className="p-2.5 rounded-lg bg-hud-surface/95 border border-hud-hairline hover:bg-hud-subtle text-hud-text cursor-pointer"
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
              {inspectedWsNum && (
                <span
                  className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor:
                      inspectedWsNum === 1 ? "rgba(239, 68, 68, 0.16)" : "rgba(34, 197, 94, 0.16)",
                    color: inspectedWsNum === 1 ? treePalette.weaponSet1 : treePalette.weaponSet2,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        inspectedWsNum === 1 ? treePalette.weaponSet1 : treePalette.weaponSet2,
                    }}
                  />
                  {appMsg.poe2.weaponSetBadge(inspectedWsNum)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              aria-label={msg.tree.closeInspector}
              title={msg.tree.closeInspector}
              className="p-1.5 -m-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
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

          {inspectedNote && (
            <div className="border-l-2 border-hud-quest pl-2.5 py-0.5 text-xs text-hud-text space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-hud-quest">
                {appMsg.poe2Build.buildNoteHeading}
              </div>
              <div className="whitespace-pre-line leading-snug text-hud-text/95">{inspectedNote}</div>
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
