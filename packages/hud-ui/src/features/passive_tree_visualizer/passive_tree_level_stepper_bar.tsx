import type { PassiveTreeBracketDiff, PassiveTreeSpecSummary } from "@exile-hud/core";
import { Crosshair, Eye, LocateFixed, Search, Sparkles, X } from "lucide-react";
import { memo, useMemo } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizePobFallbackText } from "../i18n/telemetry_advisor_localizer.js";

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
  const { locale, msg } = useHudI18n();
  const allocCounts = useMemo(
    () => specs.map((spec) => spec.nodeIds.filter((id) => allocatedIds.has(id)).length),
    [specs, allocatedIds],
  );

  return (
    <div className="space-y-2.5 pb-2 border-b border-hud-hairline">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            aria-pressed={manualSpecId === null}
            onClick={() => onSelectManualSpec(null)}
            className={`inline-flex items-center gap-1 py-1.5 border-b-2 text-xs font-semibold cursor-pointer transition-colors ${
              manualSpecId === null
                ? "border-hud-accent text-hud-text"
                : "border-transparent text-hud-muted hover:text-hud-text"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            {msg.tree.autoLevel(characterLevel)}
          </button>

          {specs.map((spec, idx) => {
            const active = idx === selectedIndex;
            const allocCount = allocCounts[idx] ?? 0;
            return (
              <button
                key={spec.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectManualSpec(spec.id)}
                className={`inline-flex items-baseline gap-1.5 py-1.5 border-b-2 text-xs cursor-pointer transition-colors ${
                  active
                    ? "border-hud-accent text-hud-text font-semibold"
                    : "border-transparent text-hud-muted hover:text-hud-text"
                }`}
              >
                <span>{localizePobFallbackText(spec.title, locale)}</span>
                <span className="text-[11px] font-mono tabular-nums text-hud-muted">
                  Lv{spec.minLevel} · {allocCount}/{spec.nodeIds.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs font-mono tabular-nums">
          <span className="text-hud-ok">
            {msg.tree.allocLabel} {diff.allocatedInTargetIds.length}/{diff.selectedSpec?.nodeIds.length ?? 0}
          </span>
          {diff.unallocatedAddedIds.length > 0 && (
            <span className="text-hud-warn">{msg.tree.bracketLabel(diff.unallocatedAddedIds.length)}</span>
          )}
          {diff.earlierMissedIds.length > 0 && (
            <span className="text-hud-cold">{msg.tree.earlierLabel(diff.earlierMissedIds.length)}</span>
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
          <Search className="h-3.5 w-3.5 text-hud-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            aria-label={msg.a11y.searchTreeLabel}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={msg.tree.searchPlaceholder}
            className="w-full rounded-lg bg-hud-subtle border-b border-hud-hairline pl-8 pr-16 py-2 text-xs text-hud-text placeholder:text-hud-muted focus:border-hud-accent"
          />
          {searchQuery && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[11px] font-mono text-hud-accent">{searchMatchCount}</span>
              <button
                type="button"
                aria-label={msg.a11y.clearSearch}
                title={msg.a11y.clearSearch}
                onClick={() => onSearchChange("")}
                className="p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={onFitBracket}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <LocateFixed className="h-3.5 w-3.5 text-hud-accent" />
            {msg.tree.fitBracket}
          </button>
          <button
            type="button"
            onClick={onFocusNextTarget}
            disabled={diff.nextNotableTargets.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle disabled:opacity-40 cursor-pointer"
          >
            <Crosshair className="h-3.5 w-3.5 text-hud-quest" />
            {msg.tree.nextPoint}
          </button>
          {hasAscendancyNodes && (
            <button
              type="button"
              onClick={onFocusAscendancy}
              className="px-2.5 py-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              {msg.tree.ascendancy}
            </button>
          )}
          <button
            type="button"
            aria-pressed={showFuture}
            onClick={onToggleShowFuture}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
              showFuture
                ? "text-hud-accent font-semibold bg-hud-subtle"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {msg.tree.futurePath}
          </button>
        </div>
      </div>
    </div>
  );
});
