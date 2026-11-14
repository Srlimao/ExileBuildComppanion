import type { CheckpointStepItem, HudSessionSnapshot } from "@exile-hud/core";
import { Check, Circle, ListChecks } from "lucide-react";
import { useState } from "react";

interface ActiveChecklistWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleCheckpoint: (checkpointId: string) => void;
}

export interface ChecklistWindowSelection {
  currentActSteps: CheckpointStepItem[];
  visibleSteps: CheckpointStepItem[];
  doneCount: number;
  allActDone: boolean;
  earlierPendingCount: number;
  anchorIdx: number;
}

function arePrereqsCleared(cp: CheckpointStepItem, cleared: ReadonlySet<string>): boolean {
  const prereqs = cp.prerequisiteAreaIds;
  if (!prereqs || prereqs.length === 0) return true;
  return prereqs.every((areaId) => cleared.has(areaId));
}

/**
 * Selects the 7-step rolling window anchored on the player's current combat zone or
 * ready town turn-in rather than pinning on an earlier skipped optional branch.
 */
export function selectChecklistWindow(snapshot: HudSessionSnapshot): ChecklistWindowSelection {
  const currentActSteps = snapshot.checkpoints.filter(
    (cp) => cp.sectionAct === snapshot.currentAct || cp.areaId === snapshot.currentAreaId,
  );
  const doneCount = currentActSteps.filter((c) => c.completed).length;
  const firstPendingIdx = currentActSteps.findIndex((cp) => !cp.completed);
  const allActDone = currentActSteps.length > 0 && firstPendingIdx === -1;

  if (currentActSteps.length === 0 || allActDone) {
    return {
      currentActSteps,
      visibleSteps: [],
      doneCount,
      allActDone,
      earlierPendingCount: 0,
      anchorIdx: -1,
    };
  }

  const cleared = new Set<string>(snapshot.clearedAreaIds ?? []);
  const findPending = (predicate: (cp: CheckpointStepItem, idx: number) => boolean): number =>
    currentActSteps.findIndex((cp, idx) => !cp.completed && predicate(cp, idx));

  let afterCombatIdx = -1;
  if (snapshot.lastCombatZoneId) {
    afterCombatIdx = findPending(
      (cp) => cp.areaId === snapshot.lastCombatZoneId && arePrereqsCleared(cp, cleared),
    );
    if (afterCombatIdx === -1) {
      let lastCombatIdx = -1;
      for (let i = currentActSteps.length - 1; i >= 0; i -= 1) {
        if (currentActSteps[i]!.areaId === snapshot.lastCombatZoneId) {
          lastCombatIdx = i;
          break;
        }
      }
      if (lastCombatIdx !== -1) {
        afterCombatIdx = findPending(
          (cp, idx) => idx > lastCombatIdx && !cp.isOptionalDetour && arePrereqsCleared(cp, cleared),
        );
      }
    }
  }

  const candidates = [
    findPending(
      (cp) =>
        cp.areaId === snapshot.currentAreaId &&
        cp.stepKind === "quest_turn_in" &&
        arePrereqsCleared(cp, cleared),
    ),
    findPending(
      (cp) =>
        cp.areaId === snapshot.currentAreaId &&
        cp.stepKind !== "quest_turn_in" &&
        cp.stepKind !== "travel_lead_in" &&
        arePrereqsCleared(cp, cleared),
    ),
    findPending(
      (cp) =>
        cp.areaId === snapshot.currentAreaId &&
        cp.stepKind !== "quest_turn_in" &&
        cp.stepKind !== "travel_lead_in",
    ),
    afterCombatIdx,
    findPending((cp) => !cp.isOptionalDetour && arePrereqsCleared(cp, cleared)),
    firstPendingIdx,
  ];
  const anchorIdx = candidates.find((idx) => idx !== -1) ?? firstPendingIdx;
  const startIdx = Math.max(0, anchorIdx - 1);
  const visibleSteps = currentActSteps.slice(startIdx, startIdx + 7);
  const earlierPendingCount = currentActSteps.slice(0, startIdx).filter((cp) => !cp.completed).length;

  return {
    currentActSteps,
    visibleSteps,
    doneCount,
    allActDone,
    earlierPendingCount,
    anchorIdx,
  };
}

export function ActiveChecklistWidget({ snapshot, onToggleCheckpoint }: ActiveChecklistWidgetProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const { currentActSteps, visibleSteps, doneCount, allActDone, earlierPendingCount } =
    selectChecklistWindow(snapshot);
  const visible = showCompleted ? currentActSteps : visibleSteps;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Act {snapshot.currentAct} Checklist</h2>
        </div>
        <div className="flex items-center gap-2">
          {(doneCount > 0 || earlierPendingCount > 0) && (
            <button
              type="button"
              data-testid="toggle-completed-steps"
              onClick={() => setShowCompleted((v) => !v)}
              className="rounded-md border border-neutral-800 bg-black hover:border-neutral-700 px-2 py-0.5 text-[11px] font-mono text-neutral-300 cursor-pointer"
            >
              {showCompleted
                ? "Pending only"
                : earlierPendingCount > 0
                  ? `Show all (${earlierPendingCount} earlier)`
                  : "Show all"}
            </button>
          )}
          <span className="text-xs font-mono text-neutral-400 tabular-nums">
            {doneCount}/{currentActSteps.length}
          </span>
        </div>
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
                {cp.completed || cp.softCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
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

        {allActDone && !showCompleted && (
          <p className="text-sm text-emerald-400 py-6 text-center font-medium">
            All Act {snapshot.currentAct} steps complete!
          </p>
        )}
      </div>
    </div>
  );
}
