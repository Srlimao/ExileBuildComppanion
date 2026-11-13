import type { GameAdapter } from "@exile-hud/game-data";
import type { ExtractedTreeSpec } from "../pob_import/pob_xml_skill_and_tree_extractor.js";
import type { PassiveTreeTelemetry } from "../protocol/session_room_wire_protocol.js";

export function selectActiveTreeSpec(specs: ExtractedTreeSpec[], characterLevel: number): ExtractedTreeSpec | null {
  if (specs.length === 0) return null;
  let active = specs[0]!;
  for (const spec of specs) {
    if (spec.minLevel <= characterLevel) active = spec;
  }
  return active;
}

export function computePassiveTreeDiff(params: {
  treeSpecs: ExtractedTreeSpec[];
  allocatedHashes: number[];
  characterLevel: number;
  adapter: GameAdapter;
}): PassiveTreeTelemetry {
  const { treeSpecs, allocatedHashes, characterLevel, adapter } = params;
  const spec = selectActiveTreeSpec(treeSpecs, characterLevel);
  if (!spec) {
    return {
      specName: "No Passive Tree",
      targetNodeCount: 0,
      allocatedTargetCount: 0,
      remainingNodeIds: [],
      remainingNotableNames: [],
      respecPointsNeeded: 0,
      targetNodesPreview: [],
    };
  }

  const targetSet = new Set(spec.nodeIds);
  const allocatedSet = new Set(allocatedHashes.map(String));
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
    if (!targetSet.has(allocId)) {
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
    targetNodeCount: spec.nodeIds.length,
    allocatedTargetCount,
    remainingNodeIds,
    remainingNotableNames: remainingNotableNames.slice(0, 12),
    respecPointsNeeded,
    targetNodesPreview,
  };
}
