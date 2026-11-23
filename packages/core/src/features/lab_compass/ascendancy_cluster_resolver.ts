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

/** Resolves the GGG passive tree Ascendancy cluster and display name (e.g. Warden -> Raider cluster). */
export function resolveAscendancyCluster(params: {
  ascendancyName?: string | null;
  specs?: readonly Pick<PassiveTreeSpecSummary, "nodeIds">[];
  allocatedNodeIds?: readonly string[];
  adapter: GameAdapter;
}): ResolvedAscendancyCluster | null {
  const { ascendancyName, specs = [], allocatedNodeIds = [], adapter } = params;
  const allNodes = adapter.getPassiveTreeNodes();
  const byCluster = new Map<string, PassiveTreeNodeMetadata[]>();

  for (const node of Object.values(allNodes)) {
    if (!node.ascendancyName) continue;
    const bucket = byCluster.get(node.ascendancyName);
    if (bucket) bucket.push(node);
    else byCluster.set(node.ascendancyName, [node]);
  }
  if (byCluster.size === 0) return null;

  const buildCluster = (
    clusterKey: string,
    clusterNodes: PassiveTreeNodeMetadata[],
  ): ResolvedAscendancyCluster => {
    const startNode = clusterNodes.find((n) => n.isAscendancyStart) ?? null;
    return {
      clusterKey,
      displayName: startNode?.name || clusterKey,
      startNode,
      clusterNodes,
      clusterNodeMap: new Map(clusterNodes.map((n) => [n.id, n])),
    };
  };

  const trimmed = String(ascendancyName ?? "").trim();
  if (trimmed && trimmed.toLowerCase() !== "none") {
    const targetLower = trimmed.toLowerCase();
    for (const [clusterKey, clusterNodes] of byCluster) {
      const startNode = clusterNodes.find((n) => n.isAscendancyStart) ?? null;
      if (
        clusterKey.toLowerCase() === targetLower ||
        startNode?.name.toLowerCase() === targetLower
      ) {
        return buildCluster(clusterKey, clusterNodes);
      }
    }
  }

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
  if (!bestKey) return null;
  const clusterNodes = byCluster.get(bestKey);
  return clusterNodes ? buildCluster(bestKey, clusterNodes) : null;
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
