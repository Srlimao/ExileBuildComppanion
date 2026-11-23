import {
  poe1GameAdapter,
  type CampaignQuestGroupDefinition,
  type GameAdapter,
} from "@exile-hud/game-data";
import type { CheckpointStepItem, HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { assignCampaignQuestGroups } from "./campaign_quest_group_assigner.js";

export interface QuestGroupProgressSummary {
  groupId: string;
  groupIndex: number;
  totalGroups: number;
  titleEn: string;
  titlePtBr: string;
  checkpoints: CheckpointStepItem[];
  mandatoryAreaIds: string[];
  missingMandatoryAreaIds: string[];
  unvisitedMandatoryAreaIds: string[];
  isSatisfied: boolean;
  isBlockedByUnvisited: boolean;
}

export interface ActiveActQuestGroupEvaluation {
  groups: QuestGroupProgressSummary[];
  activeGroupIndex: number;
  activeGroup: QuestGroupProgressSummary | null;
  isHoldingForUnvisitedMandatory: boolean;
}

function findAreaGroupIndex(
  areaId: string | null | undefined,
  groups: readonly QuestGroupProgressSummary[],
  visited: ReadonlySet<string>,
): number {
  if (!areaId) return -1;
  // Prefer the earliest group that owns `areaId` if not yet visited later, or the latest matching group whose prereqs/steps apply.
  let firstMatch = -1;
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]!;
    if (!g.mandatoryAreaIds.includes(areaId)) continue;
    if (firstMatch === -1) firstMatch = i;
    const gateSteps = g.checkpoints.filter((cp) => cp.areaId === areaId && cp.isMandatoryGate);
    if (gateSteps.some((cp) => !cp.completed) && !visited.has(areaId)) {
      return i;
    }
  }
  if (firstMatch !== -1) {
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      if (groups[i]!.mandatoryAreaIds.includes(areaId)) {
        const g = groups[i]!;
        if (i === firstMatch || g.checkpoints.some((cp) => cp.areaId === areaId && cp.completed)) {
          return i;
        }
      }
    }
  }
  return firstMatch;
}

function buildFallbackSingleGroup(
  actSteps: readonly CheckpointStepItem[],
  act: number,
  visited: ReadonlySet<string>,
  cleared: ReadonlySet<string>,
): ActiveActQuestGroupEvaluation {
  if (actSteps.length === 0) {
    return { groups: [], activeGroupIndex: -1, activeGroup: null, isHoldingForUnvisitedMandatory: false };
  }
  const mandatoryAreaIds: string[] = [];
  const seen = new Set<string>();
  for (const cp of actSteps) {
    if (!cp.isOptionalDetour && cp.category === "MANDATORY_PATH" && cp.stepKind !== "travel_lead_in" && !seen.has(cp.areaId)) {
      seen.add(cp.areaId);
      mandatoryAreaIds.push(cp.areaId);
    }
  }
  const missingMandatoryAreaIds: string[] = [];
  const unvisitedMandatoryAreaIds: string[] = [];
  for (const areaId of mandatoryAreaIds) {
    const gateSteps = actSteps.filter(
      (cp) => cp.areaId === areaId && !cp.isOptionalDetour && cp.category === "MANDATORY_PATH" && cp.stepKind !== "travel_lead_in",
    );
    const satisfied =
      gateSteps.length === 0
        ? cleared.has(areaId) || visited.has(areaId)
        : gateSteps.every((cp) => cp.completed) || (cleared.has(areaId) && gateSteps.some((cp) => cp.completed));
    if (!satisfied) {
      missingMandatoryAreaIds.push(areaId);
      if (!visited.has(areaId)) unvisitedMandatoryAreaIds.push(areaId);
    }
  }
  const hasPending = actSteps.some((cp) => !cp.completed);
  const group: QuestGroupProgressSummary = {
    groupId: `act_${act}_custom`,
    groupIndex: 0,
    totalGroups: 1,
    titleEn: `Act ${act}`,
    titlePtBr: `Ato ${act}`,
    checkpoints: [...actSteps],
    mandatoryAreaIds,
    missingMandatoryAreaIds,
    unvisitedMandatoryAreaIds,
    isSatisfied: missingMandatoryAreaIds.length === 0,
    isBlockedByUnvisited: missingMandatoryAreaIds.length > 0 && unvisitedMandatoryAreaIds.length > 0,
  };
  return {
    groups: [group],
    activeGroupIndex: hasPending || !group.isSatisfied ? 0 : -1,
    activeGroup: hasPending || !group.isSatisfied ? group : null,
    isHoldingForUnvisitedMandatory: false,
  };
}

/**
 * Evaluates all Mandatory Quest Groups for `snapshot.currentAct` and selects the earliest
 * unsatisfied group so the HUD never advances past unvisited mandatory maps.
 */
