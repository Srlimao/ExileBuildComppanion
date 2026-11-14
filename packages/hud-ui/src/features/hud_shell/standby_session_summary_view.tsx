import type { HudSessionSnapshot } from "@exile-hud/core";
import { CheckCircle2, Clock, PauseCircle } from "lucide-react";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StandbySessionSummaryView({
  snapshot,
  onOverridePreview,
}: {
  snapshot: HudSessionSnapshot;
  onOverridePreview: () => void;
}) {
  const completedCount = snapshot.checkpoints.filter((c) => c.completed).length;
  const pct = snapshot.checkpoints.length > 0 ? Math.round((completedCount / snapshot.checkpoints.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 opacity-90">
      <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
            <PauseCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
              Standby • Waiting for PathOfExile.exe
            </p>
            <h2 className="text-2xl font-bold text-white mt-0.5">{snapshot.buildName}</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onOverridePreview}
          className="px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-sm font-medium text-neutral-200 hover:border-neutral-600 cursor-pointer"
        >
          Preview Active HUD Grid
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 space-y-2">
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <Clock className="h-4 w-4" /> Total Run Time (Paused)
          </div>
          <p className="text-4xl font-mono tabular-nums font-bold text-white">
            {formatElapsed(snapshot.runElapsedMs)}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 space-y-2">
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Campaign Checkpoints
          </div>
          <p className="text-4xl font-mono tabular-nums font-bold text-emerald-400">
            {pct}% <span className="text-base font-normal text-neutral-400">({completedCount}/{snapshot.checkpoints.length})</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">Act Split Times</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }, (_, idx) => {
            const act = idx + 1;
            const splitMs = snapshot.actSplitsMs[`act_${act}`];
            return (
              <div key={act} className="rounded-lg bg-black border border-neutral-800 p-3">
                <div className="text-xs text-neutral-500">Act {act}</div>
                <div className="text-base font-mono tabular-nums text-neutral-200 mt-1">
                  {splitMs ? formatElapsed(splitMs) : "--:--:--"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
