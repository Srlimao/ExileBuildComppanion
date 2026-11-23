import type { AreaDefinition, GameAdapter } from "@exile-hud/game-data";

interface CachedDominatorGraph {
  intraActStrictDominators: Map<string, ReadonlySet<string>>;
  actTrunkStrictDominators: Map<number, ReadonlySet<string>>;
}

const dominatorCache = new WeakMap<GameAdapter, CachedDominatorGraph>();

function collectReachableInAct(
  entryAreaId: string,
  skipAreaId: string | null,
  actAreaIds: ReadonlySet<string>,
  areas: Readonly<Record<string, AreaDefinition>>,
  adapter: GameAdapter,
): Set<string> {
  const visited = new Set<string>();
  if (entryAreaId === skipAreaId || !actAreaIds.has(entryAreaId)) {
    return visited;
  }
  const queue: string[] = [entryAreaId];
  visited.add(entryAreaId);

  for (let head = 0; head < queue.length; head += 1) {
    const currentId = queue[head]!;
    const area = areas[currentId];
    if (!area) continue;
    for (const nextId of area.connection_ids) {
      if (nextId === skipAreaId || visited.has(nextId) || !actAreaIds.has(nextId)) {
        continue;
      }
      if (adapter.isIgnoredGraphEdge(currentId, nextId)) {
        continue;
      }
      visited.add(nextId);
      queue.push(nextId);
    }
  }
  return visited;
}

function buildDominatorGraph(adapter: GameAdapter): CachedDominatorGraph {
  const areas = adapter.getAreas();
  const areasByAct = new Map<number, Set<string>>();

  for (const area of Object.values(areas)) {
    const act = Number(area.act);
    if (!Number.isFinite(act) || act <= 0) continue;
    let set = areasByAct.get(act);
    if (!set) {
      set = new Set<string>();
      areasByAct.set(act, set);
    }
    set.add(area.id);
  }

  const intraActStrictDominators = new Map<string, ReadonlySet<string>>();
  const actTrunkStrictDominators = new Map<number, ReadonlySet<string>>();

  for (const [act, actAreaIds] of areasByAct.entries()) {
    const entryAreaId = adapter.getActEntryAreaId(act);
    if (!entryAreaId || !actAreaIds.has(entryAreaId)) continue;

    const allReachable = collectReachableInAct(entryAreaId, null, actAreaIds, areas, adapter);
    const domsByTarget = new Map<string, Set<string>>();
    for (const areaId of allReachable) {
      domsByTarget.set(areaId, new Set<string>());
    }

    for (const candidateId of allReachable) {
      const withoutCandidate = collectReachableInAct(
        entryAreaId,
        candidateId,
        actAreaIds,
        areas,
        adapter,
      );
      for (const targetId of allReachable) {
        if (targetId !== candidateId && !withoutCandidate.has(targetId)) {
          domsByTarget.get(targetId)!.add(candidateId);
        }
      }
    }

    for (const [targetId, domSet] of domsByTarget.entries()) {
      intraActStrictDominators.set(targetId, domSet);
    }

    const finalAreaId = adapter.getActFinalAreaId(act);
    if (finalAreaId && allReachable.has(finalAreaId)) {
      const trunkSet = new Set<string>(domsByTarget.get(finalAreaId) ?? []);
      trunkSet.add(finalAreaId);
      actTrunkStrictDominators.set(act, trunkSet);
    }
  }

  return { intraActStrictDominators, actTrunkStrictDominators };
}

function getOrBuildDominatorGraph(adapter: GameAdapter): CachedDominatorGraph {
  let cached = dominatorCache.get(adapter);
  if (!cached) {
    cached = buildDominatorGraph(adapter);
    dominatorCache.set(adapter, cached);
  }
  return cached;
}

/**
 * Returns the set of campaign area IDs strictly implied (graph-dominated) upon legitimately
 * entering `targetAreaId`. Never includes `targetAreaId` itself, parallel branches, or dead-end side zones.
 */
export function getStrictImpliedAreaIds(
  targetAreaId: string,
  highestUnlockedAct: number,
  adapter: GameAdapter,
): ReadonlySet<string> {
  if (/hideout|labyrinth/i.test(targetAreaId)) {
    return new Set<string>();
  }

  const area = adapter.getAreas()[targetAreaId];
  if (!area) {
    return new Set<string>();
  }

  const targetAct = Number(area.act);
  if (!Number.isFinite(targetAct) || targetAct <= 0 || targetAct > highestUnlockedAct) {
    return new Set<string>();
  }

  const graph = getOrBuildDominatorGraph(adapter);
  const implied = new Set<string>(graph.intraActStrictDominators.get(targetAreaId) ?? []);

  const canImplyPriorActs =
    !area.is_town_area || targetAreaId === adapter.getActEntryAreaId(targetAct);
  if (canImplyPriorActs) {
    for (let priorAct = 1; priorAct < targetAct; priorAct += 1) {
      const priorTrunk = graph.actTrunkStrictDominators.get(priorAct);
      if (!priorTrunk) continue;
      for (const areaId of priorTrunk) {
        implied.add(areaId);
      }
    }
  }

  implied.delete(targetAreaId);
  return implied;
}

/**
 * Returns strictly prior-act trunk dominators (`priorAct < targetAct`) upon entering
 * `targetAreaId` on a new Act or non-town area. Never implies unvisited areas inside
 * the current Act so intra-act progression requires explicit visits or manual check-off.
 */
export function getPriorActImpliedAreaIds(
  targetAreaId: string,
  highestUnlockedAct: number,
  adapter: GameAdapter,
): ReadonlySet<string> {
  if (/hideout|labyrinth/i.test(targetAreaId)) {
    return new Set<string>();
  }

  const area = adapter.getAreas()[targetAreaId];
  if (!area) {
    return new Set<string>();
  }

  const targetAct = Number(area.act);
  if (!Number.isFinite(targetAct) || targetAct <= 1 || targetAct > highestUnlockedAct) {
    return new Set<string>();
  }

  const canImplyPriorActs =
    !area.is_town_area || targetAreaId === adapter.getActEntryAreaId(targetAct);
  if (!canImplyPriorActs) {
    return new Set<string>();
  }

  const graph = getOrBuildDominatorGraph(adapter);
  const implied = new Set<string>();
  for (let priorAct = 1; priorAct < targetAct; priorAct += 1) {
    const priorTrunk = graph.actTrunkStrictDominators.get(priorAct);
    if (!priorTrunk) continue;
    for (const areaId of priorTrunk) {
      implied.add(areaId);
    }
  }

  implied.delete(targetAreaId);
  return implied;
}
