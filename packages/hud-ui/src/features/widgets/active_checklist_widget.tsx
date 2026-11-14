import type { CheckpointStepItem, HudSessionSnapshot } from "@exile-hud/core";
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
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          Act {snapshot.currentAct} Steps
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {(doneCount > 0 || earlierPendingCount > 0) && (
            <button
              type="button"
              data-testid="toggle-completed-steps"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-hud-muted hover:text-hud-text transition-colors cursor-pointer"
            >
              {showCompleted
                ? "Pending only"
                : earlierPendingCount > 0
                  ? `Show all (${earlierPendingCount} earlier)`
                  : "Show all"}
            </button>
          )}
          <span className="font-mono text-hud-muted tabular-nums">
            {doneCount}/{currentActSteps.length}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 overflow-y-auto pr-1">
        {visible.map((cp) => {
          const isCurrentZone = cp.areaId === snapshot.currentAreaId;
          return (
            <button
              key={cp.id}
              type="button"
              onClick={() => onToggleCheckpoint(cp.id)}
              className={`w-full text-left px-2 py-1.5 -mx-2 rounded-md transition-colors hover:bg-hud-subtle flex items-baseline justify-between gap-3 cursor-pointer ${
                cp.completed ? "text-hud-dim line-through" : ""
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 transition-colors"
                  style={{
                    backgroundColor: cp.completed
                      ? "var(--hud-dim)"
                      : cp.softCompleted
                        ? "var(--hud-warn)"
                        : isCurrentZone
                          ? "var(--hud-accent)"
                          : "var(--hud-muted)",
                    boxShadow: !cp.completed && isCurrentZone ? "0 0 8px var(--hud-accent-glow)" : "none",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm leading-snug ${
                      cp.completed
                        ? "text-hud-dim"
                        : isCurrentZone
                          ? "text-hud-text font-semibold"
                          : "text-hud-text/80"
                    }`}
                  >
                    {cp.title}
                  </div>
                  <div className="text-xs text-hud-muted mt-0.5 truncate">{cp.areaName}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs font-medium">
                {cp.category === "SKILL_BOOK" && (
                  <span className="text-hud-quest">+1 Skill</span>
                )}
                {cp.category === "LAB_TRIAL" && (
                  <span className="text-hud-ok">Trial</span>
                )}
              </div>
            </button>
          );
        })}

        {allActDone && !showCompleted && (
          <p className="text-sm text-hud-ok py-4 font-medium">
            All Act {snapshot.currentAct} steps complete
          </p>
        )}
      </div>
    </div>
  );
}
