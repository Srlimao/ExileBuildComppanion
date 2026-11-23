import type { GameAdapter } from "@exile-hud/game-data";
import { sortTreeSpecsByLevel } from "../character_telemetry_diff/passive_tree_bracket_differ.js";
import type { PassiveTreeSpecSummary } from "../protocol/session_room_wire_protocol.js";
import {
  bfsDistancesFromStart,
  buildAscendancyClusterIndex,
  buildClusterAdjacency,
  collectClusterAllocation,
  detectOtherAllocatedAscendancy,
  isAscendancyMilestoneNode,
  resolveAscendancyCluster,
  type ResolvedAscendancyCluster,
} from "./ascendancy_cluster_resolver.js";
import {
  partitionSpecsIntoAscendancyPhases,
  selectActiveAscendancyPhaseIndex,
  type AscendancyPhaseSummary,
} from "./ascendancy_phase_partitioner.js";

export {
  isAscendancyMilestoneNode,
  resolveAscendancyCluster,
  type AscendancyPhaseSummary,
  type ResolvedAscendancyCluster,
};

export type AscendancyOrderSource = "multi_spec" | "pob_notes" | "tree_path" | "none";

export interface AscendancyOrderStep {
  order: number;
  nodeId: string;
  name: string;
  stats: string[];
  labTier: 1 | 2 | 3 | 4 | null;
  sourceSpecTitle: string | null;
  allocated: boolean;
  isNext: boolean;
  respecLater: boolean;
  prerequisiteNodeIds: string[];
}

export interface AscendancyProgressionPlan {
  clusterKey: string | null;
  displayName: string | null;
  startNodeId: string | null;
  steps: AscendancyOrderStep[];
  plannedNodeIds: string[];
  allocatedAscendancyNodeIds: string[];
  allocatedPoints: number;
  plannedPoints: number;
  orderSource: AscendancyOrderSource;
  finalSpecTitle: string | null;
  phases: AscendancyPhaseSummary[];
  activePhaseId: string | null;
  activePhaseIndex: number;
  respecSteps: Array<{ nodeId: string; name: string }>;
  allocatedOtherAscendancyName: string | null;
}

function createEmptyPlan(
  cluster: ResolvedAscendancyCluster | null,
  allocatedAscendancyNodeIds: string[],
  allocatedPoints: number,
  extra: Partial<AscendancyProgressionPlan> = {},
): AscendancyProgressionPlan {
  return {
    clusterKey: cluster?.clusterKey ?? null,
    displayName: cluster?.displayName ?? null,
    startNodeId: cluster?.startNode?.id ?? null,
    steps: [],
    plannedNodeIds: [],
    allocatedAscendancyNodeIds,
    allocatedPoints,
    plannedPoints: 0,
    orderSource: "none",
    finalSpecTitle: null,
    phases: [],
    activePhaseId: null,
    activePhaseIndex: -1,
    respecSteps: [],
    allocatedOtherAscendancyName: null,
    ...extra,
  };
}

