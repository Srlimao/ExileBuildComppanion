import type { GameAdapter } from "@exile-hud/game-data";
import { sortTreeSpecsByLevel } from "../character_telemetry_diff/passive_tree_bracket_differ.js";
import type { PassiveTreeSpecSummary } from "../protocol/session_room_wire_protocol.js";
import {
  bfsDistancesFromStart,
  buildClusterAdjacency,
  isAscendancyMilestoneNode,
  resolveAscendancyCluster,
  type ResolvedAscendancyCluster,
} from "./ascendancy_cluster_resolver.js";

export { isAscendancyMilestoneNode, resolveAscendancyCluster, type ResolvedAscendancyCluster };

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
}

function createEmptyPlan(
  cluster: ResolvedAscendancyCluster | null,
  allocatedAscendancyNodeIds: string[],
  allocatedPoints: number,
  plannedNodeIds: string[] = [],
  plannedPoints = 0,
  finalSpecTitle: string | null = null,
): AscendancyProgressionPlan {
  return {
    clusterKey: cluster?.clusterKey ?? null,
    displayName: cluster?.displayName ?? null,
    startNodeId: cluster?.startNode?.id ?? null,
    steps: [],
    plannedNodeIds,
    allocatedAscendancyNodeIds,
    allocatedPoints,
    plannedPoints,
    orderSource: "none",
    finalSpecTitle,
  };
}

