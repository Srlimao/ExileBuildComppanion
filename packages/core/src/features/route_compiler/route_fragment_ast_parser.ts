import type { GameAdapter } from "@exile-hud/game-data";

export type ParsedFragment =
  | { type: "text"; value: string }
  | { type: "kill"; value: string }
  | { type: "arena"; value: string }
  | { type: "area"; areaId: string; areaName: string }
  | { type: "enter"; areaId: string; areaName: string }
  | { type: "logout"; areaId: string; areaName: string }
  | { type: "waypoint" }
  | { type: "waypoint_use"; dstAreaId: string; dstAreaName: string }
  | { type: "waypoint_get" }
  | { type: "portal_set" }
  | { type: "portal_use"; dstAreaId: string }
  | { type: "quest"; questId: string; questName: string; questNpc?: string; rewardOffers: string[] }
  | { type: "quest_text"; value: string }
  | { type: "generic"; value: string }
  | { type: "reward_quest"; item: string }
  | { type: "reward_vendor"; item: string; cost?: string }
  | { type: "trial" }
  | { type: "ascend"; version: string }
  | { type: "crafting"; recipes: string[] }
  | { type: "dir"; dirDegrees: number }
  | { type: "copy"; text: string };

export interface ParsedRouteStep {
  id: string;
  sectionAct: number;
  sectionName: string;
  areaId: string;
  areaName: string;
  fragments: ParsedFragment[];
  subNotes: string[];
  directions: number[];
  renderedText: string;
}

interface TrackerState {
  currentAreaId: string;
  lastTownAreaId: string;
  portalAreaId: string | null;
}

function formatFragment(fragment: ParsedFragment, prevFragment?: ParsedFragment): string {
  switch (fragment.type) {
    case "text":
      return fragment.value;
    case "kill":
      return `Kill ${fragment.value}`;
    case "arena":
      return fragment.value;
    case "area":
      return fragment.areaName;
    case "enter":
      return `Enter ${fragment.areaName}`;
    case "logout":
      return `Relog to ${fragment.areaName}`;
    case "waypoint":
      return "Waypoint";
    case "waypoint_use":
      return `WP -> ${fragment.dstAreaName}`;
    case "waypoint_get":
      return "Get Waypoint";
    case "portal_set":
      return "Set Portal";
    case "portal_use":
      return "Use Portal";
    case "quest": {
      const label = fragment.questNpc ? `${fragment.questName} (${fragment.questNpc})` : fragment.questName;
      const hasVerbPrefix = prevFragment?.type === "text" && /\b(?:hand|turn)\s+in$/i.test(prevFragment.value);
      return hasVerbPrefix ? label : `Turn in ${label}`;
    }
    case "quest_text":
      return fragment.value;
    case "generic":
      return fragment.value;
    case "reward_quest":
      return `Reward: ${fragment.item}`;
    case "reward_vendor":
      return `Buy: ${fragment.item}`;
    case "trial":
      return "Complete Labyrinth Trial";
    case "ascend":
      return `Complete ${fragment.version} Labyrinth`;
    case "crafting":
      return fragment.recipes.length > 0 ? `Recipe: ${fragment.recipes.join(", ")}` : "Unlock Crafting Recipe";
    case "dir":
      return `${fragment.dirDegrees}°`;
    case "copy":
      return fragment.text;
  }
}

function parseSingleFragment(rawTag: string, adapter: GameAdapter, state: TrackerState): ParsedFragment {
  const parts = rawTag.split("|");
  const kind = parts[0] ?? "";
  const areas = adapter.getAreas();
  const quests = adapter.getQuests();
  const transition = (areaId: string) => {
    const area = areas[areaId];
    if (!area) return "Unknown Area";
    if (area.is_town_area) state.lastTownAreaId = area.id;
    state.currentAreaId = area.id;
    return area.name;
  };

  switch (kind) {
    case "kill":
      return { type: "kill", value: parts[1] ?? "Boss" };
    case "arena":
      return { type: "arena", value: parts[1] ?? "Arena" };
    case "area":
      return { type: "area", areaId: parts[1] ?? "", areaName: areas[parts[1] ?? ""]?.name ?? parts[1] ?? "" };
    case "enter": {
      const areaId = parts[1] ?? state.currentAreaId;
      return { type: "enter", areaId, areaName: transition(areaId) };
    }
    case "logout": {
      const areaName = transition(state.lastTownAreaId);
      state.portalAreaId = null;
      return { type: "logout", areaId: state.lastTownAreaId, areaName };
    }
    case "waypoint":
      if (parts[1]) {
        const dstAreaId = parts[1];
        return { type: "waypoint_use", dstAreaId, dstAreaName: transition(dstAreaId) };
      }
      return { type: "waypoint" };
    case "waypoint_get":
      return { type: "waypoint_get" };
    case "portal": {
      if (parts[1] === "set") {
        state.portalAreaId = state.currentAreaId;
        return { type: "portal_set" };
      }
      const cur = areas[state.currentAreaId];
      if (cur && !cur.is_town_area) {
        state.portalAreaId = cur.id;
        transition(cur.parent_town_area_id ?? state.lastTownAreaId);
      } else if (state.portalAreaId) {
        transition(state.portalAreaId);
        state.portalAreaId = null;
      }
      return { type: "portal_use", dstAreaId: state.currentAreaId };
    }
    case "quest": {
      const questId = parts[1] ?? "";
      const q = quests[questId];
      const rewardOffers = parts.length > 2 ? parts.slice(2) : Object.keys(q?.reward_offers ?? {});
      const npcs = Array.from(
        new Set(
          rewardOffers
            .map((offerId) => q?.reward_offers?.[offerId]?.quest_npc?.trim())
            .filter((npc): npc is string => Boolean(npc)),
        ),
      );
      return {
        type: "quest",
        questId,
        questName: q?.name || questId,
        questNpc: npcs.length > 0 ? npcs.join(" / ") : undefined,
        rewardOffers,
      };
    }
    case "quest_text":
      return { type: "quest_text", value: parts[1] ?? "" };
    case "reward_quest":
      return { type: "reward_quest", item: parts[1] ?? "" };
    case "reward_vendor":
      return { type: "reward_vendor", item: parts[1] ?? "", cost: parts[2] };
    case "trial":
      return { type: "trial" };
    case "ascend": {
      transition(state.lastTownAreaId);
      return { type: "ascend", version: parts[1] ?? "normal" };
    }
    case "crafting": {
      const areaId = parts[1] ?? state.currentAreaId;
      return { type: "crafting", recipes: areas[areaId]?.crafting_recipes ?? [] };
    }
    case "dir": {
      const rawDeg = Number.parseFloat(parts[1] ?? "0") || 0;
      return { type: "dir", dirDegrees: ((rawDeg % 360) + 360) % 360 };
    }
    case "copy":
      return { type: "copy", text: parts.slice(1).join("|") };
    default:
      return { type: "generic", value: parts[1] ?? rawTag };
  }
}

