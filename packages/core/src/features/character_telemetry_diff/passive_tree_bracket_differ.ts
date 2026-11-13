import type { GameAdapter, PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import type {
  PassiveTreeSpecSummary,
  PassiveTreeTelemetry,
} from "../protocol/session_room_wire_protocol.js";

export interface PassiveTreeTargetItem {
  nodeId: string;
  name: string;
  kind: "keystone" | "notable" | "mastery";
  isNewInBracket: boolean;
  stats: string[];
  chosenMasteryStats: string[] | null;
  pathToAllocateIds: string[];
}

export interface PassiveTreeBracketDiff {
  selectedSpec: PassiveTreeSpecSummary | null;
  previousSpec: PassiveTreeSpecSummary | null;
  targetSet: Set<string>;
  allocatedInTargetIds: string[];
  addedInBracketIds: string[];
  unallocatedAddedIds: string[];
  earlierMissedIds: string[];
  respecFromPrevIds: string[];
  offSpecAllocatedIds: string[];
  futureBracketIds: string[];
  nextNotableTargets: PassiveTreeTargetItem[];
}

/** Returns the set of GGG API allocated passive node IDs. */
export function resolveEffectiveAllocatedSet(passiveTree: PassiveTreeTelemetry): Set<string> {
  return new Set<string>(passiveTree.allocatedNodeIds ?? []);
}

/** Returns a stable ascending copy of passive specs sorted by minimum character level. */
export function sortTreeSpecsByLevel(specs: PassiveTreeSpecSummary[]): PassiveTreeSpecSummary[] {
  return specs
    .map((spec, idx) => ({ spec, idx }))
    .sort((a, b) => a.spec.minLevel - b.spec.minLevel || a.idx - b.idx)
    .map((entry) => entry.spec);
}

/** Picks the manual override spec index if valid, otherwise best-matching spec for character level. */
export function selectBracketSpecIndex(
  specs: PassiveTreeSpecSummary[],
  characterLevel: number,
  manualSpecId?: string | null,
): number {
  if (specs.length === 0) return -1;
  if (manualSpecId) {
    const manualIdx = specs.findIndex((s) => s.id === manualSpecId);
    if (manualIdx >= 0) return manualIdx;
  }
  let best = 0;
  for (let i = 0; i < specs.length; i++) {
    if (specs[i]!.minLevel <= characterLevel) best = i;
  }
  return best;
}

/** Resolves human-readable stats for a PoB/GGG selected mastery effect ID on a mastery node. */
export function resolveMasteryEffectStats(
  nodeId: string,
  effectId: string | undefined,
  adapter: GameAdapter,
): string[] | null {
  if (!effectId) return null;
  const meta = adapter.getPassiveTreeNodes()[nodeId];
  const matched = meta?.masteryEffects?.find((eff) => eff.effectId === effectId);
  return matched?.stats.length ? matched.stats : null;
}

function buildSubgraphAdjacency(
  allowedIds: ReadonlySet<string>,
  passiveNodes: Record<string, PassiveTreeNodeMetadata>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const u of allowedIds) {
    const node = passiveNodes[u];
    if (!node?.out) continue;
    for (const v of node.out) {
      if (!allowedIds.has(v)) continue;
      link(u, v);
      link(v, u);
    }
  }
  return adj;
}

/** Finds shortest unallocated node chain inside allowedSet toward a target notable/keystone/mastery. */
export function computeShortestPathToNode(params: {
  targetNodeId: string;
  targetSet: ReadonlySet<string>;
  allocatedIds: ReadonlySet<string>;
  characterClass?: string;
  adapter: GameAdapter;
}): string[] {
  const { targetNodeId, targetSet, allocatedIds, characterClass, adapter } = params;
  if (allocatedIds.has(targetNodeId)) return [];

  const passiveNodes = adapter.getPassiveTreeNodes();
  const targetMeta = passiveNodes[targetNodeId];
  let goalId = targetNodeId;
  let appendMastery = false;

  if (targetMeta?.isMastery && targetMeta.group !== undefined) {
    const wheelNodes = [...targetSet].filter((id) => {
      const m = passiveNodes[id];
      return m && !m.isMastery && m.group === targetMeta.group;
    });
    const anchor = wheelNodes.find((id) => passiveNodes[id]?.isNotable) ?? wheelNodes[0];
    if (!anchor) return [targetNodeId];
    if (allocatedIds.has(anchor)) return [targetNodeId];
    goalId = anchor;
    appendMastery = true;
  }

  const graphMeta = adapter.getPassiveTreeGraphMeta();
  const classStartId = graphMeta.classes.find(
    (c) => c.name.toLowerCase() === String(characterClass ?? "").toLowerCase(),
  )?.startNodeId;

  const allowedWithStart = new Set<string>(targetSet);
  for (const id of allocatedIds) {
    if (targetSet.has(id) || passiveNodes[id]?.classStartIndex !== undefined) allowedWithStart.add(id);
  }
  if (classStartId) allowedWithStart.add(classStartId);

  const roots = new Set<string>();
  for (const id of allocatedIds) {
    if (allowedWithStart.has(id)) roots.add(id);
  }
  if (roots.size === 0) {
    if (classStartId) roots.add(classStartId);
    for (const id of targetSet) {
      if (passiveNodes[id]?.isAscendancyStart) roots.add(id);
    }
  }

  const adj = buildSubgraphAdjacency(allowedWithStart, passiveNodes);
  const visited = new Set<string>(roots);
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const r of roots) {
    parent.set(r, null);
    queue.push(r);
  }

  let reached = false;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (cur === goalId) {
      reached = true;
      break;
    }
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, cur);
      queue.push(next);
    }
  }

  if (!reached) return [targetNodeId];
  const chain: string[] = [];
  let cursor: string | null = goalId;
  while (cursor) {
    if (!allocatedIds.has(cursor) && passiveNodes[cursor]?.classStartIndex === undefined) {
      chain.push(cursor);
    }
    cursor = parent.get(cursor) ?? null;
  }
  chain.reverse();
  if (appendMastery) chain.push(targetNodeId);
  return chain.length > 0 ? chain : [targetNodeId];
}

