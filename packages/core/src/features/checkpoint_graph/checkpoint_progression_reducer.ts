import type { GameAdapter } from "@exile-hud/game-data";
import type { HudContextMode, HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { computeNextTownCurrencyBudget } from "../route_compiler/gem_quest_and_vendor_assigner.js";
import { buildVendorSearchRegex } from "../vendor_regex/vendor_search_regex_builder.js";
import { resetSnapshotProgress } from "./campaign_progress_persistence.js";
import {
  evaluateZoneTransitionCheckpoints,
  selectSkillBookCheckpointForCompletion,
} from "./checkpoint_progression_evaluator.js";
import {
  reconcilePassiveQuestChatLine,
  syncLabTelemetryWithProgress,
} from "./lab_and_passives_reconciler.js";
import type { ParsedClientLogEvent } from "./zone_context_disambiguator.js";
import { disambiguateZoneByName, isLabyrinthArea, isTownOrHideoutArea } from "./zone_context_disambiguator.js";

export type TelemetryAction =
  | { type: "client_log"; event: ParsedClientLogEvent; autoDetectCharacter: boolean; nowMs?: number }
  | { type: "process_state"; running: boolean; nowMs?: number }
  | { type: "toggle_checkpoint"; checkpointId: string; completed?: boolean }
  | { type: "toggle_gem"; gemStepId: string; completed?: boolean }
  | { type: "reset_progress" }
  | { type: "in_game_tree_state"; open: boolean }
  | { type: "tick_timer"; deltaMs: number };

export function computeEffectiveMode(areaId: string, poeRunning: boolean, adapter: GameAdapter): HudContextMode {
  if (!poeRunning) return "STANDBY";
  if (isLabyrinthArea(areaId)) return "LAB";
  if (isTownOrHideoutArea(areaId, adapter)) return "TOWN";
  return "FIELD";
}

function transitionToZone(
  state: HudSessionSnapshot,
  areaId: string,
  areaName: string,
  areaLevel: number,
  areaAct: number,
  areaSeed: string | null,
  isTown: boolean,
  isLab: boolean,
  adapter: GameAdapter,
  nowMs: number,
): HudSessionSnapshot {
  const prevWasTown = isTownOrHideoutArea(state.currentAreaId, adapter);
  const isHideout = /hideout/i.test(areaId);
  const nextHighestAct = isHideout
    ? state.highestUnlockedAct
    : Math.max(state.highestUnlockedAct, areaAct || state.highestUnlockedAct);

  const evaluation = evaluateZoneTransitionCheckpoints({
    state,
    enteredAreaId: areaId,
    nextHighestAct,
    isTownOrHideout: isTown,
    adapter,
  });
  const checkpoints = evaluation.checkpoints;

  let gemSteps = state.gemSteps;
  if (prevWasTown && !isTown && state.characterSyncStatus !== "ONLINE_PUBLIC" && state.characterSyncStatus !== "ONLINE_POESESSID") {
    gemSteps = state.gemSteps.map((gs) =>
      gs.act <= nextHighestAct && !gs.verifiedByApi && !gs.manualCompleted ? { ...gs, softAcquired: true } : gs,
    );
  }

  const actSplitsMs = { ...state.actSplitsMs };
  if (areaAct > state.highestUnlockedAct && state.highestUnlockedAct >= 1 && !actSplitsMs[`act_${state.highestUnlockedAct}`]) {
    actSplitsMs[`act_${state.highestUnlockedAct}`] = state.runElapsedMs || nowMs;
  }

  let resumeZoneBanner = state.resumeZoneBanner;
  let recentDeath = state.recentDeath;
  if (isTown && state.recentDeath && state.lastCombatZoneId && state.lastCombatZoneName) {
    resumeZoneBanner = { areaId: state.lastCombatZoneId, areaName: state.lastCombatZoneName };
    recentDeath = false;
  } else if (!isTown) {
    resumeZoneBanner = null;
    recentDeath = false;
  }

  const mode: HudContextMode = !state.poeRunning ? "STANDBY" : isLab ? "LAB" : isTown ? "TOWN" : "FIELD";
  const zoneLayoutPaths = adapter.getZoneLayoutVariants(areaId);
  const lab = syncLabTelemetryWithProgress({
    lab: state.lab,
    checkpoints,
    clearedAreaIds: evaluation.clearedAreaIds,
    enteredAreaId: areaId,
    adapter,
  });

  return {
    ...state,
    version: state.version + 1,
    mode,
    inGameTreeOpen: false,
    currentAreaId: areaId,
    currentAreaName: areaName,
    currentAreaLevel: areaLevel > 0 ? areaLevel : state.currentAreaLevel,
    currentAreaSeed: areaSeed,
    currentAct: areaAct || state.currentAct,
    highestUnlockedAct: nextHighestAct,
    lastCombatZoneId: isTown ? state.lastCombatZoneId : areaId,
    lastCombatZoneName: isTown ? state.lastCombatZoneName : areaName,
    visitedAreaIds: evaluation.visitedAreaIds,
    clearedAreaIds: evaluation.clearedAreaIds,
    recentDeath,
    resumeZoneBanner,
    checkpoints,
    gemSteps,
    lab,
    nextTownCurrencyBudget: computeNextTownCurrencyBudget(gemSteps, nextHighestAct),
    activeVendorRegex: buildVendorSearchRegex({
      gemSteps,
      linkGroups: state.linkGroups,
      currentAct: nextHighestAct,
    }),
    actSplitsMs,
    zoneLayoutPaths,
  };
}

export function reduceTelemetrySession(
  state: HudSessionSnapshot,
  action: TelemetryAction,
  adapter: GameAdapter,
): HudSessionSnapshot {
  if (action.type === "tick_timer") {
    if (!state.runTimerRunning || !state.poeRunning) return state;
    return { ...state, runElapsedMs: state.runElapsedMs + Math.max(0, action.deltaMs) };
  }

  if (action.type === "process_state") {
    const isTown = isTownOrHideoutArea(state.currentAreaId, adapter);
    const isLab = isLabyrinthArea(state.currentAreaId);
    const mode: HudContextMode = !action.running ? "STANDBY" : isLab ? "LAB" : isTown ? "TOWN" : "FIELD";
    return {
      ...state,
      version: state.version + 1,
      poeRunning: action.running,
      runTimerRunning: action.running,
      mode,
      inGameTreeOpen: action.running ? Boolean(state.inGameTreeOpen) : false,
    };
  }

  if (action.type === "in_game_tree_state") {
    if (Boolean(state.inGameTreeOpen) === action.open) return state;
    return { ...state, version: state.version + 1, inGameTreeOpen: action.open };
  }

  if (action.type === "reset_progress") {
    return resetSnapshotProgress(state);
  }

  if (action.type === "toggle_checkpoint") {
    const checkpoints = state.checkpoints.map((cp) =>
      cp.id === action.checkpointId
        ? { ...cp, completed: action.completed ?? !cp.completed, softCompleted: false }
        : cp,
    );
    const lab = syncLabTelemetryWithProgress({
      lab: state.lab,
      checkpoints,
      clearedAreaIds: state.clearedAreaIds ?? [],
      enteredAreaId: state.currentAreaId,
      adapter,
    });
    return { ...state, version: state.version + 1, checkpoints, lab };
  }

  if (action.type === "toggle_gem") {
    const gemSteps = state.gemSteps.map((gs) => {
      if (gs.id !== action.gemStepId) return gs;
      const nextDone = action.completed ?? !(gs.manualCompleted || gs.softAcquired);
      return { ...gs, manualCompleted: nextDone, softAcquired: false };
    });
    return {
      ...state,
      version: state.version + 1,
      gemSteps,
      nextTownCurrencyBudget: computeNextTownCurrencyBudget(gemSteps, state.highestUnlockedAct),
      activeVendorRegex: buildVendorSearchRegex({
        gemSteps,
        linkGroups: state.linkGroups,
        currentAct: state.highestUnlockedAct,
      }),
    };
  }

  const nowMs = action.nowMs ?? Date.now();
  const ev = action.event;

  if (ev.type === "area_generated") {
    const known = adapter.resolveAreaById(ev.areaId);
    const areaName = known?.name ?? (/hideout/i.test(ev.areaId) ? "Hideout" : ev.areaId);
    const areaAct = known?.act && known.act > 0 ? known.act : state.currentAct;
    const isTown = isTownOrHideoutArea(ev.areaId, adapter);
    const isLab = isLabyrinthArea(ev.areaId);
    return transitionToZone(state, ev.areaId, areaName, ev.areaLevel, areaAct, ev.areaSeed, isTown, isLab, adapter, nowMs);
  }

  if (ev.type === "zone_entered") {
    if (/hideout/i.test(state.currentAreaId) && /hideout/i.test(ev.areaName)) {
      return state.currentAreaName === ev.areaName
        ? state
        : { ...state, version: state.version + 1, currentAreaName: ev.areaName };
    }
    const resolved = disambiguateZoneByName(
      ev.areaName,
      {
        highestUnlockedAct: state.highestUnlockedAct,
        lastCombatZoneId: state.lastCombatZoneId,
        characterLevel: state.characterLevel,
      },
      adapter,
    );
    if (!resolved) return state;
    if (resolved.id === state.currentAreaId) {
      return state.currentAreaName === resolved.name
        ? state
        : { ...state, version: state.version + 1, currentAreaName: resolved.name };
    }
    const isTown = resolved.is_town_area || /hideout/i.test(resolved.id);
    const isLab = isLabyrinthArea(resolved.id);
    return transitionToZone(
      state,
      resolved.id,
      resolved.name,
      resolved.level,
      resolved.act || state.currentAct,
      null,
      isTown,
      isLab,
      adapter,
      nowMs,
    );
  }

  if (ev.type === "level_up") {
    return {
      ...state,
      version: state.version + 1,
      characterLevel: ev.level,
      characterName: action.autoDetectCharacter ? ev.characterName : state.characterName,
    };
  }

  if (ev.type === "player_slain") {
    return { ...state, version: state.version + 1, recentDeath: true };
  }

  if (ev.type === "skill_points_received") {
    const idx = selectSkillBookCheckpointForCompletion(state);
    if (idx === -1) return state;
    const checkpoints = state.checkpoints.map((cp, i) =>
      i === idx ? { ...cp, completed: true, softCompleted: false } : cp,
    );
    return { ...state, version: state.version + 1, checkpoints };
  }

  if (ev.type === "passive_quest_chat") {
    return reconcilePassiveQuestChatLine(state, ev.points, ev.questName, adapter);
  }

  return state;
}
