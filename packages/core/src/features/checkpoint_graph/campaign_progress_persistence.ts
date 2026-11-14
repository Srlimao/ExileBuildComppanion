import type { CheckpointStepItem, HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { computeNextTownCurrencyBudget } from "../route_compiler/gem_quest_and_vendor_assigner.js";
import { buildVendorSearchRegex } from "../vendor_regex/vendor_search_regex_builder.js";

export interface SavedCampaignProgress {
  completedCheckpointIds: string[];
  softCompletedCheckpointIds: string[];
  manualCompletedGemIds: string[];
  softAcquiredGemIds: string[];
  visitedAreaIds?: string[];
  clearedAreaIds?: string[];
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

  const visitedAreaIds = [...(snapshot.visitedAreaIds ?? [])];
  const clearedAreaIds = [...(snapshot.clearedAreaIds ?? [])];
  return {
    completedCheckpointIds,
    softCompletedCheckpointIds,
    manualCompletedGemIds,
    softAcquiredGemIds,
    ...(visitedAreaIds.length > 0 ? { visitedAreaIds } : {}),
    ...(clearedAreaIds.length > 0 ? { clearedAreaIds } : {}),
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
    visitedAreaIds: [],
    clearedAreaIds: [],
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

/** Normalizes pre-quest-name saved checkpoint keys so legacy turn-in completions stay checked. */
function extractLegacyQuestKeySet(rawKeys: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of rawKeys) {
    const parts = raw.split("|");
    if (parts.length < 5 || !parts[3]) continue;
    const rest = parts.slice(4).join("|");
    if (!rest.includes(`Turn in quest (${parts[3]})`)) continue;
    const occMatch = /#(\d+)$/.exec(rest);
    if (occMatch?.[1]) {
      set.add(`${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}#${occMatch[1]}`);
    }
  }
  return set;
}

/** Merges saved progress onto a freshly compiled or bootstrapped snapshot (or honors explicit reset). */
function toCategoryAgnosticSemanticKey(key: string): string | null {
  const p1 = key.indexOf("|");
  const p2 = p1 === -1 ? -1 : key.indexOf("|", p1 + 1);
  const p3 = p2 === -1 ? -1 : key.indexOf("|", p2 + 1);
  const p4 = p3 === -1 ? -1 : key.indexOf("|", p3 + 1);
  if (p1 === -1 || p2 === -1 || p3 === -1 || p4 === -1) return null;
  return `${key.slice(0, p2)}|${key.slice(p3 + 1)}`;
}

function extractCategoryAgnosticKeySet(keys: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys) {
    const semantic = toCategoryAgnosticSemanticKey(key);
    if (semantic) out.add(semantic);
  }
  return out;
}

export function applySavedCampaignProgress(
  snapshot: HudSessionSnapshot,
  saved: SavedCampaignProgress | null | undefined,
): HudSessionSnapshot {
  if (!saved) return snapshot;

  const hasTrackedAreas =
    (saved.visitedAreaIds?.length ?? 0) > 0 || (saved.clearedAreaIds?.length ?? 0) > 0;
  const isEmptyReset =
    saved.wasExplicitlyReset &&
    saved.completedCheckpointIds.length === 0 &&
    saved.softCompletedCheckpointIds.length === 0 &&
    saved.manualCompletedGemIds.length === 0 &&
    saved.softAcquiredGemIds.length === 0 &&
    !hasTrackedAreas;

  if (isEmptyReset) {
    return {
      ...resetSnapshotProgress(snapshot),
      version: snapshot.version,
    };
  }

  const completedSet = new Set(saved.completedCheckpointIds);
  const softSet = new Set(saved.softCompletedCheckpointIds);
  const legacyCompletedQuestSet = extractLegacyQuestKeySet(saved.completedCheckpointIds);
  const legacySoftQuestSet = extractLegacyQuestKeySet(saved.softCompletedCheckpointIds);
  const semanticCompletedSet = extractCategoryAgnosticKeySet(saved.completedCheckpointIds);
  const semanticSoftSet = extractCategoryAgnosticKeySet(saved.softCompletedCheckpointIds);
  const manualGemSet = new Set(saved.manualCompletedGemIds);
  const softGemSet = new Set(saved.softAcquiredGemIds);
  const keys = computeCheckpointProgressKeys(snapshot.checkpoints);
  const questCounts = new Map<string, number>();
  const semanticCounts = new Map<string, number>();

  const checkpoints = snapshot.checkpoints.map((cp, idx) => {
    const key = keys[idx]!;
    let legacyQuestKey: string | null = null;
    if (cp.questId) {
      const qBase = `${cp.sectionAct}|${cp.areaId}|${cp.category}|${cp.questId}`;
      const qOcc = (questCounts.get(qBase) ?? 0) + 1;
      questCounts.set(qBase, qOcc);
      legacyQuestKey = `${qBase}#${qOcc}`;
    }
    const semBase = `${cp.sectionAct}|${cp.areaId}|${cp.questId ?? ""}|${cp.title}`;
    const semOcc = (semanticCounts.get(semBase) ?? 0) + 1;
    semanticCounts.set(semBase, semOcc);
    const semanticKey = `${semBase}#${semOcc}`;

    const completed =
      cp.completed ||
      completedSet.has(key) ||
      completedSet.has(cp.id) ||
      semanticCompletedSet.has(semanticKey) ||
      (legacyQuestKey !== null && legacyCompletedQuestSet.has(legacyQuestKey));
    const softCompleted =
      !completed &&
      (cp.softCompleted ||
        softSet.has(key) ||
        softSet.has(cp.id) ||
        semanticSoftSet.has(semanticKey) ||
        (legacyQuestKey !== null && legacySoftQuestSet.has(legacyQuestKey)));
    return { ...cp, completed, softCompleted };
  });

  const visitedSet = new Set<string>(
    hasTrackedAreas ? saved.visitedAreaIds ?? [] : snapshot.visitedAreaIds ?? [],
  );
  const clearedSet = new Set<string>(
    hasTrackedAreas ? saved.clearedAreaIds ?? [] : snapshot.clearedAreaIds ?? [],
  );
  if (!hasTrackedAreas && !saved.wasExplicitlyReset) {
    for (const cp of checkpoints) {
      if (!cp.completed) continue;
      visitedSet.add(cp.areaId);
      if (cp.stepKind !== "quest_turn_in" && !/_town$|hideout|Labyrinth_Airlock/i.test(cp.areaId)) {
        clearedSet.add(cp.areaId);
      }
    }
  }
  for (const clearedAreaId of clearedSet) {
    visitedSet.add(clearedAreaId);
  }

  const gemSteps = snapshot.gemSteps.map((gs) => {
    const manualCompleted = gs.manualCompleted || manualGemSet.has(gs.id);
    const softAcquired = !manualCompleted && (gs.softAcquired || softGemSet.has(gs.id));
    return { ...gs, manualCompleted, softAcquired };
  });

  const currentAct = snapshot.highestUnlockedAct;
  return {
    ...snapshot,
    visitedAreaIds: [...visitedSet],
    clearedAreaIds: [...clearedSet],
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
