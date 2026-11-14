import {
  applySavedCampaignProgress,
  assignGemsToCampaignRoute,
  auditGearAndFlaskHygiene,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPobPreviewSummary,
  buildPreprocessorDefinitions,
  buildVendorSearchRegex,
  combineRouteActFiles,
  computePassiveTreeDiff,
  estimateEquippedResistances,
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
  verifySocketsAndGems,
  type GggItemModRecord,
  type HudSessionSnapshot,
  type PobBuildPreview,
  type PobSetSelection,
  type ValidatedPobBuild,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  extractAllocatedMasteriesFromPassives,
  markEquippedItemSets,
} from "./client_log_sync_helper.js";
import { DEFAULT_STARTER_POB_XML } from "./pob_profile_persistence_client.js";
import type { CharacterPollResponse } from "./tauri_ipc_adapter.js";

export { DEFAULT_STARTER_POB_XML };

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
    params.previousSnapshot.gemSteps.map((gs) => [gs.id, gs.verifiedByApi]),
  );
  const carriedGemSteps = fresh.gemSteps.map((gs) => ({
    ...gs,
    verifiedByApi: prevVerifiedGems.get(gs.id) ?? gs.verifiedByApi,
  }));

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
      },
      extractCampaignProgress(params.previousSnapshot),
    ),
  };
}

export function applyGggCharacterResponseToSnapshot(
  snapshot: HudSessionSnapshot,
  build: ValidatedPobBuild,
  response: CharacterPollResponse,
): HudSessionSnapshot {
  if (!response.ok || !response.itemsJson) {
    return {
      ...snapshot,
      version: snapshot.version + 1,
      characterSyncStatus: "OFFLINE_FALLBACK",
    };
  }

  const items = (Array.isArray(response.itemsJson.items) ? response.itemsJson.items : []) as GggItemModRecord[];
  const charMeta = response.itemsJson.character as { level?: number; name?: string } | undefined;
  const characterLevel = typeof charMeta?.level === "number" ? charMeta.level : snapshot.characterLevel;
  const allocatedHashes = Array.isArray(response.passivesJson?.hashes)
    ? (response.passivesJson.hashes as number[])
    : [];

  const completedBossFlags: string[] = [];
  if (snapshot.highestUnlockedAct >= 6) completedBossFlags.push("kitava_act5");
  if (snapshot.highestUnlockedAct >= 11) completedBossFlags.push("kitava_act10");

  const resistances = estimateEquippedResistances({
    items,
    allocatedNodeIds: allocatedHashes,
    bandit: build.bandit,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    completedBossFlags,
    adapter: poe1GameAdapter,
  });

  const gemVerification = verifySocketsAndGems({
    items,
    skillSets: build.skillSets,
    gemSteps: snapshot.gemSteps,
    characterLevel,
  });

  const passiveTree = computePassiveTreeDiff({
    treeSpecs: build.treeSpecs,
    allocatedHashes,
    allocatedMasteries: extractAllocatedMasteriesFromPassives(response.passivesJson),
    characterLevel,
    adapter: poe1GameAdapter,
  });

  const gearHygiene = auditGearAndFlaskHygiene({
    items,
    characterLevel,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    isAttackBuild: build.characterClass === "Ranger" || build.characterClass === "Duelist",
  });

  const activeVendorRegex = buildVendorSearchRegex({
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    currentAct: snapshot.currentAct,
  });

  return {
    ...snapshot,
    version: snapshot.version + 1,
    characterName: charMeta?.name || snapshot.characterName,
    characterLevel,
    characterSyncStatus: response.usedPoesessid ? "ONLINE_POESESSID" : "ONLINE_PUBLIC",
    lastCharacterSyncAt: Date.now(),
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    itemSets: markEquippedItemSets(build.itemSets, items),
    resistances,
    gearHygiene,
    passiveTree,
    activeVendorRegex,
  };
}

export function deriveTrayIndicator(snapshot: HudSessionSnapshot, relayConnected: boolean): {
  status: "gray" | "green" | "amber";
  tooltip: string;
} {
  if (!snapshot.poeRunning) {
    return { status: "gray", tooltip: "Exile Companion HUD — PoE Standby" };
  }
  if (!relayConnected || snapshot.characterSyncStatus === "OFFLINE_FALLBACK") {
    return {
      status: "amber",
      tooltip: `Exile Companion HUD — Degraded (${relayConnected ? "API Fallback" : "Relay Disconnected"})`,
    };
  }
  return {
    status: "green",
    tooltip: `Exile Companion HUD — Live (${snapshot.currentAreaName})`,
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

