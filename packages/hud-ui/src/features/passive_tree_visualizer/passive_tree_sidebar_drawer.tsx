import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import { resolveMasteryEffectStats } from "@exile-hud/core";
import { poe1GameAdapter, type PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { RefreshCw } from "lucide-react";

interface PassiveTreeSidebarDrawerProps {
  diff: PassiveTreeBracketDiff;
  nodes: Record<string, PassiveTreeNodeMetadata>;
  allocatedIds: ReadonlySet<string>;
  onFocusNode: (nodeId: string) => void;
  onTriggerManualSync: () => void;
}

export function PassiveTreeSidebarDrawer({
  diff,
  nodes,
  allocatedIds,
  onFocusNode,
  onTriggerManualSync,
}: PassiveTreeSidebarDrawerProps) {
  const masteryEntries = Object.entries(diff.selectedSpec?.masteries ?? {});
  const respecIds = [...new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds])];

  return (
    <aside className="w-full lg:w-80 xl:w-96 flex flex-col gap-6">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Next Priority Targets
          </h3>
          <button
            type="button"
            onClick={onTriggerManualSync}
            className="inline-flex items-center gap-1 text-xs text-hud-muted hover:text-hud-text cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
          </button>
        </div>

        {diff.nextNotableTargets.length === 0 ? (
          <p className="text-xs text-hud-ok py-1">
            All keystones, notables &amp; masteries in this bracket are allocated.
          </p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {diff.nextNotableTargets.map((item) => (
              <button
                key={item.nodeId}
                type="button"
                onClick={() => onFocusNode(item.nodeId)}
                className="w-full text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-hud-subtle transition-colors cursor-pointer"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs font-semibold text-hud-text flex items-baseline gap-2 min-w-0">
                    <span className="truncate">{item.name}</span>
                    <span
                      className={`text-[10px] font-mono shrink-0 ${
                        item.isNewInBracket ? "text-hud-warn" : "text-hud-cold"
                      }`}
                    >
                      {item.isNewInBracket ? "NEW" : "EARLIER"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-hud-muted shrink-0">
                    {item.pathToAllocateIds.length} pt
                  </span>
                </div>
                <div className="text-[11px] text-hud-muted line-clamp-2 mt-0.5">
                  {(item.chosenMasteryStats ?? item.stats)[0] ?? item.kind}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {masteryEntries.length > 0 && (
        <section className="pt-4 border-t border-hud-hairline space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Bracket Masteries ({masteryEntries.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {masteryEntries.map(([nodeId, effectId]) => {
              const meta = nodes[nodeId];
              const stats = resolveMasteryEffectStats(nodeId, effectId, poe1GameAdapter);
              const done = allocatedIds.has(nodeId);
              return (
                <button
                  key={nodeId}
                  type="button"
                  onClick={() => onFocusNode(nodeId)}
                  className="w-full text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-hud-subtle text-xs cursor-pointer transition-colors"
                >
                  <div className="font-semibold flex items-baseline justify-between gap-2">
                    <span className={done ? "text-hud-ok" : "text-hud-text"}>
                      {meta?.name ?? `Mastery ${nodeId}`}
                    </span>
                    {done && <span className="text-[10px] font-mono text-hud-ok">ALLOCATED</span>}
                  </div>
                  <div className="text-[11px] text-hud-muted mt-0.5">
                    {stats?.join(" · ") ?? `Effect #${effectId}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {respecIds.length > 0 && (
        <section className="pt-4 border-t border-hud-hairline space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-danger">
            Respec Nodes ({respecIds.length})
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
            {respecIds.slice(0, 18).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onFocusNode(id)}
                className="text-hud-danger hover:underline cursor-pointer"
              >
                {nodes[id]?.name ?? id}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
