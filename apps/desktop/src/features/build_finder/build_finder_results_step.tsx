import {
  getClassCatalogForGame,
  type BuildCatalogEntry,
  type BuildCatalogSource,
  type BuildGoalTag,
  type BuildPlaystyleTag,
  type SupportedGameId,
} from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { RefreshCw, Search, X } from "lucide-react";
import { BuildFinderResultCard } from "./build_finder_result_card.js";

interface BuildFinderResultsStepProps {
  gameId: SupportedGameId;
  items: BuildCatalogEntry[];
  total: number;
  latestPatch: string;
  loading: boolean;
  error: string | null;
  importingId: string | null;
  baseClass: string;
  ascendancy: string;
  playstyleTags: BuildPlaystyleTag[];
  goalTags: BuildGoalTag[];
  sourceFilter: BuildCatalogSource | "";
  pobOnly: boolean;
  searchQuery: string;
  sortKey: "recommended" | "updated" | "popular";
  onChangeClass: (baseClass: string, ascendancy: string) => void;
  onRemovePlaystyle: (tag: BuildPlaystyleTag) => void;
  onRemoveGoal: (tag: BuildGoalTag) => void;
  onChangeSource: (source: BuildCatalogSource | "") => void;
  onTogglePobOnly: (next: boolean) => void;
  onChangeSearch: (q: string) => void;
  onChangeSort: (sort: "recommended" | "updated" | "popular") => void;
  onResetFilters: () => void;
  onRetry: () => void;
  onImportBuild: (entry: BuildCatalogEntry) => void;
  onOpenGuide: (url: string) => void;
}

/** Step 3 of Build Finder: live filter bar + 2-column scannable OLED build cards. */
export function BuildFinderResultsStep(props: BuildFinderResultsStepProps) {
  const { appMsg } = useHudI18n();
  const msg = appMsg.buildFinder;
  const catalog = getClassCatalogForGame(props.gameId);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-hud-surface border border-hud-hairline p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-hud-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={props.searchQuery}
              onChange={(e) => props.onChangeSearch(e.target.value)}
              placeholder={msg.searchPlaceholder}
              className="w-full rounded-lg bg-hud-subtle border border-hud-hairline pl-8 pr-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
            />
          </div>

          <select
            value={props.baseClass}
            onChange={(e) => props.onChangeClass(e.target.value, "")}
            className="rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
          >
            <option value="">{msg.anyClassTitle}</option>
            {catalog.map((c) => (
              <option key={c.baseClass} value={c.baseClass}>
                {c.baseClass}
              </option>
            ))}
          </select>

          <select
            value={props.sourceFilter}
            onChange={(e) => props.onChangeSource(e.target.value as BuildCatalogSource | "")}
            className="rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
          >
            <option value="">{msg.allSourcesLabel}</option>
            {(["maxroll", "poebuilds", "poeforum"] as BuildCatalogSource[]).map((src) => (
              <option key={src} value={src}>
                {msg.sourceLabels[src]}
              </option>
            ))}
          </select>

          <select
            value={props.sortKey}
            onChange={(e) =>
              props.onChangeSort(e.target.value as "recommended" | "updated" | "popular")
            }
            aria-label={msg.sortLabel}
            className="rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
          >
            {(["recommended", "updated", "popular"] as const).map((key) => (
              <option key={key} value={key}>
                {msg.sortOptions[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {props.ascendancy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-hud-accent/15 border border-hud-accent/40 px-2 py-0.5 text-[11px] text-hud-text">
                {props.ascendancy}
                <button
                  type="button"
                  onClick={() => props.onChangeClass(props.baseClass, "")}
                  className="hover:text-hud-accent cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {props.playstyleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-hud-subtle border border-hud-hairline px-2 py-0.5 text-[11px] text-hud-text"
              >
                {msg.playstyleLabels[tag]}
                <button
                  type="button"
                  onClick={() => props.onRemovePlaystyle(tag)}
                  className="text-hud-muted hover:text-hud-text cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {props.goalTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-hud-subtle border border-hud-hairline px-2 py-0.5 text-[11px] text-hud-text"
              >
                {msg.goalLabels[tag]}
                <button
                  type="button"
                  onClick={() => props.onRemoveGoal(tag)}
                  className="text-hud-muted hover:text-hud-text cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-hud-text cursor-pointer">
              <input
                type="checkbox"
                checked={props.pobOnly}
                onChange={(e) => props.onTogglePobOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--hud-accent)] cursor-pointer"
              />
              {msg.pobReadyOnlyLabel}
            </label>
            <span className="text-[11px] font-mono text-hud-muted">
              {msg.buildsFoundCount(props.total)}
            </span>
          </div>
        </div>
      </div>

      {props.error ? (
        <div className="rounded-xl bg-hud-surface border border-hud-danger/40 p-6 text-center space-y-2">
          <div className="text-sm font-semibold text-hud-text">{msg.catalogOfflineTitle}</div>
          <p className="text-xs text-hud-muted">{props.error || msg.catalogOfflineHint}</p>
          <button
            type="button"
            onClick={props.onRetry}
            className="rounded-lg bg-hud-accent text-hud-accent-fg px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {msg.retryBtn}
          </button>
        </div>
      ) : props.loading ? (
        <div className="rounded-xl bg-hud-surface border border-hud-hairline p-8 text-center text-xs text-hud-muted">
          {msg.catalogLoadingMsg}
        </div>
      ) : props.items.length === 0 ? (
        <div className="rounded-xl bg-hud-surface border border-hud-hairline p-8 text-center space-y-2">
          <div className="text-sm font-semibold text-hud-text">{msg.noMatchesTitle}</div>
          <p className="text-xs text-hud-muted">{msg.noMatchesHint}</p>
          <button
            type="button"
            onClick={props.onResetFilters}
            className="rounded-lg bg-hud-subtle border border-hud-hairline hover:border-hud-accent px-3 py-1.5 text-xs text-hud-text cursor-pointer"
          >
            {msg.resetFiltersBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {props.items.map((entry) => (
            <BuildFinderResultCard
              key={entry.id}
              entry={entry}
              latestPatch={props.latestPatch}
              importing={props.importingId === entry.id}
              onImportBuild={props.onImportBuild}
              onOpenGuide={props.onOpenGuide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
