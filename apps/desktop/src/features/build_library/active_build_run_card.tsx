import { countCompletedProgress, type HudSessionSnapshot } from "@exile-hud/core";
import { formatRunTimerClock, useHudI18n } from "@exile-hud/hud-ui";
import { Pencil, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { BuildLibraryEntrySummary } from "./build_library_types.js";

interface ActiveBuildRunCardProps {
  activeEntry: BuildLibraryEntrySummary | null;
  snapshot: HudSessionSnapshot | null;
  busy: boolean;
  onEditActive: (relativePath: string) => Promise<void>;
  onResetProgress: () => void;
}

const CONFIRM_TIMEOUT_MS = 4000;

/** Unified active build summary + campaign progress + 2-step reset card for the Builds tab. */
export function ActiveBuildRunCard({
  activeEntry,
  snapshot,
  busy,
  onEditActive,
  onResetProgress,
}: ActiveBuildRunCardProps) {
  const { appMsg } = useHudI18n();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  if (!activeEntry && !snapshot) return null;

  const snapCounts = snapshot ? countCompletedProgress(snapshot) : null;
  const completedSteps = snapCounts?.completedCheckpoints ?? activeEntry?.summary.completedCheckpoints ?? 0;
  const totalSteps = snapCounts?.totalCheckpoints ?? activeEntry?.summary.totalCheckpoints ?? 0;
  const completedGems = snapCounts?.completedGems ?? activeEntry?.summary.completedGems ?? 0;
  const totalGems = snapCounts?.totalGems ?? activeEntry?.summary.totalGems ?? 0;
  const pct = totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;

  const buildName = activeEntry?.name || snapshot?.buildName || appMsg.desktop.activeBuildPillLabel;
  const classLabel =
    activeEntry?.summary.ascendancyName ||
    activeEntry?.summary.characterClass ||
    snapshot?.ascendancyName ||
    snapshot?.characterClass ||
    "PoB";
  const linkedChar = activeEntry?.characterName || snapshot?.characterName || "";
  const currentAct = snapshot?.currentAct ?? activeEntry?.summary.currentAct ?? 1;
  const elapsedMs = snapshot?.runElapsedMs ?? activeEntry?.runElapsedMs ?? 0;

  return (
    <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-1.5 w-1.5 rounded-full bg-hud-ok shrink-0" />
            <h2 className="text-xs font-bold text-hud-text truncate">{buildName}</h2>
          </div>
          <div className="text-[11px] text-hud-muted mt-0.5 truncate flex items-center gap-1">
            <span className="truncate">
              {classLabel}
              {linkedChar ? ` · ${linkedChar}` : ""}
              {` · Act ${currentAct}`}
            </span>
            {elapsedMs > 0 && (
              <span className="font-mono text-hud-ok shrink-0">
                · {formatRunTimerClock(elapsedMs)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeEntry && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEditActive(activeEntry.relativePath)}
              title={appMsg.desktop.editActiveBuild}
              aria-label={appMsg.desktop.editActiveBuild}
              className="p-1.5 rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 text-hud-text cursor-pointer disabled:opacity-45 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            data-testid="pc-reset-progress-btn"
            onClick={() => setConfirming((v) => !v)}
            title={appMsg.desktop.resetChecksTitle}
            aria-label={appMsg.desktop.resetChecks}
            className="p-1.5 rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 hover:text-hud-danger text-hud-muted cursor-pointer transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-hud-subtle overflow-hidden">
          <div
            className="h-full rounded-full bg-hud-accent transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-hud-muted">
          <span className="truncate">
            {appMsg.desktop.progressCounts(completedSteps, totalSteps, completedGems, totalGems)}
          </span>
          <span className="shrink-0">{pct}%</span>
        </div>
      </div>

      {confirming && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline text-[11px]">
          <span className="text-hud-danger truncate">{appMsg.desktop.resetRunConfirmPrompt}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="pc-confirm-reset-progress-btn"
              onClick={() => {
                onResetProgress();
                setConfirming(false);
              }}
              className="rounded-md bg-hud-danger px-2 py-0.5 text-[11px] font-semibold text-white cursor-pointer"
            >
              {appMsg.desktop.confirmReset}
            </button>
            <button
              type="button"
              data-testid="pc-cancel-reset-progress-btn"
              onClick={() => setConfirming(false)}
              className="rounded-md bg-hud-subtle px-2 py-0.5 text-[11px] text-hud-muted hover:text-hud-text cursor-pointer"
            >
              {appMsg.desktop.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
