import type { HudSessionSnapshot } from "@exile-hud/core";
import { Timer } from "lucide-react";
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Run Timer</h2>
        </div>
        <span
          className={`px-2 py-0.5 rounded-lg text-xs font-mono ${
            snapshot.runTimerRunning
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "bg-neutral-900 text-neutral-400 border border-neutral-800"
          }`}
        >
          {snapshot.runTimerRunning ? "LIVE" : "PAUSED"}
        </span>
      </div>

      <div className="rounded-lg bg-black border border-neutral-800 p-4 text-center">
        <div className="text-3xl sm:text-4xl font-mono tabular-nums font-bold text-white tracking-tight">
          {formatClock(displayMs)}
        </div>
        <div className="text-xs text-neutral-400 mt-1">
          Act {snapshot.currentAct} • Checkpoints {completedCount}/{snapshot.checkpoints.length}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[1, 2, 3].map((act) => (
          <div key={act} className="rounded-lg bg-black border border-neutral-800 py-1.5 px-2">
            <div className="text-[11px] text-neutral-500">Act {act}</div>
            <div className="text-xs font-mono tabular-nums text-neutral-200">
              {snapshot.actSplitsMs[`act_${act}`] ? formatClock(snapshot.actSplitsMs[`act_${act}`]!) : "--:--"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
