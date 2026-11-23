import type { GameAdapter, PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { cleanPobColorCodes } from "../pob_import/pob_xml_text_helpers.js";
import type { PassiveTreeSpecSummary } from "../protocol/session_room_wire_protocol.js";
import {
  isAscendancyMilestoneNode,
  resolveAscendancyCluster,
} from "./ascendancy_progression_planner.js";

const SECTION_HEADER_RE = /\b(?:ascendanc\w*|lab(?:yrinth)?)\b/i;

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectCandidateMilestones(
  clusterKey: string,
  clusterNodeMap: Map<string, PassiveTreeNodeMetadata>,
  clusterNodes: PassiveTreeNodeMetadata[],
  treeSpecs: readonly Pick<PassiveTreeSpecSummary, "nodeIds">[],
): PassiveTreeNodeMetadata[] {
  const fromSpecs: PassiveTreeNodeMetadata[] = [];
  const seen = new Set<string>();
  for (const spec of treeSpecs) {
    for (const id of spec.nodeIds) {
      if (seen.has(id)) continue;
      const node = clusterNodeMap.get(id);
      if (!node || !isAscendancyMilestoneNode(node, clusterKey)) continue;
      seen.add(id);
      fromSpecs.push(node);
    }
  }
  if (fromSpecs.length > 0) return fromSpecs;
  return clusterNodes.filter((n) => isAscendancyMilestoneNode(n, clusterKey));
}

function findMilestoneMentionsInText(
  text: string,
  candidates: readonly PassiveTreeNodeMetadata[],
): Array<{ index: number; nodeId: string }> {
  const hits: Array<{ index: number; nodeId: string }> = [];
  for (const candidate of candidates) {
    const escaped = escapeRegexLiteral(candidate.name.trim());
    if (!escaped) continue;
    const regex = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const inner = match[1];
      if (!inner) continue;
      const innerOffset = match[0].indexOf(inner);
      hits.push({ index: match.index + Math.max(0, innerOffset), nodeId: candidate.id });
    }
  }
  hits.sort((a, b) => a.index - b.index || a.nodeId.localeCompare(b.nodeId));
  return hits;
}

function deduplicateInOrder(hits: readonly { index: number; nodeId: string }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const hit of hits) {
    if (seen.has(hit.nodeId)) continue;
    seen.add(hit.nodeId);
    ordered.push(hit.nodeId);
  }
  return ordered;
}

/** Extracts an ordered list of Ascendancy milestone node IDs mentioned in PoB `<Notes>`. */
export function extractAscendancyNoteOrderIds(
  rawNotes: string,
  ascendancyName: string,
  treeSpecs: readonly Pick<PassiveTreeSpecSummary, "nodeIds">[],
  adapter: GameAdapter,
): string[] {
  const cleaned = cleanPobColorCodes(rawNotes);
  if (!cleaned) return [];

  const cluster = resolveAscendancyCluster({ ascendancyName, specs: treeSpecs, adapter });
  if (!cluster) return [];

  const candidates = collectCandidateMilestones(
    cluster.clusterKey,
    cluster.clusterNodeMap,
    cluster.clusterNodes,
    treeSpecs,
  );
  if (candidates.length < 2) return [];

  const lines = cleaned.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!SECTION_HEADER_RE.test(lines[i]!)) continue;
    const sectionText = lines.slice(i, i + 14).join("\n").slice(0, 700);
    const sectionOrder = deduplicateInOrder(findMilestoneMentionsInText(sectionText, candidates));
    if (sectionOrder.length >= 2) return sectionOrder;
  }

  const allHits = findMilestoneMentionsInText(cleaned, candidates);
  if (allHits.length < 2) return [];

  let bestRun: string[] = [];
  let runIds: string[] = [];
  let runSeen = new Set<string>();
  let lastIndex = -1;

  for (const hit of allHits) {
    if (lastIndex !== -1 && hit.index - lastIndex > 400) {
      if (runIds.length > bestRun.length) bestRun = runIds;
      runIds = [];
      runSeen = new Set<string>();
    }
    if (!runSeen.has(hit.nodeId)) {
      runSeen.add(hit.nodeId);
      runIds.push(hit.nodeId);
    }
    lastIndex = hit.index;
  }
  if (runIds.length > bestRun.length) bestRun = runIds;

  return bestRun.length >= 2 ? bestRun : [];
}
