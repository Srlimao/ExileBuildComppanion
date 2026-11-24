import type { GameAdapter } from "@exile-hud/game-data";
import type { ExtractedTreeSpec } from "../pob_import/pob_xml_skill_and_tree_extractor.js";
import type {
  PassiveTreeSpecSummary,
  PassiveTreeTelemetry,
} from "../protocol/session_room_wire_protocol.js";
import { sortTreeSpecsByLevel } from "./passive_tree_bracket_differ.js";

function toSpecSummaries(specs: ExtractedTreeSpec[]): PassiveTreeSpecSummary[] {
  return sortTreeSpecsByLevel(
    specs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      minLevel: spec.minLevel,
      nodeIds: spec.nodeIds,
      masteries: spec.masteries,
      ...(spec.weaponSet1NodeIds ? { weaponSet1NodeIds: spec.weaponSet1NodeIds } : {}),
      ...(spec.weaponSet2NodeIds ? { weaponSet2NodeIds: spec.weaponSet2NodeIds } : {}),
      ...(spec.nodeNotes && Object.keys(spec.nodeNotes).length > 0 ? { nodeNotes: spec.nodeNotes } : {}),
    })),
  );
}

export function selectActiveTreeSpec<T extends { minLevel: number }>(
  specs: T[],
  characterLevel: number,
): T | null {
  if (specs.length === 0) return null;
  const sorted = specs
    .map((spec, idx) => ({ spec, idx }))
    .sort((a, b) => a.spec.minLevel - b.spec.minLevel || a.idx - b.idx)
    .map((entry) => entry.spec);

  let active = sorted[0]!;
  for (const spec of sorted) {
    if (spec.minLevel <= characterLevel) active = spec;
  }
  return active;
}

function computeFromSpecSummaries(params: {
  specs: PassiveTreeSpecSummary[];
  allocatedNodeIds: string[];
  allocatedMasteries: Record<string, string>;
  ascendancyNoteOrderIds?: string[];
  characterLevel: number;
  adapter: GameAdapter;
}): PassiveTreeTelemetry {
  const { specs, allocatedNodeIds, allocatedMasteries, ascendancyNoteOrderIds, characterLevel, adapter } = params;
  const spec = selectActiveTreeSpec(specs, characterLevel);
  if (!spec) {
    return {
      specName: "No Passive Tree",
      targetNodeCount: 0,
      allocatedTargetCount: 0,
      remainingNodeIds: [],
      remainingNotableNames: [],
      respecPointsNeeded: 0,
      targetNodesPreview: [],
      allocatedNodeIds,
      allocatedMasteries,
      specs,
      ...(ascendancyNoteOrderIds?.length ? { ascendancyNoteOrderIds } : {}),
    };
  }

  const targetSet = new Set(spec.nodeIds);
  const allocatedSet = new Set(allocatedNodeIds);
  const passiveNodes = adapter.getPassiveTreeNodes();

  const remainingNodeIds: string[] = [];
  const remainingNotableNames: string[] = [];
  let allocatedTargetCount = 0;

  for (const id of spec.nodeIds) {
    if (allocatedSet.has(id)) {
      allocatedTargetCount++;
    } else {
      remainingNodeIds.push(id);
      const meta = passiveNodes[id];
      if (meta && (meta.isNotable || meta.isKeystone)) {
        remainingNotableNames.push(meta.name);
      }
    }
  }

  let respecPointsNeeded = 0;
  for (const allocId of allocatedSet) {
    if (!targetSet.has(allocId) && passiveNodes[allocId]?.classStartIndex === undefined) {
      respecPointsNeeded++;
    }
  }

  const targetNodesPreview = spec.nodeIds.slice(0, 140).map((id) => {
    const meta = passiveNodes[id];
    return {
      id,
      x: meta?.x ?? 0,
      y: meta?.y ?? 0,
      allocated: allocatedSet.has(id),
      label: meta?.name ?? id,
    };
  });

  return {
    specName: spec.title,
    activeSpecId: spec.id,
    targetNodeCount: spec.nodeIds.length,
    allocatedTargetCount,
    remainingNodeIds,
    remainingNotableNames: remainingNotableNames.slice(0, 12),
    respecPointsNeeded,
    targetNodesPreview,
    allocatedNodeIds,
    allocatedMasteries,
    specs,
    ...(ascendancyNoteOrderIds?.length ? { ascendancyNoteOrderIds } : {}),
  };
}

/** Computes passive tree diff against GGG allocated node hashes. */
export function computePassiveTreeDiff(params: {
  treeSpecs: ExtractedTreeSpec[];
  allocatedHashes: number[];
  allocatedMasteries?: Record<string, string>;
  ascendancyNoteOrderIds?: string[];
  characterLevel: number;
  adapter: GameAdapter;
}): PassiveTreeTelemetry {
  return computeFromSpecSummaries({
    specs: toSpecSummaries(params.treeSpecs),
    allocatedNodeIds: [...new Set(params.allocatedHashes.map(String))],
    allocatedMasteries: params.allocatedMasteries ?? {},
    ascendancyNoteOrderIds: params.ascendancyNoteOrderIds,
    characterLevel: params.characterLevel,
    adapter: params.adapter,
  });
}
