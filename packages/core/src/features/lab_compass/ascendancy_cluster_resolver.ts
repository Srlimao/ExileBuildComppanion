import type { GameAdapter, PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import type { PassiveTreeSpecSummary } from "../protocol/session_room_wire_protocol.js";

export interface ResolvedAscendancyCluster {
  clusterKey: string;
  displayName: string;
  startNode: PassiveTreeNodeMetadata | null;
  clusterNodes: PassiveTreeNodeMetadata[];
  clusterNodeMap: Map<string, PassiveTreeNodeMetadata>;
}

const ATTRIBUTE_ONLY_NODE_RE =
  /^(Strength|Dexterity|Intelligence)(\s+and\s+(Strength|Dexterity|Intelligence))?$/i;

/** Indexes all Ascendancy clusters in the passive tree by internal `ascendancyName`. */
export function buildAscendancyClusterIndex(
  adapter: GameAdapter,
): Map<string, ResolvedAscendancyCluster> {
  const allNodes = adapter.getPassiveTreeNodes();
  const grouped = new Map<string, PassiveTreeNodeMetadata[]>();

  for (const node of Object.values(allNodes)) {
    if (!node.ascendancyName) continue;
    const bucket = grouped.get(node.ascendancyName);
    if (bucket) bucket.push(node);
    else grouped.set(node.ascendancyName, [node]);
  }

  const index = new Map<string, ResolvedAscendancyCluster>();
  for (const [clusterKey, clusterNodes] of grouped) {
    const startNode = clusterNodes.find((n) => n.isAscendancyStart) ?? null;
    index.set(clusterKey, {
      clusterKey,
      displayName: startNode?.name || clusterKey,
      startNode,
      clusterNodes,
      clusterNodeMap: new Map(clusterNodes.map((n) => [n.id, n])),
    });
  }
  return index;
}

/** Detects the dominant Ascendancy cluster referenced by a spec's non-start nodes. */
export function detectSpecAscendancyClusterKey(
  nodeIds: readonly string[],
  allNodes: Record<string, PassiveTreeNodeMetadata>,
): string | null {
  const scores = new Map<string, number>();
  const nonStartCounts = new Map<string, number>();
  const seen = new Set<string>();

  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const node = allNodes[id];
    const ascKey = node?.ascendancyName;
    if (!ascKey) continue;
    const weight = node.isAscendancyStart ? 1 : 10;
    scores.set(ascKey, (scores.get(ascKey) ?? 0) + weight);
    if (!node.isAscendancyStart) {
      nonStartCounts.set(ascKey, (nonStartCounts.get(ascKey) ?? 0) + 1);
    }
  }

  let bestKey: string | null = null;
  let bestScore = 0;
  for (const [ascKey, score] of scores) {
    if ((nonStartCounts.get(ascKey) ?? 0) < 1) continue;
    if (score > bestScore) {
      bestScore = score;
      bestKey = ascKey;
    }
  }
  return bestKey;
}

/** Resolves the GGG passive tree Ascendancy cluster and display name (e.g. Warden -> Raider cluster). */
export function resolveAscendancyCluster(params: {
  ascendancyName?: string | null;
  specs?: readonly Pick<PassiveTreeSpecSummary, "nodeIds">[];
  allocatedNodeIds?: readonly string[];
  adapter: GameAdapter;
}): ResolvedAscendancyCluster | null {
  const { ascendancyName, specs = [], allocatedNodeIds = [], adapter } = params;
  const clusterIndex = buildAscendancyClusterIndex(adapter);
  if (clusterIndex.size === 0) return null;

  const trimmed = String(ascendancyName ?? "").trim();
  if (trimmed && trimmed.toLowerCase() !== "none") {
    const targetLower = trimmed.toLowerCase();
    for (const cluster of clusterIndex.values()) {
      if (
        cluster.clusterKey.toLowerCase() === targetLower ||
        cluster.startNode?.name.toLowerCase() === targetLower
      ) {
        return cluster;
      }
    }
  }

  const allNodes = adapter.getPassiveTreeNodes();
  const scores = new Map<string, number>();
  const addVote = (id: string, weight: number) => {
    const node = allNodes[id];
    if (!node?.ascendancyName) return;
    scores.set(node.ascendancyName, (scores.get(node.ascendancyName) ?? 0) + weight);
  };
  for (const spec of specs) {
    for (const id of spec.nodeIds) addVote(id, allNodes[id]?.isAscendancyStart ? 1 : 10);
  }
  for (const id of allocatedNodeIds) addVote(id, allNodes[id]?.isAscendancyStart ? 1 : 10);

  let bestKey: string | null = null;
  let bestScore = 0;
  for (const [clusterKey, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestKey = clusterKey;
    }
  }
  return bestKey ? clusterIndex.get(bestKey) ?? null : null;
}

