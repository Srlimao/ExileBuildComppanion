import { RotateCcw, Skull } from "lucide-react";

interface DeathRespawnResumeBannerProps {
  areaName: string;
  onDismiss: () => void;
}

export function DeathRespawnResumeBanner({ areaName, onDismiss }: DeathRespawnResumeBannerProps) {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-3">
      <div className="rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Skull className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-red-200">
              Slain — Take Portal Back to <span className="text-white underline">{areaName}</span>
            </p>
            <p className="text-xs text-red-300/80">
              Town entered via Resurrect in Town; combat progression anchored to {areaName}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-500/15 text-xs font-semibold text-red-200 hover:bg-red-500/25 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
