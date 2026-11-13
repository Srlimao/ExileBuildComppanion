import type { PassiveTreeBracketDiff } from "@exile-hud/core";
import { resolveMasteryEffectStats } from "@exile-hud/core";
import { poe1GameAdapter, type PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { Check, Crosshair, GitCommitHorizontal, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";

interface PassiveTreeSidebarDrawerProps {
  diff: PassiveTreeBracketDiff;
  nodes: Record<string, PassiveTreeNodeMetadata>;
  allocatedIds: ReadonlySet<string>;
  onFocusNode: (nodeId: string) => void;
  onToggleAllocatedNodes: (nodeIds: string[], allocated: boolean) => void;
  onTriggerManualSync: () => void;
}

export function PassiveTreeSidebarDrawer({
  diff,
  nodes,
  allocatedIds,
  onFocusNode,
  onToggleAllocatedNodes,
  onTriggerManualSync,
}: PassiveTreeSidebarDrawerProps) {
  const masteryEntries = Object.entries(diff.selectedSpec?.masteries ?? {});
  const respecIds = [...new Set([...diff.respecFromPrevIds, ...diff.offSpecAllocatedIds])];

  return (
    <aside className="w-full lg:w-80 xl:w-96 flex flex-col gap-3">
      <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <GitCommitHorizontal className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Next Priority Targets</h3>
          </div>
          <button
            type="button"
            onClick={onTriggerManualSync}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 text-[11px] text-neutral-300 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
          </button>
        </div>

        {diff.nextNotableTargets.length === 0 ? (
          <p className="text-xs text-emerald-400 py-2">All keystones, notables & masteries in this bracket are allocated.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {diff.nextNotableTargets.map((item) => (
              <div
                key={item.nodeId}
                className="rounded-lg bg-black border border-neutral-800/90 p-2 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusNode(item.nodeId)}
                    className="text-left group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-indigo-300 flex items-center gap-1.5">
                      <span>{item.name}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                          item.isNewInBracket
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {item.isNewInBracket ? "NEW" : "EARLIER"}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 line-clamp-2">
                      {(item.chosenMasteryStats ?? item.stats)[0] ?? item.kind}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onFocusNode(item.nodeId)}
                      title="Center camera on node"
                      className="p-1 rounded bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-300 cursor-pointer"
                    >
                      <Crosshair className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleAllocatedNodes(item.pathToAllocateIds, true)}
                      title={`Mark path (${item.pathToAllocateIds.length} pt)`}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/35 hover:bg-emerald-500/25 text-[10px] font-mono text-emerald-300 cursor-pointer"
                    >
                      <Check className="h-3 w-3" />+{item.pathToAllocateIds.length}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {masteryEntries.length > 0 && (
        <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Bracket Masteries ({masteryEntries.length})</h3>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {masteryEntries.map(([nodeId, effectId]) => {
              const meta = nodes[nodeId];
              const stats = resolveMasteryEffectStats(nodeId, effectId, poe1GameAdapter);
              const done = allocatedIds.has(nodeId);
              return (
                <button
                  key={nodeId}
                  type="button"
                  onClick={() => onFocusNode(nodeId)}
                  className={`w-full text-left rounded-lg border p-2 text-xs cursor-pointer transition-colors ${
                    done
                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-200"
                      : "bg-black border-neutral-800 hover:border-indigo-500/60 text-neutral-200"
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>{meta?.name ?? `Mastery ${nodeId}`}</span>
                    {done && <span className="text-[10px] font-mono text-emerald-400">ALLOCATED</span>}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {stats?.join(" · ") ?? `Effect #${effectId}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {respecIds.length > 0 && (
        <section className="bg-neutral-950 border border-rose-500/35 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-rose-300">
            <TriangleAlert className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Respec Nodes ({respecIds.length})</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {respecIds.slice(0, 18).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onFocusNode(id)}
                className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:border-rose-400 text-[11px] text-rose-200 cursor-pointer"
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
