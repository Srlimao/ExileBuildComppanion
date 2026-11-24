import type {
  BuildCatalogEntry,
  BuildCatalogFacetsResponse,
  BuildCatalogSource,
  BuildGoalTag,
  BuildPlaystyleTag,
  SupportedGameId,
} from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { Compass, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BuildFinderClassStep } from "./build_finder_class_step.js";
import {
  closeBuildFinderWindowIpc,
  fetchBuildCatalogEntries,
  fetchBuildCatalogFacets,
  openExternalGuideUrlIpc,
  resolveBuildPobInputForSelection,
  selectBuildFromFinderIpc,
  subscribeBuildFinderOpened,
} from "./build_finder_ipc_and_api.js";
import { BuildFinderResultsStep } from "./build_finder_results_step.js";
import { BuildFinderTagsStep } from "./build_finder_tags_step.js";

type FinderStep = 1 | 2 | 3;

function readInitialSearchParam(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(key) || fallback;
}

/** Root `?window=build-finder` window hosting the guided 3-step community build selector. */
export function BuildFinderWindowApp() {
  const { appMsg } = useHudI18n();
  const msg = appMsg.buildFinder;

  const [gameId, setGameId] = useState<SupportedGameId>(() =>
    readInitialSearchParam("gameId", "poe1") === "poe2" ? "poe2" : "poe1",
  );
  const [relayUrl, setRelayUrl] = useState<string>(() =>
    readInitialSearchParam("relayUrl", "https://exile.dunhas.com"),
  );
  const [step, setStep] = useState<FinderStep>(1);
  const [baseClass, setBaseClass] = useState("");
  const [ascendancy, setAscendancy] = useState("");
  const [playstyleTags, setPlaystyleTags] = useState<BuildPlaystyleTag[]>([]);
  const [goalTags, setGoalTags] = useState<BuildGoalTag[]>([]);
  const [sourceFilter, setSourceFilter] = useState<BuildCatalogSource | "">("");
  const [pobOnly, setPobOnly] = useState(() => gameId === "poe1");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"recommended" | "updated" | "popular">("recommended");

  const [facets, setFacets] = useState<BuildCatalogFacetsResponse | null>(null);
  const [items, setItems] = useState<BuildCatalogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [latestPatch, setLatestPatch] = useState("");
  const [activeLeague, setActiveLeague] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    let unsub: () => void = () => undefined;
    void subscribeBuildFinderOpened((payload) => {
      const nextGame = payload.gameId === "poe2" ? "poe2" : "poe1";
      setGameId(nextGame);
      setRelayUrl(payload.relayUrl || "https://exile.dunhas.com");
      setPobOnly(nextGame === "poe1");
      setStep(1);
      setBaseClass("");
      setAscendancy("");
      setPlaystyleTags([]);
      setGoalTags([]);
      setSourceFilter("");
      setSearchQuery("");
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);

  const loadFacets = useCallback(async () => {
    try {
      const data = await fetchBuildCatalogFacets(relayUrl, gameId, pobOnly);
      setFacets(data);
      setLatestPatch(data.latestPatch);
      setActiveLeague(data.activeLeague);
    } catch {
      // Facets are non-blocking; results view surfaces the offline/retry banner if unreachable.
    }
  }, [gameId, pobOnly, relayUrl]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBuildCatalogEntries(relayUrl, {
        gameId,
        baseClass: baseClass || undefined,
        ascendancy: ascendancy || undefined,
        playstyleTags,
        goalTags,
        source: sourceFilter || undefined,
        pobOnly,
        search: searchQuery || undefined,
        sort: sortKey,
        limit: 60,
        offset: 0,
      });
      setItems(res.items);
      setTotal(res.total);
      setLatestPatch(res.latestPatch);
      setActiveLeague(res.activeLeague);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    ascendancy,
    baseClass,
    gameId,
    goalTags,
    playstyleTags,
    pobOnly,
    relayUrl,
    searchQuery,
    sortKey,
    sourceFilter,
  ]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleImportBuild = async (entry: BuildCatalogEntry) => {
    setImportingId(entry.id);
    try {
      const pobInput = await resolveBuildPobInputForSelection(relayUrl, entry);
      await selectBuildFromFinderIpc({
        gameId: entry.gameId,
        title: entry.title,
        author: entry.author,
        source: entry.source,
        patchVersion: entry.patchVersion,
        pobInput,
        guideUrl: entry.guideUrl,
        leagueStart: entry.goalTags.includes("league_starter"),
      });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-hud-bg text-hud-text overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-hud-hairline bg-hud-surface">
        <div className="flex items-center gap-2.5 min-w-0">
          <Compass className="h-4 w-4 text-hud-accent shrink-0" />
          <span className="text-sm font-semibold text-hud-text">{msg.windowTitle}</span>
          <span className="rounded-md bg-hud-subtle border border-hud-hairline px-2 py-0.5 text-[10px] font-semibold uppercase text-hud-accent">
            {gameId === "poe2" ? "PoE 2" : "PoE 1"}
          </span>
          {(latestPatch || activeLeague) && (
            <span className="text-[11px] font-mono text-hud-muted truncate">
              {msg.freshnessUpdatedLabel(latestPatch, activeLeague)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                step === idx
                  ? "bg-hud-accent text-hud-accent-fg font-semibold"
                  : "bg-hud-subtle text-hud-muted hover:text-hud-text"
              }`}
            >
              {msg.stepLabels[idx - 1]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void closeBuildFinderWindowIpc()}
            title={msg.closeBtn}
            aria-label={msg.closeBtn}
            className="ml-1 p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {step === 1 && (
          <BuildFinderClassStep
            gameId={gameId}
            facets={facets}
            selectedBaseClass={baseClass}
            selectedAscendancy={ascendancy}
            onSelectClass={(nextClass, nextAsc) => {
              setBaseClass(nextClass);
              setAscendancy(nextAsc);
            }}
            onNext={() => setStep(2)}
            onSkipToAll={() => {
              setBaseClass("");
              setAscendancy("");
              setPlaystyleTags([]);
              setGoalTags([]);
              setStep(3);
            }}
          />
        )}

        {step === 2 && (
          <BuildFinderTagsStep
            facets={facets}
            playstyleTags={playstyleTags}
            goalTags={goalTags}
            pobOnly={pobOnly}
            matchingCount={total}
            onTogglePlaystyle={(tag) =>
              setPlaystyleTags((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
              )
            }
            onToggleGoal={(tag) =>
              setGoalTags((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
              )
            }
            onTogglePobOnly={setPobOnly}
            onBack={() => setStep(1)}
            onShowResults={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <BuildFinderResultsStep
            gameId={gameId}
            items={items}
            total={total}
            latestPatch={latestPatch}
            loading={loading}
            error={error}
            importingId={importingId}
            baseClass={baseClass}
            ascendancy={ascendancy}
            playstyleTags={playstyleTags}
            goalTags={goalTags}
            sourceFilter={sourceFilter}
            pobOnly={pobOnly}
            searchQuery={searchQuery}
            sortKey={sortKey}
            onChangeClass={(nextClass, nextAsc) => {
              setBaseClass(nextClass);
              setAscendancy(nextAsc);
            }}
            onRemovePlaystyle={(tag) =>
              setPlaystyleTags((prev) => prev.filter((t) => t !== tag))
            }
            onRemoveGoal={(tag) => setGoalTags((prev) => prev.filter((t) => t !== tag))}
            onChangeSource={setSourceFilter}
            onTogglePobOnly={setPobOnly}
            onChangeSearch={setSearchQuery}
            onChangeSort={setSortKey}
            onResetFilters={() => {
              setBaseClass("");
              setAscendancy("");
              setPlaystyleTags([]);
              setGoalTags([]);
              setSourceFilter("");
              setPobOnly(false);
              setSearchQuery("");
            }}
            onRetry={() => void loadCatalog()}
            onImportBuild={(entry) => void handleImportBuild(entry)}
            onOpenGuide={(url) => void openExternalGuideUrlIpc(url)}
          />
        )}
      </main>
    </div>
  );
}
