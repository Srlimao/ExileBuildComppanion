import type { HudSessionSnapshot } from "@exile-hud/core";
import { BookmarkCheck, Check } from "lucide-react";

interface DeferredBacklogWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleCheckpoint: (checkpointId: string) => void;
}

export function DeferredBacklogWidget({ snapshot, onToggleCheckpoint }: DeferredBacklogWidgetProps) {
  const skipped = snapshot.checkpoints.filter(
    (cp) =>
      !cp.completed &&
      (cp.category === "SKILL_BOOK" || cp.category === "LAB_TRIAL") &&
      cp.sectionAct <= snapshot.highestUnlockedAct,
  );

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-5 w-5 text-[#EAB308]" />
          <h2 className="text-lg font-bold text-white">Cleanup Backlog</h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-neutral-400">{skipped.length} open</span>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {skipped.slice(0, 8).map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => onToggleCheckpoint(cp.id)}
            className="w-full text-left rounded-lg bg-black border border-neutral-800 hover:border-neutral-700 px-3 py-2 flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-100 truncate">{cp.title}</div>
              <div className="text-xs text-neutral-400">
                Act {cp.sectionAct} • {cp.areaName}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  cp.category === "SKILL_BOOK"
                    ? "bg-yellow-500/15 text-[#EAB308] border-yellow-500/40"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {cp.category === "SKILL_BOOK" ? "Book" : "Trial"}
              </span>
              <span className="h-5 w-5 rounded border border-neutral-700 flex items-center justify-center text-neutral-500">
                <Check className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}

        {skipped.length === 0 && (
          <p className="text-sm text-emerald-400 py-4 text-center">No skipped skill books or Lab trials!</p>
        )}
      </div>
    </div>
  );
}
