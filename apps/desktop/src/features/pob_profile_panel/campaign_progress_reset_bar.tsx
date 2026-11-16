import { countCompletedProgress, type HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

interface CampaignProgressResetBarProps {
  snapshot: HudSessionSnapshot;
  onResetProgress: () => void;
}

const CONFIRM_TIMEOUT_MS = 4000;

/** Compact bar displaying persisted checklist/gem totals and a 2-step reset action. */
export function CampaignProgressResetBar({
  snapshot,
  onResetProgress,
}: CampaignProgressResetBarProps) {
  const { appMsg } = useHudI18n();
  const [confirming, setConfirming] = useState(false);
  const counts = countCompletedProgress(snapshot);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <div className="border-b border-hud-hairline pb-2.5 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-1.5 w-1.5 rounded-full bg-hud-ok shrink-0" />
        <span className="font-mono tabular-nums text-hud-text truncate">
          {appMsg.desktop.progressCounts(
            counts.completedCheckpoints,
            counts.totalCheckpoints,
            counts.completedGems,
            counts.totalGems,
          )}
        </span>
        <span className="hidden sm:inline-block text-[11px] font-mono text-hud-ok shrink-0">
          {appMsg.desktop.savedOnPc}
        </span>
      </div>

      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="pc-confirm-reset-progress-btn"
            onClick={() => {
              onResetProgress();
              setConfirming(false);
            }}
            className="rounded-md bg-hud-danger px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
          >
            {appMsg.desktop.confirmReset}
          </button>
          <button
            type="button"
            data-testid="pc-cancel-reset-progress-btn"
            onClick={() => setConfirming(false)}
            className="rounded-md px-2 py-1 text-[11px] text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="pc-reset-progress-btn"
          onClick={() => setConfirming(true)}
          title={appMsg.desktop.resetChecksTitle}
          className="rounded-md hover:bg-hud-subtle hover:text-hud-danger px-2 py-1 text-[11px] text-hud-muted inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          {appMsg.desktop.resetChecks}
        </button>
      )}
    </div>
  );
}
