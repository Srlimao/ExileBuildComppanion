import type { GameAdapter } from "@exile-hud/game-data";
import type {
  CheckpointCategory,
  CheckpointStepItem,
  CheckpointStepKind,
} from "../protocol/session_room_wire_protocol.js";
import type { ParsedFragment, ParsedRouteStep } from "../route_compiler/route_fragment_ast_parser.js";
import { isTownOrHideoutArea } from "./zone_context_disambiguator.js";

interface StepCategoryInfo {
  category: CheckpointCategory;
  questId?: string;
  rewardOffers: string[];
  ascendVersion?: string;
  labyrinthBossRecipes: string[];
}

interface RouteVisitBlock {
  startIdx: number;
  endIdx: number;
  areaId: string;
  expectedExitAreaId?: string;
  blockPrerequisiteAreaIds: string[];
  visitIndex: number;
  totalVisitsForArea: number;
}

const ASCEND_VERSION_TO_BOSS_AREA: Readonly<Record<string, string>> = {
  normal: "1_Labyrinth_boss_3",
  cruel: "2_Labyrinth_boss_3",
  merciless: "3_Labyrinth_boss_3",
  uber: "EndGame_Labyrinth_boss_3",
};

function classifyStepCategory(step: ParsedRouteStep, adapter: GameAdapter): StepCategoryInfo {
  for (const frag of step.fragments) {
    if (frag.type === "ascend") {
      return {
        category: "LAB_TRIAL",
        rewardOffers: [],
        ascendVersion: frag.version,
        labyrinthBossRecipes: [],
      };
    }
    if (frag.type === "trial") {
      return { category: "LAB_TRIAL", rewardOffers: [], labyrinthBossRecipes: [] };
    }
    if (frag.type === "quest") {
      const isSkillBook = adapter.isSkillBookQuestOffer(frag.questId, frag.rewardOffers);
      return {
        category: isSkillBook ? "SKILL_BOOK" : "MANDATORY_PATH",
        questId: frag.questId,
        rewardOffers: frag.rewardOffers,
        labyrinthBossRecipes: [],
      };
    }
    if (frag.type === "waypoint_get" || frag.type === "crafting") {
      const labBossRecipes =
        frag.type === "crafting"
          ? frag.recipes.filter((recipe) => /_Labyrinth_boss_/i.test(recipe))
          : [];
      if (labBossRecipes.length > 0) {
        return {
          category: "LAB_TRIAL",
          rewardOffers: [],
          labyrinthBossRecipes: labBossRecipes,
        };
      }
      return { category: "WAYPOINT_RECIPE", rewardOffers: [], labyrinthBossRecipes: [] };
    }
  }
  return { category: "MANDATORY_PATH", rewardOffers: [], labyrinthBossRecipes: [] };
}

function isSubstantiveObjectiveFragment(frag: ParsedFragment): boolean {
  return (
    frag.type === "kill" ||
    frag.type === "arena" ||
    frag.type === "trial" ||
    frag.type === "waypoint_get" ||
    frag.type === "crafting" ||
    frag.type === "quest_text" ||
    frag.type === "portal_set" ||
    frag.type === "generic"
  );
}

function classifyStepKind(step: ParsedRouteStep, info: StepCategoryInfo): CheckpointStepKind {
  if (info.ascendVersion !== undefined || info.labyrinthBossRecipes.length > 0) {
    return "ascend";
  }
  if (info.questId !== undefined) {
    return "quest_turn_in";
  }
  const entersCurrentArea = step.fragments.some(
    (frag) => frag.type === "enter" && frag.areaId === step.areaId,
  );
  if (entersCurrentArea) {
    return "zone_entry";
  }
  const hasObjective = step.fragments.some(isSubstantiveObjectiveFragment);
  const hasTravelLead = step.fragments.some(
    (frag) => frag.type === "waypoint_use" || frag.type === "portal_use" || frag.type === "logout",
  );
  if (!hasObjective && hasTravelLead) {
    return "travel_lead_in";
  }
  return "objective";
}

function isSingleExitDeadEndOf(areaId: string, parentAreaId: string, adapter: GameAdapter): boolean {
  const area = adapter.getAreas()[areaId];
  if (!area || area.is_town_area || area.connection_ids.length === 0) return false;
  return area.connection_ids.every((conn) => conn === parentAreaId || conn === areaId);
}