/** Computes level-bracket delta, respec changes, and next priority notable/mastery targets. */
export function computeBracketProgressionDiff(params: {
  specs: PassiveTreeSpecSummary[];
  selectedIndex: number;
  allocatedIds: ReadonlySet<string>;
  characterClass?: string;
  adapter: GameAdapter;
}): PassiveTreeBracketDiff {
  const { specs, selectedIndex, allocatedIds, characterClass, adapter } = params;
  const selectedSpec = selectedIndex >= 0 ? specs[selectedIndex] ?? null : null;
  const previousSpec = selectedIndex > 0 ? specs[selectedIndex - 1] ?? null : null;
  if (!selectedSpec) {
    return {
      selectedSpec: null,
      previousSpec: null,
      targetSet: new Set(),
      allocatedInTargetIds: [],
      addedInBracketIds: [],
      unallocatedAddedIds: [],
      earlierMissedIds: [],
      respecFromPrevIds: [],
      offSpecAllocatedIds: [],
      futureBracketIds: [],
      nextNotableTargets: [],
    };
  }

  const passiveNodes = adapter.getPassiveTreeNodes();
  const targetSet = new Set(selectedSpec.nodeIds);
  const prevSet = new Set(previousSpec?.nodeIds ?? []);
  const addedSet = new Set(selectedIndex === 0 ? selectedSpec.nodeIds : selectedSpec.nodeIds.filter((id) => !prevSet.has(id)));

  const allocatedInTargetIds: string[] = [];
  const addedInBracketIds: string[] = [];
  const unallocatedAddedIds: string[] = [];
  const earlierMissedIds: string[] = [];
  const nextNotableTargets: PassiveTreeTargetItem[] = [];

  for (const id of selectedSpec.nodeIds) {
    const isAlloc = allocatedIds.has(id);
    const isNew = addedSet.has(id);
    if (isNew) addedInBracketIds.push(id);
    if (isAlloc) {
      allocatedInTargetIds.push(id);
      continue;
    }
    if (isNew) unallocatedAddedIds.push(id);
    else earlierMissedIds.push(id);

    const meta = passiveNodes[id];
    if (meta && (meta.isKeystone || meta.isNotable || meta.isMastery)) {
      nextNotableTargets.push({
        nodeId: id,
        name: meta.name,
        kind: meta.isKeystone ? "keystone" : meta.isMastery ? "mastery" : "notable",
        isNewInBracket: isNew,
        stats: meta.stats,
        chosenMasteryStats: meta.isMastery ? resolveMasteryEffectStats(id, selectedSpec.masteries[id], adapter) : null,
        pathToAllocateIds: computeShortestPathToNode({
          targetNodeId: id,
          targetSet,
          allocatedIds,
          characterClass,
          adapter,
        }),
      });
    }
  }

  const respecFromPrevIds = previousSpec ? previousSpec.nodeIds.filter((id) => !targetSet.has(id)) : [];
  const offSpecAllocatedIds = [...allocatedIds].filter(
    (id) => !targetSet.has(id) && passiveNodes[id]?.classStartIndex === undefined,
  );
  const futureSet = new Set<string>();
  for (let i = selectedIndex + 1; i < specs.length; i++) {
    for (const id of specs[i]!.nodeIds) {
      if (!targetSet.has(id)) futureSet.add(id);
    }
  }

  return {
    selectedSpec,
    previousSpec,
    targetSet,
    allocatedInTargetIds,
    addedInBracketIds,
    unallocatedAddedIds,
    earlierMissedIds,
    respecFromPrevIds,
    offSpecAllocatedIds,
    futureBracketIds: [...futureSet],
    nextNotableTargets,
  };
}