/** Computes a level-aware read-only Ascendancy node plan and acquisition order for Lab mode. */
export function buildAscendancyProgressionPlan(params: {
  characterClass?: string;
  ascendancyName?: string | null;
  specs?: readonly PassiveTreeSpecSummary[];
  allocatedNodeIds?: readonly string[];
  ascendancyNoteOrderIds?: readonly string[];
  characterLevel?: number;
  activeSpecId?: string | null;
  manualPhaseId?: string | null;
  adapter: GameAdapter;
}): AscendancyProgressionPlan {
  const {
    ascendancyName,
    specs = [],
    allocatedNodeIds = [],
    ascendancyNoteOrderIds = [],
    characterLevel,
    activeSpecId,
    manualPhaseId,
    adapter,
  } = params;

  const allNodes = adapter.getPassiveTreeNodes();
  const clusterIndex = buildAscendancyClusterIndex(adapter);
  const sortedSpecs = sortTreeSpecsByLevel([...specs]);
  const phases = partitionSpecsIntoAscendancyPhases(sortedSpecs, clusterIndex, allNodes);
  const allocatedSet = new Set(allocatedNodeIds);

  if (phases.length === 0) {
    const fallback = resolveAscendancyCluster({ ascendancyName, specs, allocatedNodeIds, adapter });
    if (!fallback) return createEmptyPlan(null, [], 0);
    const { allocatedAscendancyNodeIds, allocatedPoints } = collectClusterAllocation(allocatedSet, fallback);
    return createEmptyPlan(fallback, allocatedAscendancyNodeIds, allocatedPoints);
  }

  const activePhaseIndex = selectActiveAscendancyPhaseIndex({
    phases,
    sortedSpecs,
    characterLevel,
    activeSpecId,
    manualPhaseId,
  });
  const activePhase = phases[activePhaseIndex]!;
  const cluster = clusterIndex.get(activePhase.clusterKey)!;
  const phaseSummaries: AscendancyPhaseSummary[] = phases.map(
    ({ entries: _e, finalEntry: _f, firstSortedIndex: _fs, lastSortedIndex: _ls, specIds: _s, ...rest }) => rest,
  );
  const { allocatedAscendancyNodeIds, allocatedPoints } = collectClusterAllocation(allocatedSet, cluster);
  const allocatedOtherAscendancyName = detectOtherAllocatedAscendancy(
    allocatedSet,
    cluster.clusterKey,
    allNodes,
    clusterIndex,
  );

  const plannedNodeIds = [...activePhase.finalEntry.uniqueClusterIds];
  if (cluster.startNode && !plannedNodeIds.includes(cluster.startNode.id)) {
    plannedNodeIds.unshift(cluster.startNode.id);
  }
  const plannedSet = new Set(plannedNodeIds);
  const plannedPoints = plannedNodeIds.filter((id) => !cluster.clusterNodeMap.get(id)?.isAscendancyStart).length;
  const targetMilestones = plannedNodeIds.filter((id) => {
    const node = cluster.clusterNodeMap.get(id);
    return Boolean(node && isAscendancyMilestoneNode(node, cluster.clusterKey));
  });
  const respecSteps = allocatedAscendancyNodeIds
    .filter((id) => {
      const node = cluster.clusterNodeMap.get(id);
      return Boolean(node && isAscendancyMilestoneNode(node, cluster.clusterKey) && !plannedSet.has(id));
    })
    .map((id) => ({ nodeId: id, name: cluster.clusterNodeMap.get(id)!.name }));

  if (targetMilestones.length === 0) {
    return createEmptyPlan(cluster, allocatedAscendancyNodeIds, allocatedPoints, {
      plannedNodeIds,
      plannedPoints,
      finalSpecTitle: activePhase.finalSpecTitle,
      phases: phaseSummaries,
      activePhaseId: activePhase.id,
      activePhaseIndex,
      respecSteps,
      allocatedOtherAscendancyName,
    });
  }

  const sameClusterEntries = phases
    .slice(0, activePhaseIndex + 1)
    .filter((p) => p.clusterKey === cluster.clusterKey)
    .flatMap((p) => p.entries);
  const firstSpecStage = new Map<string, number>();
  const firstSpecTitle = new Map<string, string>();
  for (const milestoneId of targetMilestones) {
    const stageIdx = sameClusterEntries.findIndex((entry) => entry.uniqueClusterIds.includes(milestoneId));
    if (stageIdx >= 0) {
      firstSpecStage.set(milestoneId, stageIdx);
      firstSpecTitle.set(milestoneId, sameClusterEntries[stageIdx]!.spec.title);
    }
  }

  const adj = buildClusterAdjacency(cluster.clusterNodeMap);
  const startId = cluster.startNode?.id ?? null;
  const fullClusterSet = new Set(cluster.clusterNodeMap.keys());
  const plannedDist = bfsDistancesFromStart(startId, plannedSet, adj);
  const allPlannedReachable = targetMilestones.every((id) => plannedDist.has(id));
  const reachSet = allPlannedReachable ? plannedSet : fullClusterSet;
  const distanceFromStart = allPlannedReachable ? plannedDist : bfsDistancesFromStart(startId, fullClusterSet, adj);

  const prerequisites = new Map<string, string[]>(targetMilestones.map((id) => [id, []]));
  const dependents = new Map<string, string[]>(targetMilestones.map((id) => [id, []]));
  for (const blockerId of targetMilestones) {
    const reachableWithout = bfsDistancesFromStart(startId, reachSet, adj, blockerId);
    for (const candidateId of targetMilestones) {
      if (candidateId !== blockerId && distanceFromStart.has(candidateId) && !reachableWithout.has(candidateId)) {
        prerequisites.get(candidateId)!.push(blockerId);
        dependents.get(blockerId)!.push(candidateId);
      }
    }
  }

  const noteOrderIndex = new Map<string, number>();
  ascendancyNoteOrderIds.forEach((id, idx) => !noteOrderIndex.has(id) && noteOrderIndex.set(id, idx));
  const finalSpecIndex = new Map<string, number>();
  activePhase.finalEntry.spec.nodeIds.forEach((id, idx) => !finalSpecIndex.has(id) && finalSpecIndex.set(id, idx));

  const inDegree = new Map<string, number>(targetMilestones.map((id) => [id, prerequisites.get(id)!.length]));
  const remaining = new Set(targetMilestones);
  const orderedIds: string[] = [];

  while (remaining.size > 0) {
    const unlocked = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    const pool = unlocked.length > 0 ? unlocked : [...remaining];
    pool.sort(
      (a, b) =>
        (firstSpecStage.get(a) ?? Infinity) - (firstSpecStage.get(b) ?? Infinity) ||
        (noteOrderIndex.get(a) ?? Infinity) - (noteOrderIndex.get(b) ?? Infinity) ||
        (distanceFromStart.get(a) ?? Infinity) - (distanceFromStart.get(b) ?? Infinity) ||
        (finalSpecIndex.get(a) ?? Infinity) - (finalSpecIndex.get(b) ?? Infinity) ||
        a.localeCompare(b),
    );
    const chosen = pool[0]!;
    orderedIds.push(chosen);
    remaining.delete(chosen);
    for (const dep of dependents.get(chosen) ?? []) {
      inDegree.set(dep, Math.max(0, (inDegree.get(dep) ?? 0) - 1));
    }
  }

  const distinctSpecStages = new Set(orderedIds.map((id) => firstSpecStage.get(id)));
  const matchedNoteCount = orderedIds.filter((id) => noteOrderIndex.has(id)).length;
  const orderSource: AscendancyOrderSource =
    distinctSpecStages.size >= 2 ? "multi_spec" : matchedNoteCount >= 2 ? "pob_notes" : "tree_path";

  const nextPhase = phases[activePhaseIndex + 1];
  const nextSameClusterMilestones =
    nextPhase && nextPhase.clusterKey === activePhase.clusterKey
      ? new Set(nextPhase.finalEntry.milestoneIds)
      : null;

  const assignLabTier = cluster.clusterKey !== "Ascendant" && cluster.clusterKey !== "Reliquarian";
  let nextAssigned = false;
  const steps: AscendancyOrderStep[] = orderedIds.map((id, idx) => {
    const node = cluster.clusterNodeMap.get(id)!;
    const allocated = allocatedSet.has(id);
    const isNext = !allocated && !nextAssigned;
    if (isNext) nextAssigned = true;
    return {
      order: idx + 1,
      nodeId: id,
      name: node.name,
      stats: node.stats,
      labTier: assignLabTier && idx < 4 ? ((idx + 1) as 1 | 2 | 3 | 4) : null,
      sourceSpecTitle: firstSpecTitle.get(id) ?? activePhase.finalSpecTitle,
      allocated,
      isNext,
      respecLater: Boolean(nextSameClusterMilestones && !nextSameClusterMilestones.has(id)),
      prerequisiteNodeIds: prerequisites.get(id) ?? [],
    };
  });

  return {
    clusterKey: cluster.clusterKey,
    displayName: cluster.displayName,
    startNodeId: startId,
    steps,
    plannedNodeIds,
    allocatedAscendancyNodeIds,
    allocatedPoints,
    plannedPoints,
    orderSource,
    finalSpecTitle: activePhase.finalSpecTitle,
    phases: phaseSummaries,
    activePhaseId: activePhase.id,
    activePhaseIndex,
    respecSteps,
    allocatedOtherAscendancyName,
  };
}
