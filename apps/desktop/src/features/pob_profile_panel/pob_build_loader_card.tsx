import type { HudSessionSnapshot, PobBuildPreview, PobSetSelection } from "@exile-hud/core";
import { AlertTriangle, FolderOpen, RefreshCw, Route, Sparkles } from "lucide-react";
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
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          PoB &amp; Campaign Route
        </h2>
        <div className="inline-flex items-center gap-3 text-[11px]">
          {[
            { label: "League Start", val: true },
            { label: "Twink", val: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setDraftLeagueStart(opt.val)}
              className={`pb-0.5 border-b-2 cursor-pointer transition-colors ${
                draftLeagueStart === opt.val
                  ? "border-hud-accent text-hud-text font-semibold"
                  : "border-transparent text-hud-muted hover:text-hud-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {snapshot && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-hud-text truncate">{snapshot.buildName}</div>
            <div className="text-[11px] text-hud-muted">
              {snapshot.characterClass} · {snapshot.ascendancyName} · {snapshot.checkpoints.length} steps
            </div>
          </div>
          <span className="font-mono text-[11px] text-hud-ok shrink-0">{snapshot.gemSteps.length} gems</span>
        </div>
      )}

      {snapshot?.isEndgameOnlyFallback && snapshot.fallbackNotice && (
        <div className="border-l-2 border-hud-warn pl-2.5 py-0.5 text-[11px] text-hud-warn flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{snapshot.fallbackNotice}</span>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-[11px] text-hud-muted">pobb.in URL, PoB Export Code, or XML</span>
        <textarea
          rows={3}
          value={draftPob}
          onChange={(e) => setDraftPob(e.target.value)}
          placeholder="https://pobb.in/... or raw PoB code"
          className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowCustomRoute((v) => !v)}
          className="text-[11px] text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
        >
          <Route className="h-3.5 w-3.5" />
          {showCustomRoute ? "Hide custom .txt route" : "Custom route"}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={inspecting || !draftPob.trim()}
            onClick={() => void runInspect(draftPob)}
            className="rounded-md hover:bg-hud-subtle disabled:opacity-45 px-2.5 py-1.5 text-[11px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
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
            className="rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
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
          className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />
      )}

      {(error || inspectError) && (
        <p className="border-l-2 border-hud-danger pl-2.5 py-0.5 text-[11px] text-hud-danger">
          {error || inspectError}
        </p>
      )}

      {pobStoragePath && (
        <div className="pt-2 flex items-center justify-between gap-2 text-[10px] text-hud-muted">
          <div className="min-w-0 truncate" title={pobStoragePath}>
            <span>Saved locally: </span>
            <span className="font-mono text-hud-text">{pobStoragePath}</span>
          </div>
          {canOpenFolder && (
            <button
              type="button"
              onClick={() => void onOpenStorageFolder()}
              className="shrink-0 rounded-md hover:bg-hud-subtle px-2 py-1 text-[10px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="h-3 w-3 text-hud-accent" />
              Open Save Folder
            </button>
          )}
        </div>
      )}
    </section>
  );
}
