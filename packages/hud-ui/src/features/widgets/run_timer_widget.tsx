import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { formatRunTimerClock, useLiveRunElapsedMs } from "./run_timer_clock_tracker.js";

export function RunTimerWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { msg } = useHudI18n();
  const displayMs = useLiveRunElapsedMs(snapshot);
  const isLive = snapshot.runTimerRunning && snapshot.poeRunning;
  const completedCount = snapshot.checkpoints.filter((c) => c.completed).length;

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.runTimer}
        </h2>
        <span className={`text-xs font-mono ${isLive ? "text-hud-ok" : "text-hud-muted"}`}>
          {isLive ? msg.widgets.live : msg.widgets.paused}
        </span>
      </div>

      <div>
        <div className="text-3xl sm:text-4xl font-mono tabular-nums font-bold text-hud-text tracking-tight">
          {formatRunTimerClock(displayMs)}
        </div>
        <div className="text-xs text-hud-muted mt-1">
          {msg.widgets.actWord} {snapshot.currentAct} · {msg.widgets.checkpointsLabel} {completedCount}/{snapshot.checkpoints.length}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        {[1, 2, 3].map((act) => (
          <div key={act}>
            <div className="text-[11px] text-hud-muted">{msg.standby.actLabel(act)}</div>
            <div className="text-xs font-mono tabular-nums text-hud-text">
              {snapshot.actSplitsMs[`act_${act}`] ? formatRunTimerClock(snapshot.actSplitsMs[`act_${act}`]!) : "--:--"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
