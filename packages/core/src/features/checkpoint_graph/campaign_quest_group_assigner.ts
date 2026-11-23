import type {
  CampaignQuestGroupAreaMatcher,
  CampaignQuestGroupDefinition,
  GameAdapter,
} from "@exile-hud/game-data";
import type { CheckpointStepItem } from "../protocol/session_room_wire_protocol.js";

function computeVisitIndicesPerActArea(checkpoints: readonly CheckpointStepItem[]): number[] {
  const visitIndices = new Array<number>(checkpoints.length);
  const countByActArea = new Map<string, number>();

  let i = 0;
  while (i < checkpoints.length) {
    const act = checkpoints[i]!.sectionAct;
    const areaId = checkpoints[i]!.areaId;
    const key = `${act}|${areaId}`;
    const visitIdx = countByActArea.get(key) ?? 0;
    countByActArea.set(key, visitIdx + 1);

    let j = i;
    while (
      j < checkpoints.length &&
      checkpoints[j]!.sectionAct === act &&
      checkpoints[j]!.areaId === areaId
    ) {
      visitIndices[j] = visitIdx;
      j += 1;
    }
    i = j;
  }

  return visitIndices;
}

function mergePrerequisites(
  existing: readonly string[] | undefined,
  extra: readonly string[] | undefined,
): string[] | undefined {
  if ((!existing || existing.length === 0) && (!extra || extra.length === 0)) {
    return existing ? [...existing] : undefined;
  }
  const seen = new Set<string>(existing ?? []);
  const merged: string[] = [...(existing ?? [])];
  for (const areaId of extra ?? []) {
    if (!seen.has(areaId)) {
      seen.add(areaId);
      merged.push(areaId);
    }
  }
  return merged.length > 0 ? merged : undefined;
}

function matchesAreaMatcher(
  matcher: CampaignQuestGroupAreaMatcher,
  areaId: string,
  visitIndex: number,
  currentGroupOrder: number,
): boolean {
  if (matcher.areaId !== areaId) return false;
  if (matcher.minVisitIndex !== undefined && visitIndex < matcher.minVisitIndex) return false;
  if (matcher.maxVisitIndex !== undefined && visitIndex > matcher.maxVisitIndex) return false;
  if (matcher.minGroupOrder !== undefined && currentGroupOrder < matcher.minGroupOrder) return false;
  if (matcher.maxGroupOrder !== undefined && currentGroupOrder > matcher.maxGroupOrder) return false;
  return true;
}

function findMatchingGroup(
  cp: CheckpointStepItem,
  visitIndex: number,
  currentOrder: number,
  actGroups: readonly CampaignQuestGroupDefinition[],
  matcherAreas: ReadonlySet<string>,
): { group: CampaignQuestGroupDefinition; matcher?: CampaignQuestGroupAreaMatcher } | null {
  if (matcherAreas.has(cp.areaId)) {
    for (const group of actGroups) {
      if (group.order < currentOrder || !group.areaMatchers) continue;
      for (const matcher of group.areaMatchers) {
        if (matchesAreaMatcher(matcher, cp.areaId, visitIndex, currentOrder)) {
          return { group, matcher };
        }
      }
    }
    return null;
  }

  for (const group of actGroups) {
    if (group.order < currentOrder) continue;
    if (group.mandatoryAreaIds.includes(cp.areaId)) {
      return { group };
    }
  }
  return null;
}

/**
 * Annotates compiled route checkpoints with sequential Mandatory Quest Group metadata,
 * marks pure side-detour areas as optional, and wires cross-group multi-visit prerequisites.
 */
export function assignCampaignQuestGroups(
  checkpoints: readonly CheckpointStepItem[],
  adapter: GameAdapter,
): CheckpointStepItem[] {
  const visitIndices = computeVisitIndicesPerActArea(checkpoints);
  const optionalDetourAreas = adapter.getOptionalDetourAreaIds();
  const actGroupsCache = new Map<number, readonly CampaignQuestGroupDefinition[]>();
  const matcherAreasCache = new Map<number, ReadonlySet<string>>();
  const currentOrderByAct = new Map<number, number>();

  const getActMeta = (act: number) => {
    let groups = actGroupsCache.get(act);
    let matcherAreas = matcherAreasCache.get(act);
    if (!groups || !matcherAreas) {
      groups = adapter.getCampaignQuestGroups(act);
      const nextMatcherAreas = new Set<string>();
      for (const group of groups) {
        for (const matcher of group.areaMatchers ?? []) {
          nextMatcherAreas.add(matcher.areaId);
        }
      }
      matcherAreas = nextMatcherAreas;
      actGroupsCache.set(act, groups);
      matcherAreasCache.set(act, nextMatcherAreas);
    }
    return { groups, matcherAreas };
  };

  return checkpoints.map((cp, idx) => {
    const act = cp.sectionAct;
    const { groups, matcherAreas } = getActMeta(act);
    const forcedOptional = optionalDetourAreas.has(cp.areaId);
    const effectiveOptional = Boolean(cp.isOptionalDetour || forcedOptional);

    if (groups.length === 0) {
      return forcedOptional && !cp.isOptionalDetour
        ? { ...cp, isOptionalDetour: true, isMandatoryGate: false }
        : { ...cp };
    }

    let currentOrder = currentOrderByAct.get(act) ?? 0;
    let assignedGroup = groups.find((g) => g.order === currentOrder) ?? groups[0]!;
    let matchedMatcher: CampaignQuestGroupAreaMatcher | undefined;

    if (!forcedOptional) {
      const match = findMatchingGroup(cp, visitIndices[idx] ?? 0, currentOrder, groups, matcherAreas);
      if (match) {
        assignedGroup = match.group;
        matchedMatcher = match.matcher;
        currentOrder = assignedGroup.order;
        currentOrderByAct.set(act, currentOrder);
      }
    }

    const prerequisiteAreaIds =
      !effectiveOptional && cp.stepKind !== "travel_lead_in" && matchedMatcher?.prerequisiteAreaIds
        ? mergePrerequisites(cp.prerequisiteAreaIds, matchedMatcher.prerequisiteAreaIds)
        : cp.prerequisiteAreaIds;

    const isMandatoryGate = Boolean(
      !effectiveOptional &&
        cp.category === "MANDATORY_PATH" &&
        cp.stepKind !== "travel_lead_in" &&
        assignedGroup.mandatoryAreaIds.includes(cp.areaId),
    );

    return {
      ...cp,
      ...(effectiveOptional ? { isOptionalDetour: true } : {}),
      ...(prerequisiteAreaIds ? { prerequisiteAreaIds } : {}),
      questGroupId: assignedGroup.id,
      questGroupIndex: assignedGroup.order,
      questGroupTitle: assignedGroup.titleEn,
      isMandatoryGate,
    };
  });
}
