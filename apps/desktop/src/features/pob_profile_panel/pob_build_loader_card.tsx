import type { HudSessionSnapshot } from "@exile-hud/core";
import { AlertTriangle, FileCode2, Route, Sparkles } from "lucide-react";
import { useState } from "react";

interface PobBuildLoaderCardProps {
  snapshot: HudSessionSnapshot | null;
  pobInput: string;
  leagueStart: boolean;
  customRouteText: string;
  loading: boolean;
  error: string | null;
  onApplyBuild: (params: { pobInput: string; leagueStart: boolean; customRouteText: string }) => Promise<void>;
}

export function PobBuildLoaderCard({
  snapshot,
  pobInput,
  leagueStart,
  customRouteText,
  loading,
  error,
  onApplyBuild,
}: PobBuildLoaderCardProps) {
  const [draftPob, setDraftPob] = useState(pobInput);
  const [draftLeagueStart, setDraftLeagueStart] = useState(leagueStart);
  const [draftRoute, setDraftRoute] = useState(customRouteText);
  const [showCustomRoute, setShowCustomRoute] = useState(Boolean(customRouteText));

  return (
    <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">PoB & Campaign Route</h2>
        </div>
        <div className="inline-flex rounded-lg bg-black border border-neutral-800 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setDraftLeagueStart(true)}
            className={`px-2 py-0.5 rounded-md cursor-pointer ${
              draftLeagueStart ? "bg-indigo-600 text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            League Start
          </button>
          <button
            type="button"
            onClick={() => setDraftLeagueStart(false)}
            className={`px-2 py-0.5 rounded-md cursor-pointer ${
              !draftLeagueStart ? "bg-indigo-600 text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Twink
          </button>
        </div>
      </div>

      {snapshot && (
        <div className="rounded-lg bg-black border border-neutral-800 px-3 py-2 flex items-center justify-between text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{snapshot.buildName}</div>
            <div className="text-[11px] text-neutral-400">
              {snapshot.characterClass} · {snapshot.ascendancyName} · {snapshot.checkpoints.length} steps
            </div>
          </div>
          <span className="font-mono text-[11px] text-emerald-400 shrink-0">{snapshot.gemSteps.length} gems</span>
        </div>
      )}

      {snapshot?.isEndgameOnlyFallback && snapshot.fallbackNotice && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{snapshot.fallbackNotice}</span>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-400">pobb.in URL, PoB Export Code, or XML</span>
        <textarea
          rows={3}
          value={draftPob}
          onChange={(e) => setDraftPob(e.target.value)}
          placeholder="https://pobb.in/... or raw PoB code"
          className="w-full rounded-lg bg-black border border-neutral-800 p-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </label>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowCustomRoute((v) => !v)}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
        >
          <Route className="h-3.5 w-3.5" />
          {showCustomRoute ? "Hide custom .txt route" : "Append custom .txt route"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void onApplyBuild({
              pobInput: draftPob,
              leagueStart: draftLeagueStart,
              customRouteText: draftRoute,
            })
          }
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "Compiling..." : "Compile & Push"}
        </button>
      </div>

      {showCustomRoute && (
        <textarea
          rows={3}
          value={draftRoute}
          onChange={(e) => setDraftRoute(e.target.value)}
          placeholder="Optional exile-leveling route fragment override..."
          className="w-full rounded-lg bg-black border border-neutral-800 p-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none"
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}
