import {
  applySavedCampaignProgress,
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPobPreviewSummary,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  extractCampaignProgress,
  extractPobBuild,
  filterExtractedPobBuildBySelection,
  parsePoelabDailyJson,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reconcilePobSetSelection,
  reduceTelemetrySession,
  resetSnapshotProgress,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
  type PobBuildPreview,
  type PobSetSelection,
  type ValidatedPobBuild,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { DEFAULT_STARTER_POB_XML } from "./pob_profile_persistence_client.js";

export { DEFAULT_STARTER_POB_XML };
export { applyGggCharacterResponseToSnapshot } from "./ggg_character_sync_reducer.js";

export interface CompiledProfileBundle {
  build: ValidatedPobBuild;
  snapshot: HudSessionSnapshot;
  decodedXml: string;
  preview: PobBuildPreview;
  selection: PobSetSelection;
}

/** Decodes raw PoB/XML/URL (or cached XML) and summarizes selectable Passive, Skill, and Item sets. */
export async function inspectPobBuildSets(params: {
  rawPobInput: string;
  cachedXml?: string | null;
  previousSelection?: PobSetSelection | null;
}): Promise<{ decodedXml: string; preview: PobBuildPreview; selection: PobSetSelection }> {
  const source = params.cachedXml?.trim() ? params.cachedXml : params.rawPobInput;
  const decoded = await resolveAndDecodePobInput(source);
  const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
  return {
    decodedXml: decoded.xmlString,
    preview: buildPobPreviewSummary(extracted),
    selection: reconcilePobSetSelection(extracted, params.previousSelection),
  };
}

export async function compilePobProfileToSnapshot(params: {
  roomId: string;
  profileId: string;
  rawPobInput: string;
  cachedXml?: string | null;
  selection?: PobSetSelection | null;
  customRouteText?: string;
  leagueStart: boolean;
  characterName?: string;
  previousSnapshot?: HudSessionSnapshot | null;
}): Promise<CompiledProfileBundle> {
  const source = params.cachedXml?.trim() ? params.cachedXml : params.rawPobInput;
  const decoded = await resolveAndDecodePobInput(source);
  const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
  const preview = buildPobPreviewSummary(extracted);
  const selection = reconcilePobSetSelection(extracted, params.selection);
  const filtered = filterExtractedPobBuildBySelection(extracted, selection);
  const build = validateAndEnrichPobBuild(filtered, poe1GameAdapter);

  const defs = buildPreprocessorDefinitions({
    leagueStart: params.leagueStart,
    bandit: build.bandit,
    includeLibrary: build.requiresAct3Library,
  });
  const combinedRoute = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles(), params.customRouteText);
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(combinedRoute, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, poe1GameAdapter);

  const fresh = buildInitialSessionSnapshot({
    roomId: params.roomId,
    profileId: params.profileId,
    build,
    checkpoints,
    gemSteps,
    adapter: poe1GameAdapter,
    characterName: params.characterName || params.previousSnapshot?.characterName,
  });

  if (!params.previousSnapshot) {
    return {
      build,
      snapshot: { ...fresh, leagueStart: params.leagueStart },
      decodedXml: decoded.xmlString,
      preview,
      selection,
    };
  }

  const prevVerifiedGems = new Map(
    params.previousSnapshot.gemSteps.map((gs) => [
      gs.id,
      { verifiedByApi: gs.verifiedByApi, acquiredLocation: gs.acquiredLocation },
    ]),
  );
  const carriedGemSteps = fresh.gemSteps.map((gs) => {
    const prev = prevVerifiedGems.get(gs.id);
    return prev
      ? { ...gs, verifiedByApi: prev.verifiedByApi, acquiredLocation: prev.acquiredLocation }
      : gs;
  });

  return {
    build,
    decodedXml: decoded.xmlString,
    preview,
    selection,
    snapshot: applySavedCampaignProgress(
      {
        ...fresh,
        gemSteps: carriedGemSteps,
        leagueStart: params.leagueStart,
        poeRunning: params.previousSnapshot.poeRunning,
        clientLogHooked: params.previousSnapshot.clientLogHooked,
        autoClipboardEnabled: params.previousSnapshot.autoClipboardEnabled,
        currentAreaId: params.previousSnapshot.currentAreaId,
        currentAreaName: params.previousSnapshot.currentAreaName,
        currentAreaLevel: params.previousSnapshot.currentAreaLevel,
        currentAct: params.previousSnapshot.currentAct,
        highestUnlockedAct: params.previousSnapshot.highestUnlockedAct,
        visitedAreaIds: params.previousSnapshot.visitedAreaIds ?? [],
        clearedAreaIds: params.previousSnapshot.clearedAreaIds ?? [],
        mode: params.previousSnapshot.mode,
        runElapsedMs: params.previousSnapshot.runElapsedMs,
        runTimerRunning: params.previousSnapshot.runTimerRunning,
        actSplitsMs: params.previousSnapshot.actSplitsMs,
      },
      extractCampaignProgress(params.previousSnapshot),
    ),
  };
}

export function deriveTrayIndicator(snapshot: HudSessionSnapshot, relayConnected: boolean): {
  status: "gray" | "green" | "amber";
  tooltip: string;
} {
  if (!snapshot.poeRunning) {
    return { status: "gray", tooltip: "Exile Relay — PoE Standby" };
  }
  if (!relayConnected || snapshot.characterSyncStatus === "OFFLINE_FALLBACK") {
    return {
      status: "amber",
      tooltip: `Exile Relay — Degraded (${relayConnected ? "API Fallback" : "Relay Disconnected"})`,
    };
  }
  return {
    status: "green",
    tooltip: `Exile Relay — Live (${snapshot.currentAreaName})`,
  };
}

export function applyViewerCommandToSnapshot(
  cur: HudSessionSnapshot,
  cmd: ViewerToRoomMessage,
): { nextSnapshot?: HudSessionSnapshot; eventTag?: string; copyRegex?: string; requestSync?: boolean } {
  if (cmd.type === "viewer:toggle_checkpoint") {
    return {
      nextSnapshot: reduceTelemetrySession(
        cur,
        { type: "toggle_checkpoint", checkpointId: cmd.checkpointId, completed: cmd.completed },
        poe1GameAdapter,
      ),
      eventTag: "viewer_checkpoint",
    };
  }
  if (cmd.type === "viewer:toggle_gem") {
    return {
      nextSnapshot: reduceTelemetrySession(
        cur,
        { type: "toggle_gem", gemStepId: cmd.gemStepId, completed: cmd.completed },
        poe1GameAdapter,
      ),
      eventTag: "viewer_gem",
    };
  }
  if (cmd.type === "viewer:reset_progress") {
    return {
      nextSnapshot: resetSnapshotProgress(cur),
      eventTag: "viewer_reset_progress",
    };
  }
  if (cmd.type === "viewer:request_character_sync") {
    return { requestSync: true };
  }
  if (cmd.type === "viewer:request_regex_copy") {
    return { copyRegex: cmd.regex ?? cur.activeVendorRegex };
  }
  if (cmd.type === "viewer:import_poelab_daily") {
    const lab = parsePoelabDailyJson(cmd.rawJson);
    return {
      nextSnapshot: { ...cur, version: cur.version + 1, lab },
      eventTag: "poelab_import",
    };
  }
  return {};
}

