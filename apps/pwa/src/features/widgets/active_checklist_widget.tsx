import type { HudSessionSnapshot } from "@exile-hud/core";
import { Check, Circle, ListChecks } from "lucide-react";

interface ActiveChecklistWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleCheckpoint: (checkpointId: string) => void;
}

export function ActiveChecklistWidget({ snapshot, onToggleCheckpoint }: ActiveChecklistWidgetProps) {
  const currentActSteps = snapshot.checkpoints.filter(
    (cp) => cp.sectionAct === snapshot.currentAct || cp.areaId === snapshot.currentAreaId,
  );
  const firstPendingIdx = currentActSteps.findIndex((cp) => !cp.completed);
  const startIdx = Math.max(0, firstPendingIdx - 1);
  const visible = currentActSteps.slice(startIdx, startIdx + 7);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Act {snapshot.currentAct} Checklist</h2>
        </div>
        <span className="text-xs font-mono text-neutral-400 tabular-nums">
          {currentActSteps.filter((c) => c.completed).length}/{currentActSteps.length}
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {visible.map((cp) => {
          const isCurrentZone = cp.areaId === snapshot.currentAreaId;
          return (
            <button
              key={cp.id}
              type="button"
              onClick={() => onToggleCheckpoint(cp.id)}
              className={`w-full text-left rounded-lg border px-3.5 py-2.5 transition-colors flex items-start gap-3 cursor-pointer ${
                cp.completed
                  ? "bg-black/40 border-neutral-800/70 text-neutral-500 line-through"
                  : isCurrentZone
                    ? "bg-indigo-950/35 border-indigo-500/60 text-white"
                    : "bg-black border-neutral-800 text-neutral-200 hover:border-neutral-700"
              }`}
            >
              <span
                className={`mt-1 h-5 w-5 rounded-md flex items-center justify-center shrink-0 border ${
                  cp.completed
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : cp.softCompleted
                      ? "border-dashed border-amber-400 text-amber-300"
                      : "border-neutral-600 text-neutral-600"
                }`}
              >
                {cp.completed || cp.softCompleted ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base leading-snug font-medium">{cp.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                  <span>{cp.areaName}</span>
                  {cp.category === "SKILL_BOOK" && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-[#EAB308] border border-yellow-500/30 font-semibold">
                      +Skill Point
                    </span>
                  )}
                  {cp.category === "LAB_TRIAL" && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Trial
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
