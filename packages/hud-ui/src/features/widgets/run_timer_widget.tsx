import type { HudSessionSnapshot } from "@exile-hud/core";
import { useEffect, useState } from "react";

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RunTimerWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const [displayMs, setDisplayMs] = useState(snapshot.runElapsedMs);

  useEffect(() => {
    setDisplayMs(snapshot.runElapsedMs);
    if (!snapshot.runTimerRunning || !snapshot.poeRunning) return;
    const id = window.setInterval(() => setDisplayMs((prev) => prev + 1000), 1000);
    return () => window.clearInterval(id);
  }, [snapshot.runElapsedMs, snapshot.runTimerRunning, snapshot.poeRunning]);

  const completedCount = snapshot.checkpoints.filter((c) => c.completed).length;

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Run Timer</h2>
        <span className={`text-xs font-mono ${snapshot.runTimerRunning ? "text-hud-ok" : "text-hud-muted"}`}>
          {snapshot.runTimerRunning ? "LIVE" : "PAUSED"}
        </span>
      </div>

      <div>
        <div className="text-3xl sm:text-4xl font-mono tabular-nums font-bold text-hud-text tracking-tight">
          {formatClock(displayMs)}
        </div>
        <div className="text-xs text-hud-muted mt-1">
          Act {snapshot.currentAct} · Checkpoints {completedCount}/{snapshot.checkpoints.length}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        {[1, 2, 3].map((act) => (
          <div key={act}>
            <div className="text-[11px] text-hud-muted">Act {act}</div>
            <div className="text-xs font-mono tabular-nums text-hud-text">
              {snapshot.actSplitsMs[`act_${act}`] ? formatClock(snapshot.actSplitsMs[`act_${act}`]!) : "--:--"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
