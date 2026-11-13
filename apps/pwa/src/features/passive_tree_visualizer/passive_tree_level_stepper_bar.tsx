import type { PassiveTreeBracketDiff, PassiveTreeSpecSummary } from "@exile-hud/core";
import { Crosshair, Eye, LocateFixed, Search, Sparkles, X } from "lucide-react";

interface PassiveTreeLevelStepperBarProps {
  characterLevel: number;
  specs: PassiveTreeSpecSummary[];
  selectedIndex: number;
  manualSpecId: string | null;
  allocatedIds: ReadonlySet<string>;
  diff: PassiveTreeBracketDiff;
  searchQuery: string;
  searchMatchCount: number;
  showFuture: boolean;
  hasAscendancyNodes: boolean;
  onSelectManualSpec: (specId: string | null) => void;
  onSearchChange: (q: string) => void;
  onToggleShowFuture: () => void;
  onFitBracket: () => void;
  onFocusNextTarget: () => void;
  onFocusAscendancy: () => void;
}

export function PassiveTreeLevelStepperBar({
  characterLevel,
  specs,
  selectedIndex,
  manualSpecId,
  allocatedIds,
  diff,
  searchQuery,
  searchMatchCount,
  showFuture,
  hasAscendancyNodes,
  onSelectManualSpec,
  onSearchChange,
  onToggleShowFuture,
  onFitBracket,
  onFocusNextTarget,
  onFocusAscendancy,
}: PassiveTreeLevelStepperBarProps) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectManualSpec(null)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
              manualSpecId === null
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                : "border-neutral-800 bg-black text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Auto (Lv {characterLevel})
          </button>

          {specs.map((spec, idx) => {
            const active = idx === selectedIndex;
            const allocCount = spec.nodeIds.filter((id) => allocatedIds.has(id)).length;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => onSelectManualSpec(spec.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${
                  active
                    ? "border-indigo-500/80 bg-indigo-600/25 text-white font-semibold"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                }`}
              >
                <span>{spec.title}</span>
                <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                  Lv{spec.minLevel} · {allocCount}/{spec.nodeIds.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono tabular-nums">
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            Alloc {diff.allocatedInTargetIds.length}/{diff.selectedSpec?.nodeIds.length ?? 0}
          </span>
          {diff.unallocatedAddedIds.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
              +{diff.unallocatedAddedIds.length} Bracket
            </span>
          )}
          {diff.earlierMissedIds.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              {diff.earlierMissedIds.length} Earlier
            </span>
          )}
          {(diff.respecFromPrevIds.length > 0 || diff.offSpecAllocatedIds.length > 0) && (
            <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
              Respec {Math.max(diff.respecFromPrevIds.length, diff.offSpecAllocatedIds.length)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-neutral-800/80">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes or stats (e.g. Fire, Life, Mastery)..."
            className="w-full rounded-lg bg-black border border-neutral-800 pl-8 pr-16 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[10px] font-mono text-indigo-300">{searchMatchCount}</span>
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={onFitBracket}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-200 cursor-pointer"
          >
            <LocateFixed className="h-3.5 w-3.5 text-indigo-400" />
            Fit Bracket
          </button>
          <button
            type="button"
            onClick={onFocusNextTarget}
            disabled={diff.nextNotableTargets.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 disabled:opacity-40 text-neutral-200 cursor-pointer"
          >
            <Crosshair className="h-3.5 w-3.5 text-amber-400" />
            Next Point
          </button>
          {hasAscendancyNodes && (
            <button
              type="button"
              onClick={onFocusAscendancy}
              className="px-2.5 py-1 rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-200 cursor-pointer"
            >
              Ascendancy
            </button>
          )}
          <button
            type="button"
            onClick={onToggleShowFuture}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer ${
              showFuture
                ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                : "border-neutral-800 bg-black text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Future Path
          </button>
        </div>
      </div>
    </div>
  );
}