function computeVisitBlocks(routeSteps: ParsedRouteStep[]): RouteVisitBlock[] {
  const blocks: RouteVisitBlock[] = [];
  const countByArea = new Map<string, number>();

  let i = 0;
  while (i < routeSteps.length) {
    const startIdx = i;
    const areaId = routeSteps[i]!.areaId;
    while (i + 1 < routeSteps.length && routeSteps[i + 1]!.areaId === areaId) {
      i += 1;
    }
    const endIdx = i;
    const nextStep = endIdx + 1 < routeSteps.length ? routeSteps[endIdx + 1] : undefined;
    const visitIndex = countByArea.get(areaId) ?? 0;
    countByArea.set(areaId, visitIndex + 1);

    const blockText = routeSteps
      .slice(startIdx, endIdx + 1)
      .map((s) => s.renderedText)
      .join(" ");
    const blockPrerequisiteAreaIds: string[] = [];
    if (areaId === "1_3_10_1" && /Undying Blockage/i.test(blockText)) {
      blockPrerequisiteAreaIds.push("1_3_8_2");
    }
    if (areaId === "2_10_2" && /Innocence/i.test(blockText)) {
      blockPrerequisiteAreaIds.push("2_10_4");
    }

    blocks.push({
      startIdx,
      endIdx,
      areaId,
      expectedExitAreaId: nextStep?.areaId,
      blockPrerequisiteAreaIds,
      visitIndex,
      totalVisitsForArea: 1,
    });
    i += 1;
  }

  for (const block of blocks) {
    block.totalVisitsForArea = countByArea.get(block.areaId) ?? 1;
  }
  return blocks;
}

function mergeAreaIds(...lists: Array<readonly string[]>): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

function computeStepPrerequisitesAndDetour(
  step: ParsedRouteStep,
  stepKind: CheckpointStepKind,
  info: StepCategoryInfo,
  block: RouteVisitBlock,
  prevBlock: RouteVisitBlock | undefined,
  adapter: GameAdapter,
): { prerequisiteAreaIds?: string[]; isOptionalDetour?: boolean } {
  const extraPrereqs: string[] = [];
  let isOptionalDetour = false;

  if (stepKind === "quest_turn_in" && info.questId) {
    extraPrereqs.push(...adapter.getQuestPrerequisiteAreaIds(info.questId, info.rewardOffers));
  }
  if (stepKind === "ascend") {
    isOptionalDetour = true;
    const bossArea = info.ascendVersion ? ASCEND_VERSION_TO_BOSS_AREA[info.ascendVersion] : undefined;
    if (bossArea) extraPrereqs.push(bossArea);
    extraPrereqs.push(...info.labyrinthBossRecipes);
  }
  if (
    stepKind === "zone_entry" &&
    prevBlock &&
    isSingleExitDeadEndOf(prevBlock.areaId, step.areaId, adapter)
  ) {
    extraPrereqs.push(prevBlock.areaId);
    isOptionalDetour = true;
  }
  if (step.areaId === "1_1_9" && /Fairgraves|Allflame/i.test(step.renderedText)) {
    extraPrereqs.push("1_1_9a");
    isOptionalDetour = true;
  }
  for (const frag of step.fragments) {
    if (frag.type === "area" && frag.areaId !== step.areaId) {
      extraPrereqs.push(frag.areaId);
      isOptionalDetour = true;
    }
  }
  if (
    block.totalVisitsForArea > 1 &&
    block.visitIndex < block.totalVisitsForArea - 1 &&
    block.expectedExitAreaId &&
    isTownOrHideoutArea(block.expectedExitAreaId, adapter) &&
    stepKind === "objective" &&
    step.fragments.some((frag) => frag.type === "arena" || frag.type === "kill")
  ) {
    isOptionalDetour = true;
  }
  if (info.category === "SKILL_BOOK" || info.category === "LAB_TRIAL") {
    isOptionalDetour = true;
  }

  const prerequisiteAreaIds = mergeAreaIds(block.blockPrerequisiteAreaIds, extraPrereqs);
  return {
    ...(prerequisiteAreaIds ? { prerequisiteAreaIds } : {}),
    ...(isOptionalDetour ? { isOptionalDetour: true } : {}),
  };
}

/** Builds a graph-annotated checkpoint list with visit-block exit expectations and prerequisites. */
export function buildCheckpointGraph(routeSteps: ParsedRouteStep[], adapter: GameAdapter): CheckpointStepItem[] {
  const blocks = computeVisitBlocks(routeSteps);
  const checkpoints: CheckpointStepItem[] = [];

  for (let bIdx = 0; bIdx < blocks.length; bIdx += 1) {
    const block = blocks[bIdx]!;
    const prevBlock = bIdx > 0 ? blocks[bIdx - 1] : undefined;
    for (let sIdx = block.startIdx; sIdx <= block.endIdx; sIdx += 1) {
      const step = routeSteps[sIdx]!;
      const info = classifyStepCategory(step, adapter);
      const stepKind = classifyStepKind(step, info);
      const meta = computeStepPrerequisitesAndDetour(step, stepKind, info, block, prevBlock, adapter);

      checkpoints.push({
        id: step.id,
        sectionAct: step.sectionAct,
        areaId: step.areaId,
        areaName: step.areaName,
        category: info.category,
        title: step.renderedText,
        subNotes: step.subNotes,
        directions: step.directions,
        questId: info.questId,
        stepKind,
        ...(block.expectedExitAreaId ? { expectedExitAreaId: block.expectedExitAreaId } : {}),
        ...meta,
        completed: false,
        softCompleted: false,
      });
    }
  }

  return checkpoints;
}