/** Computes a read-only Ascendancy node plan and acquisition order for Lab mode. */
export function buildAscendancyProgressionPlan(params: {
  characterClass?: string;
  ascendancyName?: string | null;
  specs?: readonly PassiveTreeSpecSummary[];
  allocatedNodeIds?: readonly string[];
  ascendancyNoteOrderIds?: readonly string[];
  adapter: GameAdapter;
}): AscendancyProgressionPlan {
  const { ascendancyName, specs = [], allocatedNodeIds = [], ascendancyNoteOrderIds = [], adapter } = params;
  const cluster = resolveAscendancyCluster({ ascendancyName, specs, allocatedNodeIds, adapter });
  if (!cluster) return createEmptyPlan(null, [], 0);

  const allocatedSet = new Set(allocatedNodeIds);
  const allocatedAscendancyNodeIds: string[] = [];
  let allocatedPoints = 0;
  for (const id of allocatedSet) {
    const node = cluster.clusterNodeMap.get(id);
    if (!node) continue;
    allocatedAscendancyNodeIds.push(id);
    if (!node.isAscendancyStart) allocatedPoints += 1;
  }

  const ascBearingSpecs = sortTreeSpecsByLevel([...specs])
    .map((spec, idx) => {
      const uniqueClusterIds: string[] = [];
      const seen = new Set<string>();
      let nonStartCount = 0;
      let milestoneCount = 0;
      for (const id of spec.nodeIds) {
        if (seen.has(id)) continue;
        const node = cluster.clusterNodeMap.get(id);
        if (!node) continue;
        seen.add(id);
        uniqueClusterIds.push(id);
        if (!node.isAscendancyStart) nonStartCount += 1;
        if (isAscendancyMilestoneNode(node, cluster.clusterKey)) milestoneCount += 1;
      }
      return { spec, idx, uniqueClusterIds, nonStartCount, milestoneCount };
    })
    .filter((entry) => entry.nonStartCount > 0)
    .sort((a, b) => a.spec.minLevel - b.spec.minLevel || a.nonStartCount - b.nonStartCount || a.idx - b.idx);

  const finalSpecEntry = ascBearingSpecs.reduce<(typeof ascBearingSpecs)[number] | null>((best, cur) => {
    if (!best) return cur;
    if (cur.milestoneCount !== best.milestoneCount) return cur.milestoneCount > best.milestoneCount ? cur : best;
    if (cur.nonStartCount !== best.nonStartCount) return cur.nonStartCount > best.nonStartCount ? cur : best;
    return cur.spec.minLevel >= best.spec.minLevel ? cur : best;
  }, null);
  if (!finalSpecEntry) return createEmptyPlan(cluster, allocatedAscendancyNodeIds, allocatedPoints);

  const plannedNodeIds = [...finalSpecEntry.uniqueClusterIds];
  if (cluster.startNode && !plannedNodeIds.includes(cluster.startNode.id)) {
    plannedNodeIds.unshift(cluster.startNode.id);
  }
  const plannedPoints = plannedNodeIds.filter((id) => !cluster.clusterNodeMap.get(id)?.isAscendancyStart).length;
  const targetMilestones = plannedNodeIds.filter((id) => {
    const node = cluster.clusterNodeMap.get(id);
    return Boolean(node && isAscendancyMilestoneNode(node, cluster.clusterKey));
  });
  if (targetMilestones.length === 0) {
    return createEmptyPlan(
      cluster,
      allocatedAscendancyNodeIds,
      allocatedPoints,
      plannedNodeIds,
      plannedPoints,
      finalSpecEntry.spec.title,
    );
  }

  const firstSpecStage = new Map<string, number>();
  const firstSpecTitle = new Map<string, string>();
  for (const milestoneId of targetMilestones) {
    const stageIdx = ascBearingSpecs.findIndex((entry) => entry.uniqueClusterIds.includes(milestoneId));
    if (stageIdx >= 0) {
      firstSpecStage.set(milestoneId, stageIdx);
      firstSpecTitle.set(milestoneId, ascBearingSpecs[stageIdx]!.spec.title);
    }
  }

  const adj = buildClusterAdjacency(cluster.clusterNodeMap);
  const startId = cluster.startNode?.id ?? null;
  const plannedSet = new Set(plannedNodeIds);
  const fullClusterSet = new Set(cluster.clusterNodeMap.keys());
  const plannedDist = bfsDistancesFromStart(startId, plannedSet, adj);
  const allPlannedReachable = targetMilestones.every((id) => plannedDist.has(id));
  const reachSet = allPlannedReachable ? plannedSet : fullClusterSet;
  const distanceFromStart = allPlannedReachable
    ? plannedDist
    : bfsDistancesFromStart(startId, fullClusterSet, adj);

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
  ascendancyNoteOrderIds.forEach((id, idx) => {
    if (!noteOrderIndex.has(id)) noteOrderIndex.set(id, idx);
  });
  const finalSpecIndex = new Map<string, number>();
  finalSpecEntry.spec.nodeIds.forEach((id, idx) => {
    if (!finalSpecIndex.has(id)) finalSpecIndex.set(id, idx);
  });

  const inDegree = new Map<string, number>(targetMilestones.map((id) => [id, prerequisites.get(id)!.length]));
  const remaining = new Set(targetMilestones);
  const orderedIds: string[] = [];

  while (remaining.size > 0) {
    const unlocked = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    const pool = unlocked.length > 0 ? unlocked : [...remaining];
    pool.sort(
      (a, b) =>
        (firstSpecStage.get(a) ?? Number.POSITIVE_INFINITY) -
          (firstSpecStage.get(b) ?? Number.POSITIVE_INFINITY) ||
        (noteOrderIndex.get(a) ?? Number.POSITIVE_INFINITY) -
          (noteOrderIndex.get(b) ?? Number.POSITIVE_INFINITY) ||
        (distanceFromStart.get(a) ?? Number.POSITIVE_INFINITY) -
          (distanceFromStart.get(b) ?? Number.POSITIVE_INFINITY) ||
        (finalSpecIndex.get(a) ?? Number.POSITIVE_INFINITY) -
          (finalSpecIndex.get(b) ?? Number.POSITIVE_INFINITY) ||
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
    distinctSpecStages.size >= 2
      ? "multi_spec"
      : matchedNoteCount >= 2
        ? "pob_notes"
        : "tree_path";

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
      sourceSpecTitle: firstSpecTitle.get(id) ?? finalSpecEntry.spec.title,
      allocated,
      isNext,
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
    finalSpecTitle: finalSpecEntry.spec.title,
  };
}
