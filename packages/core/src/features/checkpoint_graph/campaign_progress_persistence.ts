import type { CheckpointStepItem, HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { computeNextTownCurrencyBudget } from "../route_compiler/gem_quest_and_vendor_assigner.js";
import { buildVendorSearchRegex } from "../vendor_regex/vendor_search_regex_builder.js";

export interface SavedCampaignProgress {
  completedCheckpointIds: string[];
  softCompletedCheckpointIds: string[];
  manualCompletedGemIds: string[];
  softAcquiredGemIds: string[];
  wasExplicitlyReset: boolean;
  updatedAtMs: number;
}

export interface CampaignProgressCounts {
  completedCheckpoints: number;
  totalCheckpoints: number;
  completedGems: number;
  totalGems: number;
  hasAnyProgress: boolean;
}

/** Computes stable per-act semantic keys so conditional route edits do not shift other acts. */
export function computeCheckpointProgressKeys(checkpoints: readonly CheckpointStepItem[]): string[] {
  const counts = new Map<string, number>();
  return checkpoints.map((cp) => {
    const base = `${cp.sectionAct}|${cp.areaId}|${cp.category}|${cp.questId ?? ""}|${cp.title}`;
    const occ = (counts.get(base) ?? 0) + 1;
    counts.set(base, occ);
    return `${base}#${occ}`;
  });
}

/** Extracts persistable checkpoint and gem completion state from a session snapshot. */
export function extractCampaignProgress(
  snapshot: HudSessionSnapshot,
  options?: { wasExplicitlyReset?: boolean; nowMs?: number },
): SavedCampaignProgress {
  const keys = computeCheckpointProgressKeys(snapshot.checkpoints);
  const completedCheckpointIds: string[] = [];
  const softCompletedCheckpointIds: string[] = [];

  snapshot.checkpoints.forEach((cp, idx) => {
    const key = keys[idx]!;
    if (cp.completed) {
      completedCheckpointIds.push(key);
    } else if (cp.softCompleted) {
      softCompletedCheckpointIds.push(key);
    }
  });

  const manualCompletedGemIds: string[] = [];
  const softAcquiredGemIds: string[] = [];
  for (const gs of snapshot.gemSteps) {
    if (gs.manualCompleted) {
      manualCompletedGemIds.push(gs.id);
    } else if (gs.softAcquired) {
      softAcquiredGemIds.push(gs.id);
    }
  }

  return {
    completedCheckpointIds,
    softCompletedCheckpointIds,
    manualCompletedGemIds,
    softAcquiredGemIds,
    wasExplicitlyReset: options?.wasExplicitlyReset ?? false,
    updatedAtMs: options?.nowMs ?? Date.now(),
  };
}

/** Returns an empty progress record marked as explicitly reset. */
export function createEmptyCampaignProgress(nowMs?: number): SavedCampaignProgress {
  return {
    completedCheckpointIds: [],
    softCompletedCheckpointIds: [],
    manualCompletedGemIds: [],
    softAcquiredGemIds: [],
    wasExplicitlyReset: true,
    updatedAtMs: nowMs ?? Date.now(),
  };
}

/** Resets all checkpoint, gem, and completed trial flags and recomputes vendor budget/regex. */
export function resetSnapshotProgress(snapshot: HudSessionSnapshot): HudSessionSnapshot {
  const checkpoints = snapshot.checkpoints.map((cp) => ({
    ...cp,
    completed: false,
    softCompleted: false,
  }));
  const gemSteps = snapshot.gemSteps.map((gs) => ({
    ...gs,
    manualCompleted: false,
    softAcquired: false,
    verifiedByApi: false,
  }));
  const currentAct = snapshot.highestUnlockedAct;

  return {
    ...snapshot,
    version: snapshot.version + 1,
    checkpoints,
    gemSteps,
    lab: {
      ...snapshot.lab,
      completedTrialAreaIds: [],
    },
    nextTownCurrencyBudget: computeNextTownCurrencyBudget(gemSteps, currentAct),
    activeVendorRegex: buildVendorSearchRegex({
      gemSteps,
      linkGroups: snapshot.linkGroups,
      currentAct,
    }),
  };
}

/** Merges saved progress onto a freshly compiled or bootstrapped snapshot (or honors explicit reset). */
export function applySavedCampaignProgress(
  snapshot: HudSessionSnapshot,
  saved: SavedCampaignProgress | null | undefined,
): HudSessionSnapshot {
  if (!saved) return snapshot;

  const isEmptyReset =
    saved.wasExplicitlyReset &&
    saved.completedCheckpointIds.length === 0 &&
    saved.softCompletedCheckpointIds.length === 0 &&
    saved.manualCompletedGemIds.length === 0 &&
    saved.softAcquiredGemIds.length === 0;

  if (isEmptyReset) {
    return {
      ...resetSnapshotProgress(snapshot),
      version: snapshot.version,
    };
  }

  const completedSet = new Set(saved.completedCheckpointIds);
  const softSet = new Set(saved.softCompletedCheckpointIds);
  const manualGemSet = new Set(saved.manualCompletedGemIds);
  const softGemSet = new Set(saved.softAcquiredGemIds);
  const keys = computeCheckpointProgressKeys(snapshot.checkpoints);

  const checkpoints = snapshot.checkpoints.map((cp, idx) => {
    const key = keys[idx]!;
    const completed = cp.completed || completedSet.has(key) || completedSet.has(cp.id);
    const softCompleted = !completed && (cp.softCompleted || softSet.has(key) || softSet.has(cp.id));
    return { ...cp, completed, softCompleted };
  });

  const gemSteps = snapshot.gemSteps.map((gs) => {
    const manualCompleted = gs.manualCompleted || manualGemSet.has(gs.id);
    const softAcquired = !manualCompleted && (gs.softAcquired || softGemSet.has(gs.id));
    return { ...gs, manualCompleted, softAcquired };
  });

  const currentAct = snapshot.highestUnlockedAct;
  return {
    ...snapshot,
    checkpoints,
    gemSteps,
    nextTownCurrencyBudget: computeNextTownCurrencyBudget(gemSteps, currentAct),
    activeVendorRegex: buildVendorSearchRegex({
      gemSteps,
      linkGroups: snapshot.linkGroups,
      currentAct,
    }),
  };
}

/** Counts completed checkpoints and gems across the campaign snapshot for HUD/desktop displays. */
export function countCompletedProgress(snapshot: HudSessionSnapshot): CampaignProgressCounts {
  let completedCheckpoints = 0;
  let softCheckpoints = 0;
  for (const cp of snapshot.checkpoints) {
    if (cp.completed) completedCheckpoints++;
    else if (cp.softCompleted) softCheckpoints++;
  }

  let completedGems = 0;
  for (const gs of snapshot.gemSteps) {
    if (gs.manualCompleted || gs.verifiedByApi || gs.softAcquired) {
      completedGems++;
    }
  }

  return {
    completedCheckpoints,
    totalCheckpoints: snapshot.checkpoints.length,
    completedGems,
    totalGems: snapshot.gemSteps.length,
    hasAnyProgress: completedCheckpoints > 0 || softCheckpoints > 0 || completedGems > 0,
  };
}