export function evaluateActiveActQuestGroups(
  snapshot: HudSessionSnapshot,
  adapter: GameAdapter = poe1GameAdapter,
): ActiveActQuestGroupEvaluation {
  const visited = new Set<string>(snapshot.visitedAreaIds ?? []);
  const cleared = new Set<string>(snapshot.clearedAreaIds ?? []);
  if (snapshot.currentAreaId && !/hideout/i.test(snapshot.currentAreaId)) {
    visited.add(snapshot.currentAreaId);
  }

  const rawActSteps = snapshot.checkpoints.filter(
    (cp) => cp.sectionAct === snapshot.currentAct || cp.areaId === snapshot.currentAreaId,
  );
  const actDefs = adapter.getCampaignQuestGroups(snapshot.currentAct);
  if (actDefs.length === 0 || rawActSteps.length === 0) {
    return buildFallbackSingleGroup(rawActSteps, snapshot.currentAct, visited, cleared);
  }

  const ownActSteps = rawActSteps.filter((cp) => cp.sectionAct === snapshot.currentAct);
  const needsGroupAnnotation = ownActSteps.some((cp) => !cp.questGroupId);
  const normalizedOwnSteps = needsGroupAnnotation
    ? assignCampaignQuestGroups(ownActSteps, adapter)
    : ownActSteps;

  const normalizedById = new Map(normalizedOwnSteps.map((cp) => [cp.id, cp]));
  const bucketByGroupId = new Map<string, CheckpointStepItem[]>();
  const defById = new Map<string, CampaignQuestGroupDefinition>(actDefs.map((d) => [d.id, d]));
  for (const def of actDefs) {
    bucketByGroupId.set(def.id, []);
  }

  const fallbackGroupId = actDefs[actDefs.length - 1]!.id;
  for (const rawCp of rawActSteps) {
    const cp = normalizedById.get(rawCp.id) ?? rawCp;
    const targetGroupId =
      cp.sectionAct === snapshot.currentAct && cp.questGroupId && defById.has(cp.questGroupId)
        ? cp.questGroupId
        : fallbackGroupId;
    bucketByGroupId.get(targetGroupId)!.push(cp);
  }

  const areaGroupOccurrences = new Map<string, number>();
  const firstGroupOrderForArea = new Map<string, number>();
  for (const def of actDefs) {
    for (const areaId of def.mandatoryAreaIds) {
      areaGroupOccurrences.set(areaId, (areaGroupOccurrences.get(areaId) ?? 0) + 1);
      if (!firstGroupOrderForArea.has(areaId)) {
        firstGroupOrderForArea.set(areaId, def.order);
      }
    }
  }

  const totalGroups = actDefs.length;
  const groups: QuestGroupProgressSummary[] = actDefs.map((def, idx) => {
    const groupCheckpoints = bucketByGroupId.get(def.id) ?? [];
    const mandatoryAreaIds: string[] = [];
    const seenArea = new Set<string>();
    for (const cp of groupCheckpoints) {
      if (
        cp.sectionAct === snapshot.currentAct &&
        cp.isMandatoryGate &&
        def.mandatoryAreaIds.includes(cp.areaId) &&
        !seenArea.has(cp.areaId)
      ) {
        seenArea.add(cp.areaId);
        mandatoryAreaIds.push(cp.areaId);
      }
    }

    const missingMandatoryAreaIds: string[] = [];
    const unvisitedMandatoryAreaIds: string[] = [];

    for (const areaId of mandatoryAreaIds) {
      const gateSteps = groupCheckpoints.filter(
        (cp) => cp.sectionAct === snapshot.currentAct && cp.areaId === areaId && cp.isMandatoryGate,
      );
      const isRepeatVisitHub =
        (areaGroupOccurrences.get(areaId) ?? 0) > 1 && def.order > (firstGroupOrderForArea.get(areaId) ?? def.order);

      const allGateDone = gateSteps.length > 0 && gateSteps.every((cp) => cp.completed);
      const someGateDone = gateSteps.some((cp) => cp.completed);
      const areaSatisfied =
        gateSteps.length === 0
          ? cleared.has(areaId) || visited.has(areaId)
          : allGateDone || (!isRepeatVisitHub && cleared.has(areaId) && someGateDone);

      if (!areaSatisfied) {
        missingMandatoryAreaIds.push(areaId);
        const areaVisitedForGroup = isRepeatVisitHub ? someGateDone : visited.has(areaId);
        if (!areaVisitedForGroup) {
          unvisitedMandatoryAreaIds.push(areaId);
        }
      }
    }

    const isSatisfied = missingMandatoryAreaIds.length === 0;
    return {
      groupId: def.id,
      groupIndex: idx,
      totalGroups,
      titleEn: def.titleEn,
      titlePtBr: def.titlePtBr,
      checkpoints: groupCheckpoints,
      mandatoryAreaIds,
      missingMandatoryAreaIds,
      unvisitedMandatoryAreaIds,
      isSatisfied,
      isBlockedByUnvisited: !isSatisfied && unvisitedMandatoryAreaIds.length > 0,
    };
  });

  let activeGroupIndex = groups.findIndex((g) => !g.isSatisfied);
  if (activeGroupIndex === -1) {
    activeGroupIndex = groups.findIndex((g) => g.checkpoints.some((cp) => !cp.completed));
  }
  const activeGroup = activeGroupIndex !== -1 ? groups[activeGroupIndex]! : null;

  let isHoldingForUnvisitedMandatory = false;
  if (activeGroup && activeGroup.isBlockedByUnvisited) {
    const currentIdx = findAreaGroupIndex(snapshot.currentAreaId, groups, visited);
    const lastCombatIdx = findAreaGroupIndex(snapshot.lastCombatZoneId, groups, visited);
    const visitedLaterGroupArea = groups
      .slice(activeGroupIndex + 1)
      .some((g) => g.mandatoryAreaIds.some((id) => !activeGroup.mandatoryAreaIds.includes(id) && visited.has(id)));
    isHoldingForUnvisitedMandatory =
      currentIdx > activeGroupIndex || lastCombatIdx > activeGroupIndex || visitedLaterGroupArea;
  }

  return { groups, activeGroupIndex, activeGroup, isHoldingForUnvisitedMandatory };
}
