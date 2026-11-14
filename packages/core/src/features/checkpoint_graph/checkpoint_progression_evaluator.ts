import type { GameAdapter } from "@exile-hud/game-data";
import type { CheckpointStepItem, HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { getStrictImpliedAreaIds } from "./area_dominator_resolver.js";
import { isTownOrHideoutArea } from "./zone_context_disambiguator.js";

interface CheckpointBlock {
  areaId: string;
  expectedExitAreaId?: string;
  visitIndex: number;
  totalVisitsForArea: number;
  indices: number[];
}

export interface ZoneTransitionEvaluationInput {
  state: HudSessionSnapshot;
  enteredAreaId: string;
  nextHighestAct: number;
  isTownOrHideout: boolean;
  adapter: GameAdapter;
}

export interface ZoneTransitionEvaluationResult {
  checkpoints: CheckpointStepItem[];
  visitedAreaIds: string[];
  clearedAreaIds: string[];
}

function buildCheckpointBlocks(checkpoints: readonly CheckpointStepItem[]): {
  blocks: CheckpointBlock[];
  blockIndexByStep: number[];
} {
  const blocks: CheckpointBlock[] = [];
  const blockIndexByStep = new Array<number>(checkpoints.length);
  const countByArea = new Map<string, number>();

  for (let i = 0; i < checkpoints.length; i += 1) {
    const start = i;
    const areaId = checkpoints[i]!.areaId;
    while (i + 1 < checkpoints.length && checkpoints[i + 1]!.areaId === areaId) {
      i += 1;
    }
    const nextStep = i + 1 < checkpoints.length ? checkpoints[i + 1] : undefined;
    const visitIndex = countByArea.get(areaId) ?? 0;
    countByArea.set(areaId, visitIndex + 1);
    const indices: number[] = [];
    const blockIdx = blocks.length;
    for (let k = start; k <= i; k += 1) {
      indices.push(k);
      blockIndexByStep[k] = blockIdx;
    }
    blocks.push({
      areaId,
      expectedExitAreaId: nextStep?.areaId ?? checkpoints[start]!.expectedExitAreaId,
      visitIndex,
      totalVisitsForArea: 1,
      indices,
    });
  }
  for (const block of blocks) {
    block.totalVisitsForArea = countByArea.get(block.areaId) ?? 1;
  }
  return { blocks, blockIndexByStep };
}

/** Returns true when every prerequisite combat area of `cp` has been cleared. */
export function areCheckpointPrerequisitesMet(cp: CheckpointStepItem, cleared: ReadonlySet<string>): boolean {
  const prereqs = cp.prerequisiteAreaIds;
  return !prereqs || prereqs.length === 0 || prereqs.every((areaId) => cleared.has(areaId));
}

function findExitedStepIndices(
  prevAreaId: string,
  enteredAreaId: string,
  diedOnExit: boolean,
  checkpoints: readonly CheckpointStepItem[],
  blocks: readonly CheckpointBlock[],
  cleared: ReadonlySet<string>,
  visited: ReadonlySet<string>,
): { exactStepSet: Set<number>; fallbackStepSet: Set<number> } {
  const exactStepSet = new Set<number>();
  const fallbackStepSet = new Set<number>();
  if (!prevAreaId || prevAreaId === enteredAreaId || diedOnExit) {
    return { exactStepSet, fallbackStepSet };
  }

  const pendingPrevBlocks = blocks.filter(
    (b) => b.areaId === prevAreaId && b.indices.some((idx) => !checkpoints[idx]!.completed),
  );
  if (pendingPrevBlocks.length === 0) return { exactStepSet, fallbackStepSet };

  const exactBlock = pendingPrevBlocks.find((b) => b.expectedExitAreaId === enteredAreaId);
  if (exactBlock) {
    for (const idx of exactBlock.indices) exactStepSet.add(idx);
    if (exactBlock !== pendingPrevBlocks[0]) {
      for (const b of pendingPrevBlocks) {
        for (const idx of b.indices) {
          const cp = checkpoints[idx]!;
          if (cp.stepKind === "zone_entry" && !cp.isOptionalDetour && areCheckpointPrerequisitesMet(cp, cleared)) {
            fallbackStepSet.add(idx);
          }
        }
      }
    }
    return { exactStepSet, fallbackStepSet };
  }

  for (const block of pendingPrevBlocks) {
    const hasEligibleStep = block.indices.some((idx) => {
      const cp = checkpoints[idx]!;
      const leadMissing = cp.stepKind === "travel_lead_in" && cp.expectedExitAreaId && !visited.has(cp.expectedExitAreaId);
      return !cp.completed && !cp.isOptionalDetour && !leadMissing && areCheckpointPrerequisitesMet(cp, cleared);
    });
    if (hasEligibleStep) {
      for (const idx of block.indices) fallbackStepSet.add(idx);
      break;
    }
  }
  return { exactStepSet, fallbackStepSet };
}

/**
 * Evaluates campaign checkpoint completion and soft-completion using strict area-graph dominance,
 * Visit-Block exit matching, prerequisite area verification, and death-respawn guards.
 */
export function evaluateZoneTransitionCheckpoints(
  input: ZoneTransitionEvaluationInput,
): ZoneTransitionEvaluationResult {
  const { state, enteredAreaId, nextHighestAct, isTownOrHideout, adapter } = input;
  const prevAreaId = state.currentAreaId;
  const diedOnExit = isTownOrHideout && state.recentDeath;

  const visited = new Set<string>(state.visitedAreaIds ?? []);
  const cleared = new Set<string>(state.clearedAreaIds ?? []);
  if (prevAreaId && !/hideout/i.test(prevAreaId)) {
    visited.add(prevAreaId);
    if (prevAreaId !== enteredAreaId && !diedOnExit) cleared.add(prevAreaId);
  }
  if (!/hideout/i.test(enteredAreaId)) visited.add(enteredAreaId);

  const impliedAreaIds = diedOnExit ? new Set<string>() : getStrictImpliedAreaIds(enteredAreaId, nextHighestAct, adapter);
  for (const impliedId of impliedAreaIds) {
    visited.add(impliedId);
    cleared.add(impliedId);
  }

  const enteredArea = adapter.getAreas()[enteredAreaId];
  const enteredAct = Number(enteredArea?.act ?? 0) || nextHighestAct;
  const canImplyPriorActs =
    Boolean(enteredArea) &&
    !/hideout|labyrinth/i.test(enteredAreaId) &&
    (!enteredArea!.is_town_area || enteredAreaId === adapter.getActEntryAreaId(enteredAct));

  const { blocks, blockIndexByStep } = buildCheckpointBlocks(state.checkpoints);
  const { exactStepSet, fallbackStepSet } = findExitedStepIndices(
    prevAreaId,
    enteredAreaId,
    diedOnExit,
    state.checkpoints,
    blocks,
    cleared,
    visited,
  );

  const checkpoints = state.checkpoints.map((rawCp, idx) => {
    const cp = { ...rawCp };
    if (cp.completed) {
      cp.softCompleted = false;
      return cp;
    }

    const prereqsMet = areCheckpointPrerequisitesMet(cp, cleared);
    const leftCpZoneNormally = prevAreaId === cp.areaId && enteredAreaId !== cp.areaId && !diedOnExit;

    if (cp.stepKind === "ascend") {
      if (!diedOnExit && (cp.prerequisiteAreaIds?.length ?? 0) > 0 && prereqsMet) {
        cp.completed = true;
        cp.softCompleted = false;
      }
      return cp;
    }
    if (cp.category === "SKILL_BOOK" || cp.category === "LAB_TRIAL") {
      if (leftCpZoneNormally && prereqsMet) cp.softCompleted = true;
      return cp;
    }
    if (cp.stepKind === "quest_turn_in") {
      if (prereqsMet && (leftCpZoneNormally || (canImplyPriorActs && !cp.isOptionalDetour && cp.sectionAct < enteredAct))) {
        cp.completed = true;
        cp.softCompleted = false;
      }
      return cp;
    }

    if (!diedOnExit && prereqsMet) {
      const leadTargetMissing =
        cp.stepKind === "travel_lead_in" && cp.expectedExitAreaId !== undefined && !visited.has(cp.expectedExitAreaId);
      const block = blocks[blockIndexByStep[idx]!]!;
      const blockedMultiVisitObjective =
        cp.stepKind !== "zone_entry" &&
        block.totalVisitsForArea > 1 &&
        block.expectedExitAreaId !== undefined &&
        !isTownOrHideoutArea(block.expectedExitAreaId, adapter) &&
        !visited.has(block.expectedExitAreaId);
      const completedByExit = exactStepSet.has(idx) || (fallbackStepSet.has(idx) && !cp.isOptionalDetour && !leadTargetMissing);
      const completedByDominance = impliedAreaIds.has(cp.areaId) && !cp.isOptionalDetour && !leadTargetMissing && !blockedMultiVisitObjective;

      if (completedByExit || completedByDominance) {
        cp.completed = true;
        cp.softCompleted = false;
      }
    }
    return cp;
  });

  return { checkpoints, visitedAreaIds: [...visited], clearedAreaIds: [...cleared] };
}

/** Selects the best pending `SKILL_BOOK` checkpoint index when a passive skill point book is consumed. */
export function selectSkillBookCheckpointForCompletion(state: HudSessionSnapshot): number {
  const visited = new Set<string>(state.visitedAreaIds ?? []);
  const cleared = new Set<string>(state.clearedAreaIds ?? []);
  if (state.currentAreaId && !/hideout/i.test(state.currentAreaId)) visited.add(state.currentAreaId);

  const eligibleIndices: number[] = [];
  for (let i = 0; i < state.checkpoints.length; i += 1) {
    const cp = state.checkpoints[i]!;
    if (cp.category === "SKILL_BOOK" && !cp.completed && cp.sectionAct <= state.highestUnlockedAct) {
      eligibleIndices.push(i);
    }
  }
  if (eligibleIndices.length === 0) return -1;

  const tiers: Array<(cp: CheckpointStepItem) => boolean> = [
    (cp) => areCheckpointPrerequisitesMet(cp, cleared) && cp.sectionAct === state.currentAct,
    (cp) => areCheckpointPrerequisitesMet(cp, cleared),
    (cp) => !cp.prerequisiteAreaIds?.length || cp.prerequisiteAreaIds.every((id) => visited.has(id) || cleared.has(id)),
    (cp) => cp.sectionAct === state.currentAct,
    () => true,
  ];
  for (const predicate of tiers) {
    const match = eligibleIndices.find((idx) => predicate(state.checkpoints[idx]!));
    if (match !== undefined) return match;
  }
  return -1;
}