function parseLineFragments(line: string, adapter: GameAdapter, state: TrackerState): ParsedFragment[] {
  const withoutComments = line.replace(/(?:^|\s)#.*$/, (m) => (m.trimStart().startsWith("#") ? "" : m)).trim();
  const fragments: ParsedFragment[] = [];
  const regex = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(withoutComments)) !== null) {
    if (match.index > lastIndex) {
      const text = withoutComments.slice(lastIndex, match.index).replace(/\s+/g, " ").trim();
      if (text) fragments.push({ type: "text", value: text });
    }
    if (match[1]) fragments.push(parseSingleFragment(match[1], adapter, state));
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < withoutComments.length) {
    const tail = withoutComments.slice(lastIndex).replace(/\s+/g, " ").trim();
    if (tail) fragments.push({ type: "text", value: tail });
  }
  return fragments;
}

export function parsePreprocessedRouteLines(lines: string[], adapter: GameAdapter): ParsedRouteStep[] {
  const areas = adapter.getAreas();
  const state: TrackerState = { currentAreaId: "1_1_1", lastTownAreaId: "1_1_town", portalAreaId: null };
  const steps: ParsedRouteStep[] = [];
  let sectionName = "Act 1";
  let sectionAct = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const sectionMatch = /^#section\s+(.+)$/.exec(line);
    if (sectionMatch?.[1]) {
      sectionName = sectionMatch[1].trim();
      const actNumMatch = /(\d+)/.exec(sectionName);
      if (actNumMatch?.[1]) sectionAct = Number.parseInt(actNumMatch[1], 10);
      continue;
    }

    if (line.startsWith("#sub")) {
      const prev = steps[steps.length - 1];
      if (!prev) continue;
      const subBody = line.replace(/^#sub\s*/, "");
      const subFragments = parseLineFragments(subBody, adapter, state);
      for (const frag of subFragments) {
        if (frag.type === "dir") prev.directions.push(frag.dirDegrees);
      }
      const note = subFragments
        .map((frag, idx) => formatFragment(frag, subFragments[idx - 1]))
        .join(" ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      if (note) prev.subNotes.push(note);
      continue;
    }

    if (line.startsWith("#")) continue;

    const areaBefore = state.currentAreaId;
    const fragments = parseLineFragments(line, adapter, state);
    if (fragments.length === 0) continue;

    const stepAreaId = fragments.some((f) => f.type === "quest" || f.type === "reward_quest" || f.type === "reward_vendor")
      ? state.currentAreaId
      : fragments.find((f) => f.type === "enter" || f.type === "waypoint_use")?.type === "enter"
        ? state.currentAreaId
        : areaBefore;

    const areaObj = areas[stepAreaId] ?? areas[state.currentAreaId];
    const renderedText = fragments
      .map((frag, idx) => formatFragment(frag, fragments[idx - 1]))
      .join(" ")
      .replace(/^➞\s*/, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const directions = fragments.filter((f): f is { type: "dir"; dirDegrees: number } => f.type === "dir").map((d) => d.dirDegrees);
    steps.push({
      id: `step_${steps.length + 1}_${stepAreaId}`,
      sectionAct,
      sectionName,
      areaId: areaObj?.id ?? stepAreaId,
      areaName: areaObj?.name ?? stepAreaId,
      fragments,
      subNotes: [],
      directions,
      renderedText,
    });
  }

  return steps;
}
