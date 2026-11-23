import {
  evaluateActiveActQuestGroups,
  type CheckpointStepItem,
  type HudSessionSnapshot,
  type QuestGroupProgressSummary,
} from "@exile-hud/core";
import { useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizeRouteStepTitle } from "../i18n/route_step_title_localizer.js";

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
  activeGroup: QuestGroupProgressSummary | null;
  isHoldingForUnvisitedMandatory: boolean;
  missingMandatoryAreaIds: string[];
}

function arePrereqsCleared(cp: CheckpointStepItem, cleared: ReadonlySet<string>): boolean {
  const prereqs = cp.prerequisiteAreaIds;
  if (!prereqs || prereqs.length === 0) return true;
  return prereqs.every((areaId) => cleared.has(areaId));
}

/**
 * Selects the 7-step rolling window constrained to the earliest unsatisfied Mandatory Quest
 * Group so the HUD never jumps past unvisited mandatory maps into the next story phase.
 */
export function selectChecklistWindow(snapshot: HudSessionSnapshot): ChecklistWindowSelection {
  const currentActSteps = snapshot.checkpoints.filter(
    (cp) => cp.sectionAct === snapshot.currentAct || cp.areaId === snapshot.currentAreaId,
  );
  const doneCount = currentActSteps.filter((c) => c.completed).length;
  const firstActPendingIdx = currentActSteps.findIndex((cp) => !cp.completed);
  const allActDone = currentActSteps.length > 0 && firstActPendingIdx === -1;
  const groupEval = evaluateActiveActQuestGroups(snapshot);
  const activeGroup = groupEval.activeGroup;

  if (currentActSteps.length === 0 || allActDone || !activeGroup || activeGroup.checkpoints.length === 0) {
    return {
      currentActSteps,
      visibleSteps: [],
      doneCount,
      allActDone,
      earlierPendingCount: 0,
      anchorIdx: -1,
      activeGroup: allActDone ? null : activeGroup,
      isHoldingForUnvisitedMandatory: false,
      missingMandatoryAreaIds: activeGroup?.missingMandatoryAreaIds ?? [],
    };
  }

  const groupSteps = activeGroup.checkpoints;
  const cleared = new Set<string>(snapshot.clearedAreaIds ?? []);
  const visited = new Set<string>(snapshot.visitedAreaIds ?? []);
  if (snapshot.currentAreaId && !/hideout/i.test(snapshot.currentAreaId)) {
    visited.add(snapshot.currentAreaId);
  }
  const missingSet = new Set<string>(activeGroup.missingMandatoryAreaIds);
  const findPending = (predicate: (cp: CheckpointStepItem, idx: number) => boolean): number =>
    groupSteps.findIndex((cp, idx) => !cp.completed && predicate(cp, idx));

  let afterCombatIdx = -1;
  if (!groupEval.isHoldingForUnvisitedMandatory && snapshot.lastCombatZoneId) {
    afterCombatIdx = findPending(
      (cp) => cp.areaId === snapshot.lastCombatZoneId && arePrereqsCleared(cp, cleared),
    );
    if (afterCombatIdx === -1) {
      let lastCombatIdx = -1;
      for (let i = groupSteps.length - 1; i >= 0; i -= 1) {
        if (groupSteps[i]!.areaId === snapshot.lastCombatZoneId) {
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

  const firstGroupPendingIdx = groupSteps.findIndex((cp) => !cp.completed);
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
    findPending((cp) => Boolean(cp.isMandatoryGate) && missingSet.has(cp.areaId) && !visited.has(cp.areaId)),
    findPending((cp) => Boolean(cp.isMandatoryGate) && missingSet.has(cp.areaId)),
    findPending((cp) => !cp.isOptionalDetour && arePrereqsCleared(cp, cleared)),
    firstGroupPendingIdx !== -1 ? firstGroupPendingIdx : 0,
  ];
  const anchorIdx = candidates.find((idx) => idx !== -1) ?? 0;
  const startIdx = Math.max(0, anchorIdx - 1);
  const visibleSteps = groupSteps.slice(startIdx, startIdx + 7);
  const firstVisibleActIdx = visibleSteps[0]
    ? currentActSteps.findIndex((cp) => cp.id === visibleSteps[0]!.id)
    : 0;
  const earlierPendingCount =
    firstVisibleActIdx > 0
      ? currentActSteps.slice(0, firstVisibleActIdx).filter((cp) => !cp.completed).length
      : 0;

  return {
    currentActSteps,
    visibleSteps,
    doneCount,
    allActDone,
    earlierPendingCount,
    anchorIdx,
    activeGroup,
    isHoldingForUnvisitedMandatory: groupEval.isHoldingForUnvisitedMandatory,
    missingMandatoryAreaIds: activeGroup.missingMandatoryAreaIds,
  };
}

export function ActiveChecklistWidget({ snapshot, onToggleCheckpoint }: ActiveChecklistWidgetProps) {
  const { locale, msg } = useHudI18n();
  const [showCompleted, setShowCompleted] = useState(false);
  const {
    currentActSteps,
    visibleSteps,
    doneCount,
    allActDone,
    earlierPendingCount,
    activeGroup,
    isHoldingForUnvisitedMandatory,
  } = selectChecklistWindow(snapshot);
  const visible = showCompleted ? currentActSteps : visibleSteps;
  const unvisitedMandatorySet = new Set<string>(activeGroup?.unvisitedMandatoryAreaIds ?? []);

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.actStepsTitle(snapshot.currentAct)}
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {(doneCount > 0 || earlierPendingCount > 0) && (
            <button
              type="button"
              aria-pressed={showCompleted}
              data-testid="toggle-completed-steps"
              onClick={() => setShowCompleted((v) => !v)}
              className="px-2 py-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle transition-colors cursor-pointer"
            >
              {showCompleted
                ? msg.widgets.pendingOnly
                : earlierPendingCount > 0
                  ? msg.widgets.showAllEarlier(earlierPendingCount)
                  : msg.widgets.showAll}
            </button>
          )}
          <span className="font-mono text-hud-muted tabular-nums">
            {doneCount}/{currentActSteps.length}
          </span>
        </div>
      </div>

      {!showCompleted && activeGroup && !allActDone && (
        <div
          data-testid="active-quest-group-bar"
          className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-hud-subtle/60 border border-white/5 text-[11px]"
        >
          <span className="font-medium text-hud-text/80 truncate">
            {msg.widgets.questGroupLabel(
              activeGroup.groupIndex + 1,
              activeGroup.totalGroups,
              locale === "pt-BR" ? activeGroup.titlePtBr : activeGroup.titleEn,
            )}
          </span>
          {isHoldingForUnvisitedMandatory && activeGroup.unvisitedMandatoryAreaIds.length > 0 && (
            <span
              data-testid="quest-group-blocked-badge"
              className="shrink-0 font-medium text-hud-warn"
            >
              {msg.widgets.groupBlockedByUnvisited(activeGroup.unvisitedMandatoryAreaIds.length)}
            </span>
          )}
        </div>
      )}

      <div className="space-y-0.5 overflow-y-auto pr-1">
        {visible.map((cp) => {
          const isCurrentZone = cp.areaId === snapshot.currentAreaId;
          const isRequiredBlocker = Boolean(
            cp.isMandatoryGate &&
              !cp.completed &&
              unvisitedMandatorySet.has(cp.areaId) &&
              (!activeGroup || !cp.questGroupId || cp.questGroupId === activeGroup.groupId),
          );
          return (
            <button
              key={cp.id}
              type="button"
              aria-pressed={cp.completed}
              onClick={() => onToggleCheckpoint(cp.id)}
              className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors hover:bg-hud-subtle flex items-baseline justify-between gap-3 cursor-pointer ${
                cp.completed ? "text-hud-dim line-through" : ""
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 transition-colors"
                  style={{
                    backgroundColor: cp.completed
                      ? "var(--hud-dim)"
                      : cp.softCompleted || (isHoldingForUnvisitedMandatory && isRequiredBlocker)
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
                    {localizeRouteStepTitle(cp.title, locale)}
                  </div>
                  <div className="text-xs text-hud-muted mt-0.5 truncate">{cp.areaName}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs font-medium">
                {isRequiredBlocker && (
                  <span data-testid="required-unvisited-badge" className="text-hud-warn">
                    {msg.widgets.requiredUnvisitedBadge}
                  </span>
                )}
                {cp.category === "SKILL_BOOK" && (
                  <span className="text-hud-quest">{msg.widgets.plusOneSkill}</span>
                )}
                {cp.category === "LAB_TRIAL" && (
                  <span className="text-hud-ok">{msg.widgets.trial}</span>
                )}
              </div>
            </button>
          );
        })}

        {allActDone && !showCompleted && (
          <p className="text-sm text-hud-ok py-4 font-medium">
            {msg.widgets.allActStepsComplete(snapshot.currentAct)}
          </p>
        )}
      </div>
    </div>
  );
}
