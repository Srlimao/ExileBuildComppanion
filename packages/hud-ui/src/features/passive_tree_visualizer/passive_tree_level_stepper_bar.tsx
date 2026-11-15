import type { PassiveTreeBracketDiff, PassiveTreeSpecSummary } from "@exile-hud/core";
import { Crosshair, Eye, LocateFixed, Search, Sparkles, X } from "lucide-react";
import { memo, useMemo } from "react";

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

export const PassiveTreeLevelStepperBar = memo(function PassiveTreeLevelStepperBar({
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
  const allocCounts = useMemo(
    () => specs.map((spec) => spec.nodeIds.filter((id) => allocatedIds.has(id)).length),
    [specs, allocatedIds],
  );

  return (
    <div className="space-y-2.5 pb-2 border-b border-hud-hairline">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectManualSpec(null)}
            className={`inline-flex items-center gap-1 pb-1 border-b-2 text-xs font-semibold cursor-pointer transition-colors ${
              manualSpecId === null
                ? "border-hud-accent text-hud-text"
                : "border-transparent text-hud-muted hover:text-hud-text"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Auto (Lv {characterLevel})
          </button>

          {specs.map((spec, idx) => {
            const active = idx === selectedIndex;
            const allocCount = allocCounts[idx] ?? 0;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => onSelectManualSpec(spec.id)}
                className={`inline-flex items-baseline gap-1.5 pb-1 border-b-2 text-xs cursor-pointer transition-colors ${
                  active
                    ? "border-hud-accent text-hud-text font-semibold"
                    : "border-transparent text-hud-muted hover:text-hud-text"
                }`}
              >
                <span>{spec.title}</span>
                <span className="text-[11px] font-mono tabular-nums text-hud-muted">
                  Lv{spec.minLevel} · {allocCount}/{spec.nodeIds.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs font-mono tabular-nums">
          <span className="text-hud-ok">
            Alloc {diff.allocatedInTargetIds.length}/{diff.selectedSpec?.nodeIds.length ?? 0}
          </span>
          {diff.unallocatedAddedIds.length > 0 && (
            <span className="text-hud-warn">+{diff.unallocatedAddedIds.length} Bracket</span>
          )}
          {diff.earlierMissedIds.length > 0 && (
            <span className="text-hud-cold">{diff.earlierMissedIds.length} Earlier</span>
          )}
          {(diff.respecFromPrevIds.length > 0 || diff.offSpecAllocatedIds.length > 0) && (
            <span className="text-hud-danger">
              Respec {Math.max(diff.respecFromPrevIds.length, diff.offSpecAllocatedIds.length)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 text-hud-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes or stats (e.g. Fire, Life, Mastery)..."
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline pl-8 pr-16 py-1.5 text-xs text-hud-text placeholder:text-hud-muted focus:outline-none focus:border-hud-accent"
          />
          {searchQuery && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[11px] font-mono text-hud-accent">{searchMatchCount}</span>
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-hud-muted hover:text-hud-text cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs">
          <button
            type="button"
            onClick={onFitBracket}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <LocateFixed className="h-3.5 w-3.5 text-hud-accent" />
            Fit Bracket
          </button>
          <button
            type="button"
            onClick={onFocusNextTarget}
            disabled={diff.nextNotableTargets.length === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle disabled:opacity-40 cursor-pointer"
          >
            <Crosshair className="h-3.5 w-3.5 text-hud-quest" />
            Next Point
          </button>
          {hasAscendancyNodes && (
            <button
              type="button"
              onClick={onFocusAscendancy}
              className="px-2 py-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              Ascendancy
            </button>
          )}
          <button
            type="button"
            onClick={onToggleShowFuture}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
              showFuture
                ? "text-hud-accent font-semibold bg-hud-subtle"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Future Path
          </button>
        </div>
      </div>
    </div>
  );
});