/** Returns true for major Ascendancy milestone nodes shown in the Lab order list. */
export function isAscendancyMilestoneNode(
  node: PassiveTreeNodeMetadata,
  clusterKey: string,
): boolean {
  if (node.isAscendancyStart) return false;
  if (clusterKey === "Ascendant") {
    if (node.isNotable) return node.stats.length > 0;
    return node.name !== "Passive Point" && !ATTRIBUTE_ONLY_NODE_RE.test(node.name);
  }
  if (clusterKey === "Reliquarian") {
    if (node.isNotable && node.stats.length === 0) return false;
    return node.name !== "Passive Point";
  }
  return Boolean(node.isNotable);
}

/** Builds an undirected adjacency map restricted to nodes inside one Ascendancy cluster. */
export function buildClusterAdjacency(
  clusterNodeMap: Map<string, PassiveTreeNodeMetadata>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const node of clusterNodeMap.values()) {
    for (const nbrId of node.out ?? []) {
      if (!clusterNodeMap.has(nbrId)) continue;
      link(node.id, nbrId);
      link(nbrId, node.id);
    }
  }
  return adj;
}

/** Computes shortest hop distances from the Ascendancy start node within `allowedIds`. */
export function bfsDistancesFromStart(
  startId: string | null,
  allowedIds: ReadonlySet<string>,
  adj: Map<string, string[]>,
  blockedId?: string,
): Map<string, number> {
  const dist = new Map<string, number>();
  if (!startId || !allowedIds.has(startId) || startId === blockedId) return dist;
  dist.set(startId, 0);
  const queue: string[] = [startId];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const nextDist = dist.get(cur)! + 1;
    for (const nbr of adj.get(cur) ?? []) {
      if (nbr === blockedId || !allowedIds.has(nbr) || dist.has(nbr)) continue;
      dist.set(nbr, nextDist);
      queue.push(nbr);
    }
  }
  return dist;
}

/** Collects allocated node IDs and non-start point count inside one Ascendancy cluster. */
export function collectClusterAllocation(
  allocatedSet: ReadonlySet<string>,
  cluster: ResolvedAscendancyCluster,
): { allocatedAscendancyNodeIds: string[]; allocatedPoints: number } {
  const allocatedAscendancyNodeIds: string[] = [];
  let allocatedPoints = 0;
  for (const id of allocatedSet) {
    const node = cluster.clusterNodeMap.get(id);
    if (!node) continue;
    allocatedAscendancyNodeIds.push(id);
    if (!node.isAscendancyStart) allocatedPoints += 1;
  }
  return { allocatedAscendancyNodeIds, allocatedPoints };
}

/** Returns the display name of another Ascendancy if non-start points are currently allocated there. */
export function detectOtherAllocatedAscendancy(
  allocatedSet: ReadonlySet<string>,
  activeClusterKey: string,
  allNodes: Record<string, PassiveTreeNodeMetadata>,
  clusterIndex: Map<string, ResolvedAscendancyCluster>,
): string | null {
  const counts = new Map<string, number>();
  for (const id of allocatedSet) {
    const node = allNodes[id];
    if (!node?.ascendancyName || node.isAscendancyStart || node.ascendancyName === activeClusterKey) continue;
    counts.set(node.ascendancyName, (counts.get(node.ascendancyName) ?? 0) + 1);
  }
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  return bestKey ? (clusterIndex.get(bestKey)?.displayName ?? bestKey) : null;
}
