import type { AreaDefinition, GameAdapter } from "@exile-hud/game-data";

export type ParsedClientLogEvent =
  | { type: "area_generated"; areaId: string; areaLevel: number; areaSeed: string }
  | { type: "zone_entered"; areaName: string }
  | { type: "level_up"; characterName: string; characterClass: string; level: number }
  | { type: "skill_points_received"; count: number }
  | { type: "passive_ascendancy_summary"; points: number }
  | { type: "passive_level_summary"; points: number }
  | { type: "passive_quests_header"; points: number }
  | { type: "passive_quest_chat"; points: number; questName: string }
  | { type: "player_slain"; characterName: string };

const GEN_LEVEL_REGEX = /Generating level (\d+) area "([^"]+)" with seed (\d+)/;
const ENTERED_REGEX = /\[(?:INFO|DEBUG) Client \d+\].*?:\s+You have entered ([^.]+)\./;
const LEVEL_UP_REGEX = /\[(?:INFO|DEBUG) Client \d+\].*?:\s+(.+?)\s+\(([^)]+)\)\s+is now level (\d+)/;
const SKILL_POINTS_REGEX = /\[(?:INFO|DEBUG) Client \d+\].*?:\s+You have received (\d+|a) passive skill points?\./i;
const SLAIN_REGEX = /\[(?:INFO|DEBUG) Client \d+\].*?:\s+(.+?)\s+has been slain\./;
const PASSIVE_ASCENDANCY_SUMMARY_REGEX =
  /\[INFO Client \d+\]\s*:\s+(\d+)\s+total\s+Ascendancy\s+Skill\s+Points?\b/i;
const PASSIVE_LEVEL_SUMMARY_REGEX =
  /\[INFO Client \d+\]\s*:\s+(\d+)\s+(?:Passive Skill Points?\s+)?from\s+character\s+level:?$/i;
const PASSIVE_QUESTS_HEADER_REGEX =
  /\[INFO Client \d+\]\s*:\s+(\d+)\s+(?:Passive Skill Points?\s+)?from\s+quests:?$/i;
const PASSIVE_QUEST_CHAT_REGEX =
  /\[INFO Client \d+\]\s*:\s+\(?(\d+)\s+(?:Passive Skill Points?\s+)?from\s+([^)]+?)\)?\.?$/i;

export function parseClientLogLine(rawLine: string): ParsedClientLogEvent | null {
  const line = rawLine.trim();
  if (!line) return null;

  const genMatch = GEN_LEVEL_REGEX.exec(line);
  if (genMatch?.[1] && genMatch[2] && genMatch[3]) {
    return {
      type: "area_generated",
      areaLevel: Number.parseInt(genMatch[1], 10),
      areaId: genMatch[2],
      areaSeed: genMatch[3],
    };
  }

  const enteredMatch = ENTERED_REGEX.exec(line);
  if (enteredMatch?.[1]) {
    return { type: "zone_entered", areaName: enteredMatch[1].trim() };
  }

  const lvlMatch = LEVEL_UP_REGEX.exec(line);
  if (lvlMatch?.[1] && lvlMatch[2] && lvlMatch[3]) {
    return {
      type: "level_up",
      characterName: lvlMatch[1].trim(),
      characterClass: lvlMatch[2].trim(),
      level: Number.parseInt(lvlMatch[3], 10),
    };
  }

  const skillMatch = SKILL_POINTS_REGEX.exec(line);
  if (skillMatch?.[1]) {
    const rawCount = skillMatch[1].toLowerCase();
    return { type: "skill_points_received", count: rawCount === "a" ? 1 : Number.parseInt(rawCount, 10) };
  }

  const slainMatch = SLAIN_REGEX.exec(line);
  if (slainMatch?.[1]) {
    return { type: "player_slain", characterName: slainMatch[1].trim() };
  }

  const ascendancyMatch = PASSIVE_ASCENDANCY_SUMMARY_REGEX.exec(line);
  if (ascendancyMatch?.[1]) {
    return {
      type: "passive_ascendancy_summary",
      points: Number.parseInt(ascendancyMatch[1], 10),
    };
  }

  const levelSummaryMatch = PASSIVE_LEVEL_SUMMARY_REGEX.exec(line);
  if (levelSummaryMatch?.[1]) {
    return {
      type: "passive_level_summary",
      points: Number.parseInt(levelSummaryMatch[1], 10),
    };
  }

  const questsHeaderMatch = PASSIVE_QUESTS_HEADER_REGEX.exec(line);
  if (questsHeaderMatch?.[1]) {
    return {
      type: "passive_quests_header",
      points: Number.parseInt(questsHeaderMatch[1], 10),
    };
  }

  const passiveChatMatch = PASSIVE_QUEST_CHAT_REGEX.exec(line);
  if (passiveChatMatch?.[1] && passiveChatMatch[2]) {
    return {
      type: "passive_quest_chat",
      points: Number.parseInt(passiveChatMatch[1], 10),
      questName: passiveChatMatch[2].trim(),
    };
  }

  return null;
}

export function isTownOrHideoutArea(areaId: string, adapter: GameAdapter): boolean {
  if (/hideout/i.test(areaId)) return true;
  const area = adapter.resolveAreaById(areaId);
  return area?.is_town_area ?? false;
}

export function isLabyrinthArea(areaId: string): boolean {
  return /labyrinth/i.test(areaId) || /^Sanctum_\d/i.test(areaId) || /^G3_10$/i.test(areaId);
}

export interface ZoneDisambiguationContext {
  highestUnlockedAct: number;
  lastCombatZoneId: string | null;
  characterLevel: number;
}

export function disambiguateZoneByName(
  zoneName: string,
  context: ZoneDisambiguationContext,
  adapter: GameAdapter,
): AreaDefinition | null {
  if (/hideout/i.test(zoneName)) {
    return {
      id: "Hideout",
      name: zoneName,
      map_name: null,
      act: context.highestUnlockedAct,
      level: context.characterLevel,
      has_waypoint: true,
      is_town_area: true,
      parent_town_area_id: null,
      connection_ids: [],
      crafting_recipes: [],
    };
  }

  const candidates = adapter.resolveAreasByName(zoneName);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const lastCombatArea = context.lastCombatZoneId ? adapter.resolveAreaById(context.lastCombatZoneId) : null;
  const isPoe1 = adapter.gameId === "poe1";
  const prefersPart2 = isPoe1 && (context.highestUnlockedAct >= 6 || context.characterLevel >= 44);

  const scored = candidates.map((cand) => {
    let score = 0;
    if (lastCombatArea && cand.act === lastCombatArea.act) score += 50;
    if (cand.act === context.highestUnlockedAct) score += 35;
    if (isPoe1) {
      if (prefersPart2 && cand.act >= 6) score += 25;
      if (!prefersPart2 && cand.act <= 5) score += 25;
    }
    score -= Math.abs(cand.act - context.highestUnlockedAct) * 5;
    return { cand, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.cand;
}
