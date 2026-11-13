import type { HudSessionSnapshot, PobBuildPreview, PobSetSelection } from "@exile-hud/core";
import { AlertTriangle, FileCode2, FolderOpen, RefreshCw, Route, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PobSetSelectorSection } from "./pob_set_selector_section.js";

interface InspectResult {
  decodedXml: string;
  preview: PobBuildPreview;
  selection: PobSetSelection;
}

interface PobBuildLoaderCardProps {
  snapshot: HudSessionSnapshot | null;
  pobInput: string;
  pobPreview: PobBuildPreview | null;
  pobSelection: PobSetSelection | null;
  pobStoragePath: string;
  leagueStart: boolean;
  customRouteText: string;
  loading: boolean;
  error: string | null;
  onInspectBuild: (rawPobInput: string, previousSelection?: PobSetSelection | null) => Promise<InspectResult>;
  onOpenStorageFolder: () => Promise<string | null>;
  onApplyBuild: (params: {
    pobInput: string;
    cachedXml?: string | null;
    selection?: PobSetSelection | null;
    leagueStart: boolean;
    customRouteText: string;
  }) => Promise<void>;
}

export function PobBuildLoaderCard({
  snapshot,
  pobInput,
  pobPreview,
  pobSelection,
  pobStoragePath,
  leagueStart,
  customRouteText,
  loading,
  error,
  onInspectBuild,
  onOpenStorageFolder,
  onApplyBuild,
}: PobBuildLoaderCardProps) {
  const [draftPob, setDraftPob] = useState(pobInput);
  const [draftLeagueStart, setDraftLeagueStart] = useState(leagueStart);
  const [draftRoute, setDraftRoute] = useState(customRouteText);
  const [showCustomRoute, setShowCustomRoute] = useState(Boolean(customRouteText));
  const [draftPreview, setDraftPreview] = useState<PobBuildPreview | null>(pobPreview);
  const [draftSelection, setDraftSelection] = useState<PobSetSelection | null>(pobSelection);
  const [cachedXmlForInput, setCachedXmlForInput] = useState<{ input: string; xml: string } | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  useEffect(() => {
    setDraftPob(pobInput);
    setDraftLeagueStart(leagueStart);
    setDraftRoute(customRouteText);
    if (customRouteText) setShowCustomRoute(true);
    setDraftPreview(pobPreview);
    setDraftSelection(pobSelection);
  }, [pobInput, leagueStart, customRouteText, pobPreview, pobSelection]);

  const runInspect = useCallback(
    async (rawInput: string) => {
      if (!rawInput.trim()) return;
      setInspecting(true);
      setInspectError(null);
      try {
        const res = await onInspectBuild(rawInput, draftSelection);
        setDraftPreview(res.preview);
        setDraftSelection(res.selection);
        setCachedXmlForInput({ input: rawInput, xml: res.decodedXml });
      } catch (err) {
        setInspectError(err instanceof Error ? err.message : String(err));
      } finally {
        setInspecting(false);
      }
    },
    [draftSelection, onInspectBuild],
  );

  useEffect(() => {
    const trimmed = draftPob.trim();
    if (!trimmed || trimmed === pobInput.trim() || trimmed === cachedXmlForInput?.input.trim()) return;
    const looksComplete = /^https?:\/\/pobb\.in\/[A-Za-z0-9_-]+/i.test(trimmed) || trimmed.startsWith("<") || trimmed.length > 24;
    if (!looksComplete) return;
    const timer = window.setTimeout(() => void runInspect(draftPob), 450);
    return () => window.clearTimeout(timer);
  }, [cachedXmlForInput?.input, draftPob, pobInput, runInspect]);

  const canOpenFolder = Boolean(pobStoragePath) && !pobStoragePath.startsWith("Browser ");

  return (
    <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">PoB & Campaign Route</h2>
        </div>
        <div className="inline-flex rounded-lg bg-black border border-neutral-800 p-0.5 text-[11px]">
          {[
            { label: "League Start", val: true },
            { label: "Twink", val: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setDraftLeagueStart(opt.val)}
              className={`px-2 py-0.5 rounded-md cursor-pointer ${
                draftLeagueStart === opt.val ? "bg-indigo-600 text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowCustomRoute((v) => !v)}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
        >
          <Route className="h-3.5 w-3.5" />
          {showCustomRoute ? "Hide custom .txt route" : "Custom route"}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={inspecting || !draftPob.trim()}
            onClick={() => void runInspect(draftPob)}
            className="rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 px-2.5 py-1.5 text-[11px] text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${inspecting ? "animate-spin" : ""}`} />
            {inspecting ? "Reading..." : "Inspect Sets"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void onApplyBuild({
                pobInput: draftPob,
                cachedXml: cachedXmlForInput?.input === draftPob ? cachedXmlForInput.xml : null,
                selection: draftSelection,
                leagueStart: draftLeagueStart,
                customRouteText: draftRoute,
              })
            }
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Compiling..." : "Compile & Save PoB"}
          </button>
        </div>
      </div>

      {draftPreview && draftSelection && (
        <PobSetSelectorSection preview={draftPreview} selection={draftSelection} onChange={setDraftSelection} />
      )}

      {showCustomRoute && (
        <textarea
          rows={3}
          value={draftRoute}
          onChange={(e) => setDraftRoute(e.target.value)}
          placeholder="Optional exile-leveling route fragment override..."
          className="w-full rounded-lg bg-black border border-neutral-800 p-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none"
        />
      )}

      {(error || inspectError) && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          {error || inspectError}
        </div>
      )}

      {pobStoragePath && (
        <div className="border-t border-neutral-800 pt-2 flex items-center justify-between gap-2 text-[10px] text-neutral-400">
          <div className="min-w-0 truncate" title={pobStoragePath}>
            <span className="text-neutral-500">Saved locally: </span>
            <span className="font-mono text-neutral-300">{pobStoragePath}</span>
          </div>
          {canOpenFolder && (
            <button
              type="button"
              onClick={() => void onOpenStorageFolder()}
              className="shrink-0 rounded-md bg-black border border-neutral-800 hover:border-neutral-700 px-2 py-1 text-[10px] text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="h-3 w-3 text-indigo-400" />
              Open Save Folder
            </button>
          )}
        </div>
      )}
    </section>
  );
}
