import type { GameAdapter, LabTrialMeta } from "@exile-hud/game-data";
import type {
  CheckpointStepItem,
  HudSessionSnapshot,
  LabTelemetry,
} from "../protocol/session_room_wire_protocol.js";

export type LabyrinthTier = 0 | 1 | 2 | 3 | 4;

const LAB_BOSS_AREA_BY_TIER = [
  "1_Labyrinth_boss_3",
  "2_Labyrinth_boss_3",
  "3_Labyrinth_boss_3",
  "EndGame_Labyrinth_boss_3",
] as const;

const DIFFICULTY_LABEL_BY_TIER: Readonly<Record<Exclude<LabyrinthTier, 0>, string>> = {
  1: "Normal Labyrinth",
  2: "Cruel Labyrinth",
  3: "Merciless Labyrinth",
  4: "Eternal Labyrinth",
};

const TRIAL_TIER_BY_DIFFICULTY: Readonly<Record<LabTrialMeta["difficulty"], LabyrinthTier>> = {
  normal: 1,
  cruel: 2,
  merciless: 3,
  eternal: 4,
};

function getClearedLabBossTier(clearedSet: ReadonlySet<string>): LabyrinthTier {
  if (clearedSet.has("EndGame_Labyrinth_boss_3")) return 4;
  if (clearedSet.has("3_Labyrinth_boss_3")) return 3;
  if (clearedSet.has("2_Labyrinth_boss_3")) return 2;
  if (clearedSet.has("1_Labyrinth_boss_3")) return 1;
  return 0;
}

function normalizeQuestName(name: string): string {
  return name.replace(/[\u2018\u2019]/g, "'").trim().replace(/\.$/, "").toLowerCase();
}

/** Detects interior Labyrinth tier (`1..4`) from an area ID, excluding Plaza (`Labyrinth_Airlock`) and map trials. */
export function detectEnteredLabyrinthTier(areaId: string): LabyrinthTier {
  if (/^1_Labyrinth_/i.test(areaId)) return 1;
  if (/^2_Labyrinth_/i.test(areaId)) return 2;
  if (/^3_Labyrinth_/i.test(areaId)) return 3;
  if (/^EndGame_Labyrinth_(?!trials)/i.test(areaId)) return 4;
  return 0;
}

/** Returns the maximum campaign act whose `{trial}` steps are proven complete upon entering `tier`. */
export function getMaxTrialActForLabyrinthTier(tier: LabyrinthTier): number {
  if (tier === 0) return 0;
  if (tier === 1) return 3;
  if (tier === 2) return 7;
  return 10;
}

/** Returns boss room area IDs of strictly earlier Labyrinth tiers implied cleared upon entering `enteredTier`. */
export function getImpliedPriorLabBossAreaIds(enteredTier: LabyrinthTier): string[] {
  return enteredTier >= 2 ? [...LAB_BOSS_AREA_BY_TIER.slice(0, enteredTier - 1)] : [];
}

/** Returns true when a campaign trial checkpoint belongs to an act unlocked by `maxTrialAct`. */
export function isLabTrialCheckpointAutoCompleted(cp: CheckpointStepItem, maxTrialAct: number): boolean {
  return maxTrialAct > 0 && cp.category === "LAB_TRIAL" && cp.stepKind !== "ascend" && cp.sectionAct <= maxTrialAct;
}

/** Keeps `lab.completedTrialAreaIds` and `lab.difficultyLabel` synced with entered Labs and trial checkpoints. */
export function syncLabTelemetryWithProgress(params: {
  lab: LabTelemetry;
  checkpoints: readonly CheckpointStepItem[];
  clearedAreaIds: readonly string[];
  enteredAreaId: string;
  adapter: GameAdapter;
}): LabTelemetry {
  const { lab, checkpoints, clearedAreaIds, enteredAreaId, adapter } = params;
  const enteredTier = detectEnteredLabyrinthTier(enteredAreaId);
  const clearedSet = new Set(clearedAreaIds);
  const unlockedTier = Math.max(enteredTier, getClearedLabBossTier(clearedSet)) as LabyrinthTier;

  const incompleteRouteTrialAreas = new Set<string>();
  const completedRouteTrialAreas = new Set<string>();
  for (const cp of checkpoints) {
    if (cp.category !== "LAB_TRIAL" || cp.stepKind === "ascend") continue;
    if (cp.completed) completedRouteTrialAreas.add(cp.areaId);
    else incompleteRouteTrialAreas.add(cp.areaId);
  }

  const nextTrialSet = new Set<string>();
  for (const existingId of lab.completedTrialAreaIds) {
    if (!incompleteRouteTrialAreas.has(existingId) || completedRouteTrialAreas.has(existingId)) {
      nextTrialSet.add(existingId);
    }
  }
  for (const areaId of completedRouteTrialAreas) nextTrialSet.add(areaId);
  for (const trial of adapter.getLabTrials()) {
    if (TRIAL_TIER_BY_DIFFICULTY[trial.difficulty] <= unlockedTier) {
      nextTrialSet.add(trial.areaId);
    }
  }

  const completedTrialAreaIds = [...nextTrialSet];
  const difficultyLabel =
    !lab.hasDailyLayout && enteredTier !== 0 ? DIFFICULTY_LABEL_BY_TIER[enteredTier] : lab.difficultyLabel;

  const trialsUnchanged =
    completedTrialAreaIds.length === lab.completedTrialAreaIds.length &&
    completedTrialAreaIds.every((id, idx) => id === lab.completedTrialAreaIds[idx]);
  if (trialsUnchanged && difficultyLabel === lab.difficultyLabel) return lab;

  return { ...lab, difficultyLabel, completedTrialAreaIds };
}

