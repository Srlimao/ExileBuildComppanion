import type { PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { selectBracketSpecIndex } from "../character_telemetry_diff/passive_tree_bracket_differ.js";
import type { PassiveTreeSpecSummary } from "../protocol/session_room_wire_protocol.js";
import {
  detectSpecAscendancyClusterKey,
  isAscendancyMilestoneNode,
  type ResolvedAscendancyCluster,
} from "./ascendancy_cluster_resolver.js";

export interface AscendancySpecEntry {
  spec: PassiveTreeSpecSummary;
  sortedIndex: number;
  clusterKey: string;
  uniqueClusterIds: string[];
  milestoneIds: string[];
  nonStartCount: number;
}

export interface AscendancyPhaseSummary {
  id: string;
  clusterKey: string;
  displayName: string;
  minLevel: number;
  firstSpecTitle: string;
  finalSpecTitle: string;
  milestoneCount: number;
  isSwapPhase: boolean;
}

export interface PartitionedAscendancyPhase extends AscendancyPhaseSummary {
  entries: AscendancySpecEntry[];
  finalEntry: AscendancySpecEntry;
  firstSortedIndex: number;
  lastSortedIndex: number;
  specIds: string[];
}

function finalizePhase(
  phaseIdx: number,
  rawEntries: AscendancySpecEntry[],
  clusterIndex: Map<string, ResolvedAscendancyCluster>,
): PartitionedAscendancyPhase {
  const entries = [...rawEntries].sort(
    (a, b) =>
      a.spec.minLevel - b.spec.minLevel ||
      a.nonStartCount - b.nonStartCount ||
      a.sortedIndex - b.sortedIndex,
  );
  const finalEntry = entries.reduce<AscendancySpecEntry>((best, cur) => {
    if (cur.milestoneIds.length !== best.milestoneIds.length) {
      return cur.milestoneIds.length > best.milestoneIds.length ? cur : best;
    }
    if (cur.nonStartCount !== best.nonStartCount) {
      return cur.nonStartCount > best.nonStartCount ? cur : best;
    }
    return cur.spec.minLevel >= best.spec.minLevel ? cur : best;
  }, entries[0]!);

  const clusterKey = entries[0]!.clusterKey;
  const cluster = clusterIndex.get(clusterKey);
  return {
    id: `phase_${phaseIdx}`,
    clusterKey,
    displayName: cluster?.displayName ?? clusterKey,
    minLevel: entries[0]!.spec.minLevel,
    firstSpecTitle: entries[0]!.spec.title,
    finalSpecTitle: finalEntry.spec.title,
    milestoneCount: finalEntry.milestoneIds.length,
    isSwapPhase: phaseIdx > 0,
    entries,
    finalEntry,
    firstSortedIndex: Math.min(...entries.map((e) => e.sortedIndex)),
    lastSortedIndex: Math.max(...entries.map((e) => e.sortedIndex)),
    specIds: entries.map((e) => e.spec.id),
  };
}

/** Splits level-sorted PoB specs into Ascendancy phases whenever class or notable respecs occur. */
export function partitionSpecsIntoAscendancyPhases(
  sortedSpecs: readonly PassiveTreeSpecSummary[],
  clusterIndex: Map<string, ResolvedAscendancyCluster>,
  allNodes: Record<string, PassiveTreeNodeMetadata>,
): PartitionedAscendancyPhase[] {
  const specEntries: AscendancySpecEntry[] = [];

  for (let sortedIndex = 0; sortedIndex < sortedSpecs.length; sortedIndex++) {
    const spec = sortedSpecs[sortedIndex]!;
    const clusterKey = detectSpecAscendancyClusterKey(spec.nodeIds, allNodes);
    if (!clusterKey) continue;
    const cluster = clusterIndex.get(clusterKey);
    if (!cluster) continue;

    const uniqueClusterIds: string[] = [];
    const milestoneIds: string[] = [];
    const seen = new Set<string>();
    let nonStartCount = 0;

    for (const id of spec.nodeIds) {
      if (seen.has(id)) continue;
      const node = cluster.clusterNodeMap.get(id);
      if (!node) continue;
      seen.add(id);
      uniqueClusterIds.push(id);
      if (!node.isAscendancyStart) nonStartCount += 1;
      if (isAscendancyMilestoneNode(node, clusterKey)) milestoneIds.push(id);
    }
    if (nonStartCount <= 0) continue;

    specEntries.push({
      spec,
      sortedIndex,
      clusterKey,
      uniqueClusterIds,
      milestoneIds,
      nonStartCount,
    });
  }

  if (specEntries.length === 0) return [];

  const groups: AscendancySpecEntry[][] = [[specEntries[0]!]];
  for (let i = 1; i < specEntries.length; i++) {
    const prev = specEntries[i - 1]!;
    const cur = specEntries[i]!;
    const curMilestoneSet = new Set(cur.milestoneIds);
    const hasDroppedMilestone = prev.milestoneIds.some((id) => !curMilestoneSet.has(id));
    if (cur.clusterKey !== prev.clusterKey || hasDroppedMilestone) {
      groups.push([cur]);
    } else {
      groups[groups.length - 1]!.push(cur);
    }
  }

  return groups.map((group, idx) => finalizePhase(idx, group, clusterIndex));
}

/** Selects the active Ascendancy phase based on manual override, character level, or active spec. */
export function selectActiveAscendancyPhaseIndex(params: {
  phases: readonly PartitionedAscendancyPhase[];
  sortedSpecs: readonly PassiveTreeSpecSummary[];
  characterLevel?: number;
  activeSpecId?: string | null;
  manualPhaseId?: string | null;
}): number {
  const { phases, sortedSpecs, characterLevel, activeSpecId, manualPhaseId } = params;
  if (phases.length === 0) return -1;

  if (manualPhaseId) {
    const manualIdx = phases.findIndex((p) => p.id === manualPhaseId);
    if (manualIdx >= 0) return manualIdx;
  }

  if (characterLevel === undefined && !activeSpecId) {
    return phases.length - 1;
  }

  const activeSpecIndex =
    characterLevel !== undefined
      ? selectBracketSpecIndex([...sortedSpecs], characterLevel)
      : sortedSpecs.findIndex((s) => s.id === activeSpecId);

  if (activeSpecIndex >= 0) {
    const activeSpec = sortedSpecs[activeSpecIndex];
    if (activeSpec) {
      const directIdx = phases.findIndex((p) => p.specIds.includes(activeSpec.id));
      if (directIdx >= 0) return directIdx;
    }
    const upcomingIdx = phases.findIndex((p) => p.firstSortedIndex > activeSpecIndex);
    if (upcomingIdx >= 0) return upcomingIdx;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (phases[i]!.lastSortedIndex < activeSpecIndex) return i;
    }
  }

  if (characterLevel !== undefined) {
    let best = 0;
    for (let i = 0; i < phases.length; i++) {
      if (phases[i]!.minLevel <= characterLevel) best = i;
    }
    return best;
  }

  return 0;
}
