import { countCompletedProgress, type HudSessionSnapshot } from "@exile-hud/core";
import { CheckCircle2, RotateCcw } from "lucide-react";
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
  const [confirming, setConfirming] = useState(false);
  const counts = countCompletedProgress(snapshot);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="font-mono tabular-nums text-neutral-200 truncate">
          Checks: {counts.completedCheckpoints}/{counts.totalCheckpoints} steps ·{" "}
          {counts.completedGems}/{counts.totalGems} gems
        </span>
        <span className="hidden sm:inline-block text-[10px] font-mono text-emerald-400/90 border border-emerald-500/30 bg-emerald-500/10 rounded px-1.5 py-0.5 shrink-0">
          Saved on PC
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
            className="rounded-lg bg-red-600 hover:bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
          >
            Confirm Reset
          </button>
          <button
            type="button"
            data-testid="pc-cancel-reset-progress-btn"
            onClick={() => setConfirming(false)}
            className="rounded-lg bg-black border border-neutral-700 hover:border-neutral-600 px-2 py-1 text-[11px] text-neutral-300 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="pc-reset-progress-btn"
          onClick={() => setConfirming(true)}
          title="Reset all checklist steps and gem checks back to zero"
          className="rounded-lg bg-black border border-neutral-800 hover:border-red-500/50 hover:text-red-300 px-2.5 py-1 text-[11px] text-neutral-300 inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Checks
        </button>
      )}
    </div>
  );
}
