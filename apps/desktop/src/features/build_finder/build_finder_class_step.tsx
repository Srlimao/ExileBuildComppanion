import {
  getClassCatalogForGame,
  type BuildCatalogFacetsResponse,
  type SupportedGameId,
} from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { ArrowRight, Compass, Sparkles } from "lucide-react";

interface BuildFinderClassStepProps {
  gameId: SupportedGameId;
  facets: BuildCatalogFacetsResponse | null;
  selectedBaseClass: string;
  selectedAscendancy: string;
  onSelectClass: (baseClass: string, ascendancy: string) => void;
  onNext: () => void;
  onSkipToAll: () => void;
}

/** Step 1 of the Build Finder wizard: Class & Ascendancy selection with live counts. */
export function BuildFinderClassStep({
  gameId,
  facets,
  selectedBaseClass,
  selectedAscendancy,
  onSelectClass,
  onNext,
  onSkipToAll,
}: BuildFinderClassStepProps) {
  const { appMsg } = useHudI18n();
  const msg = appMsg.buildFinder;
  const catalog = getClassCatalogForGame(gameId);

  const countByClass = new Map<string, { count: number; asc: Map<string, number> }>();
  for (const c of facets?.classes ?? []) {
    const ascMap = new Map<string, number>();
    for (const a of c.ascendancies) ascMap.set(a.name, a.count);
    countByClass.set(c.baseClass, { count: c.count, asc: ascMap });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-hud-text">{msg.classStepTitle}</h2>
          <p className="text-xs text-hud-muted mt-0.5">{msg.classStepSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onSkipToAll}
          className="rounded-lg bg-hud-subtle border border-hud-hairline hover:border-hud-accent/60 px-3 py-1.5 text-xs font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Compass className="h-3.5 w-3.5 text-hud-accent" />
          {msg.skipToAllBtn}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onSelectClass("", "")}
          className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
            selectedBaseClass === ""
              ? "bg-hud-accent/12 border-hud-accent text-hud-text"
              : "bg-hud-surface border-hud-hairline hover:border-hud-accent/50 text-hud-text"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{msg.anyClassTitle}</span>
            <span className="text-[11px] font-mono text-hud-muted">
              {facets ? (facets.pobReadyBuilds || facets.totalBuilds) : "—"}
            </span>
          </div>
          <p className="text-[11px] text-hud-muted mt-1">{msg.anyClassSubtitle}</p>
        </button>

        {catalog.map((def) => {
          const isSelected = selectedBaseClass === def.baseClass;
          const stats = countByClass.get(def.baseClass);
          return (
            <div
              key={def.baseClass}
              className={`rounded-xl border p-3 transition-colors ${
                isSelected
                  ? "bg-hud-accent/12 border-hud-accent"
                  : "bg-hud-surface border-hud-hairline hover:border-hud-accent/50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectClass(def.baseClass, "")}
                className="w-full text-left flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="text-xs font-semibold text-hud-text">{def.baseClass}</span>
                <span className="text-[11px] font-mono text-hud-muted">
                  {stats ? stats.count : "—"}
                </span>
              </button>
              <div className="flex flex-wrap gap-1 mt-2">
                {def.ascendancies.map((asc) => {
                  const ascCount = stats?.asc.get(asc) ?? 0;
                  const ascActive = isSelected && selectedAscendancy === asc;
                  return (
                    <button
                      key={asc}
                      type="button"
                      onClick={() => onSelectClass(def.baseClass, ascActive ? "" : asc)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] border transition-colors cursor-pointer ${
                        ascActive
                          ? "bg-hud-accent text-hud-accent-fg border-hud-accent font-semibold"
                          : "bg-hud-subtle/70 border-hud-hairline text-hud-muted hover:text-hud-text"
                      }`}
                    >
                      {asc}
                      {facets ? ` (${ascCount})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-hud-hairline">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {msg.nextTagsBtn}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