/** Clears completion on campaign `SKILL_BOOK` checkpoints (`sectionAct <= 10`) before `/passives` quest lines apply. */
export function resetCampaignSkillBookCheckpoints(state: HudSessionSnapshot): HudSessionSnapshot {
  let changed = false;
  const checkpoints = state.checkpoints.map((cp) => {
    if (cp.category !== "SKILL_BOOK" || cp.sectionAct > 10) return cp;
    if (!cp.completed && !cp.softCompleted) return cp;
    changed = true;
    return { ...cp, completed: false, softCompleted: false };
  });
  return changed ? { ...state, version: state.version + 1, checkpoints } : state;
}

/** Reconciles `/passives` chat output (`N from <Quest>` or `(N from <Quest>)`) against campaign `SKILL_BOOK` checkpoints. */
export function reconcilePassiveQuestChatLine(
  state: HudSessionSnapshot,
  points: number,
  rawQuestName: string,
  adapter: GameAdapter,
): HudSessionSnapshot {
  const targetName = normalizeQuestName(rawQuestName);
  if (!targetName) return state;

  const skillBookIds = adapter.getSkillBookQuestIds();
  const matchedIds = new Set<string>();
  for (const quest of Object.values(adapter.getQuests())) {
    const isSkillQuest = skillBookIds.has(quest.id) || quest.id === "a2q11" || quest.id === "a10q3a11";
    if (isSkillQuest && normalizeQuestName(quest.name) === targetName) {
      matchedIds.add(quest.id);
    }
  }
  if (matchedIds.size === 0) return state;

  const nextCompleted = points > 0;
  let changed = false;
  const checkpoints = state.checkpoints.map((cp) => {
    if (cp.category !== "SKILL_BOOK" || !cp.questId || !matchedIds.has(cp.questId)) return cp;
    if (cp.completed === nextCompleted && cp.softCompleted === false) return cp;
    changed = true;
    return { ...cp, completed: nextCompleted, softCompleted: false };
  });

  return changed ? { ...state, version: state.version + 1, checkpoints } : state;
}

/** Marks implied Labyrinth tiers, trials, and ascend steps complete from an Ascendancy point total. */
export function reconcileAscendancyProgressFromPoints(
  state: HudSessionSnapshot,
  ascendancyPoints: number,
  adapter: GameAdapter,
): HudSessionSnapshot {
  const completedTier = Math.min(4, Math.floor(Math.max(0, ascendancyPoints) / 2)) as LabyrinthTier;
  if (completedTier === 0) return state;

  const visitedSet = new Set(state.visitedAreaIds ?? []);
  const clearedSet = new Set(state.clearedAreaIds ?? []);
  let areasChanged = false;
  for (const bossId of LAB_BOSS_AREA_BY_TIER.slice(0, completedTier)) {
    if (!visitedSet.has(bossId)) {
      visitedSet.add(bossId);
      areasChanged = true;
    }
    if (!clearedSet.has(bossId)) {
      clearedSet.add(bossId);
      areasChanged = true;
    }
  }

  const maxTrialAct = getMaxTrialActForLabyrinthTier(completedTier);
  let checkpointsChanged = false;
  const checkpoints = state.checkpoints.map((cp) => {
    if (cp.completed) return cp;
    const trialDone = isLabTrialCheckpointAutoCompleted(cp, maxTrialAct);
    const ascendDone =
      cp.stepKind === "ascend" &&
      (cp.prerequisiteAreaIds?.length ?? 0) > 0 &&
      cp.prerequisiteAreaIds!.every((id) => clearedSet.has(id));
    if (!trialDone && !ascendDone) return cp;
    checkpointsChanged = true;
    return { ...cp, completed: true, softCompleted: false };
  });

  const nextCleared = [...clearedSet];
  const nextLab = syncLabTelemetryWithProgress({
    lab: state.lab,
    checkpoints,
    clearedAreaIds: nextCleared,
    enteredAreaId: state.currentAreaId,
    adapter,
  });

  if (!areasChanged && !checkpointsChanged && nextLab === state.lab) return state;
  return {
    ...state,
    version: state.version + 1,
    ...(areasChanged ? { visitedAreaIds: [...visitedSet], clearedAreaIds: nextCleared } : {}),
    ...(checkpointsChanged ? { checkpoints } : {}),
    lab: nextLab,
  };
}

/** Marks implied Labyrinth tiers and campaign trials complete based on allocated Ascendancy nodes. */
export function reconcileAscendancyProgressFromPassives(
  state: HudSessionSnapshot,
  allocatedHashes: readonly number[],
  adapter: GameAdapter,
): HudSessionSnapshot {
  if (allocatedHashes.length === 0) return state;
  const nodes = adapter.getPassiveTreeNodes();
  let ascendancyPoints = 0;
  for (const hash of allocatedHashes) {
    const node = nodes[String(hash)];
    if (node?.ascendancyName && !node.isAscendancyStart) ascendancyPoints += 1;
  }
  return reconcileAscendancyProgressFromPoints(state, ascendancyPoints, adapter);
}
