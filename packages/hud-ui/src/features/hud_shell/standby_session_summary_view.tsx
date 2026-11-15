import type { HudSessionSnapshot } from "@exile-hud/core";
import { formatRunTimerClock, useLiveRunElapsedMs } from "../widgets/run_timer_clock_tracker.js";

export function StandbySessionSummaryView({
  snapshot,
  onOverridePreview,
}: {
  snapshot: HudSessionSnapshot;
  onOverridePreview: () => void;
}) {
  const liveElapsedMs = useLiveRunElapsedMs(snapshot);
  const completedCount = snapshot.checkpoints.filter((c) => c.completed).length;
  const pct = snapshot.checkpoints.length > 0 ? Math.round((completedCount / snapshot.checkpoints.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5 border-b border-hud-hairline">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-hud-muted font-semibold">
            Standby · Waiting for PathOfExile.exe
          </p>
          <h2 className="text-2xl font-bold text-hud-text mt-1">{snapshot.buildName}</h2>
        </div>

        <button
          type="button"
          onClick={onOverridePreview}
          className="px-3.5 py-1.5 rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 text-xs font-semibold cursor-pointer"
        >
          Preview Active HUD
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.12em] text-hud-muted font-semibold">
            Total Run Time (Paused)
          </div>
          <p className="text-4xl font-mono tabular-nums font-bold text-hud-text">
            {formatRunTimerClock(liveElapsedMs)}
          </p>
        </div>

        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.12em] text-hud-muted font-semibold">
            Campaign Checkpoints
          </div>
          <p className="text-4xl font-mono tabular-nums font-bold text-hud-ok">
            {pct}%{" "}
            <span className="text-base font-normal text-hud-muted">
              ({completedCount}/{snapshot.checkpoints.length})
            </span>
          </p>
        </div>
      </div>

      <div className="pt-6 border-t border-hud-hairline space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Act Split Times</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-4">
          {Array.from({ length: 10 }, (_, idx) => {
            const act = idx + 1;
            const splitMs = snapshot.actSplitsMs[`act_${act}`];
            return (
              <div key={act}>
                <div className="text-xs text-hud-muted">Act {act}</div>
                <div className="text-base font-mono tabular-nums text-hud-text mt-0.5">
                  {splitMs ? formatRunTimerClock(splitMs) : "--:--:--"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
