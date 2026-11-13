import type { GameAdapter } from "@exile-hud/game-data";
import type { CheckpointCategory, CheckpointStepItem } from "../protocol/session_room_wire_protocol.js";
import type { ParsedRouteStep } from "../route_compiler/route_fragment_ast_parser.js";

function classifyStepCategory(step: ParsedRouteStep, skillBookQuestIds: ReadonlySet<string>): {
  category: CheckpointCategory;
  questId?: string;
} {
  for (const frag of step.fragments) {
    if (frag.type === "trial") {
      return { category: "LAB_TRIAL" };
    }
    if (frag.type === "quest") {
      if (skillBookQuestIds.has(frag.questId)) {
        return { category: "SKILL_BOOK", questId: frag.questId };
      }
      return { category: "MANDATORY_PATH", questId: frag.questId };
    }
    if (frag.type === "waypoint_get" || frag.type === "crafting") {
      return { category: "WAYPOINT_RECIPE" };
    }
  }
  return { category: "MANDATORY_PATH" };
}

export function buildCheckpointGraph(routeSteps: ParsedRouteStep[], adapter: GameAdapter): CheckpointStepItem[] {
  const skillBookIds = adapter.getSkillBookQuestIds();
  const checkpoints: CheckpointStepItem[] = [];

  for (const step of routeSteps) {
    const { category, questId } = classifyStepCategory(step, skillBookIds);
    checkpoints.push({
      id: step.id,
      sectionAct: step.sectionAct,
      areaId: step.areaId,
      areaName: step.areaName,
      category,
      title: step.renderedText,
      subNotes: step.subNotes,
      directions: step.directions,
      questId,
      completed: false,
      softCompleted: false,
    });
  }

  return checkpoints;
}
