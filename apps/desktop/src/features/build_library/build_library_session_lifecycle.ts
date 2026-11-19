import {
  applySavedCampaignProgress,
  createEmptyCampaignProgress,
  extractCampaignProgress,
  type HudSessionSnapshot,
  type ValidatedPobBuild,
} from "@exile-hud/core";
import { flushPendingProgressSave } from "../host_coordinator/campaign_progress_persistence_client.js";
import {
  bootstrapHostEnvironment,
  syncBuildSetsForLevel,
} from "../host_coordinator/client_log_sync_helper.js";
import {
  compilePobProfileToSnapshot,
  DEFAULT_STARTER_POB_XML,
} from "../host_coordinator/desktop_telemetry_bridge.js";
import type { BuildEditorSubmitPayload } from "./build_library_editor_panel.js";
import {
  listBuildLibraryIpc,
  loadBuildFileIpc,
  saveBuildFileIpc,
  updateBuildProgressIpc,
} from "./build_library_ipc_client.js";
import {
  buildSummaryFromSnapshot,
  createEmptyBuildProgressSummary,
  createNewBuildId,
  type BuildLibraryListing,
  type SavedBuildFileRecord,
} from "./build_library_types.js";

export function createStarterBuildRecord(nowMs: number): SavedBuildFileRecord {
  return {
    schemaVersion: 1,
    id: createNewBuildId(),
    name: "Starter RF Elementalist",
    notes: "",
    rawInput: DEFAULT_STARTER_POB_XML,
    cachedXml: DEFAULT_STARTER_POB_XML,
    leagueStart: true,
    customRouteText: "",
    selection: null,
    characterName: "",
    selectedLeague: "",
    summary: createEmptyBuildProgressSummary(),
    progress: createEmptyCampaignProgress(nowMs),
    runElapsedMs: 0,
    actSplitsMs: {},
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

export async function flushOutgoingBuildToDisk(
  activePath: string | null,
  liveSnap: HudSessionSnapshot | null,
): Promise<void> {
  await flushPendingProgressSave();
  if (!activePath || !liveSnap) return;
  await updateBuildProgressIpc(activePath, {
    progress: extractCampaignProgress(liveSnap, { wasExplicitlyReset: false }),
    summary: buildSummaryFromSnapshot(liveSnap),
    runElapsedMs: liveSnap.runElapsedMs,
    actSplitsMs: liveSnap.actSplitsMs,
    characterName: liveSnap.characterName,
    updatedAtMs: Date.now(),
  }).catch(() => undefined);
}

export async function compileAndHydrateBuildRecord(params: {
  roomId: string;
  record: SavedBuildFileRecord;
  previousSnapshot: HudSessionSnapshot | null;
}): Promise<{ build: ValidatedPobBuild; snapshot: HudSessionSnapshot }> {
  const compiled = await compilePobProfileToSnapshot({
    roomId: params.roomId,
    profileId: params.record.id,
    rawPobInput: params.record.rawInput,
    cachedXml: params.record.cachedXml,
    selection: params.record.selection,
    customRouteText: params.record.customRouteText,
    leagueStart: params.record.leagueStart,
    characterName: params.record.characterName || undefined,
    previousSnapshot: params.previousSnapshot,
    carryProgressFromPrevious: false,
  });
  const synced = syncBuildSetsForLevel(compiled.snapshot, compiled.build);
  const withProgress = applySavedCampaignProgress(synced, params.record.progress);
  return {
    build: compiled.build,
    snapshot: {
      ...withProgress,
      characterName: params.record.characterName || withProgress.characterName,
      runElapsedMs: params.record.runElapsedMs ?? 0,
      actSplitsMs: params.record.actSplitsMs ?? {},
    },
  };
}

export async function bootstrapLibrarySession(roomId: string): Promise<{
  activePath: string;
  record: SavedBuildFileRecord;
  build: ValidatedPobBuild;
  snapshot: HudSessionSnapshot;
  listing: BuildLibraryListing;
  detectedLogPath: string | null;
  clientLogHooked: boolean;
}> {
  let listing = await listBuildLibraryIpc();
  if (listing.builds.length === 0) {
    const starter = createStarterBuildRecord(Date.now());
    await saveBuildFileIpc({ folderPath: "", record: starter, setActive: true });
    listing = await listBuildLibraryIpc();
  }

  let targetPath = listing.activeBuildPath ?? listing.builds[0]!.relativePath;
  let record: SavedBuildFileRecord;
  try {
    record = await loadBuildFileIpc(targetPath);
  } catch {
    const starter = createStarterBuildRecord(Date.now());
    const saved = await saveBuildFileIpc({ folderPath: "", record: starter, setActive: true });
    targetPath = saved.relativePath;
    record = starter;
  }

  const compiled = await compilePobProfileToSnapshot({
    roomId,
    profileId: record.id,
    rawPobInput: record.rawInput,
    cachedXml: record.cachedXml,
    selection: record.selection,
    customRouteText: record.customRouteText,
    leagueStart: record.leagueStart,
    characterName: record.characterName || undefined,
  });
  const env = await bootstrapHostEnvironment(compiled.snapshot);
  const synced = syncBuildSetsForLevel(env.snapshot, compiled.build);
  const withProgress = applySavedCampaignProgress(synced, record.progress);
  const hydrated: HudSessionSnapshot = {
    ...withProgress,
    characterName: record.characterName || withProgress.characterName,
    runElapsedMs: record.runElapsedMs ?? 0,
    actSplitsMs: record.actSplitsMs ?? {},
  };

  await updateBuildProgressIpc(targetPath, {
    summary: buildSummaryFromSnapshot(hydrated),
    characterName: hydrated.characterName,
    updatedAtMs: record.updatedAtMs || Date.now(),
  }).catch(() => undefined);

  return {
    activePath: targetPath,
    record,
    build: compiled.build,
    snapshot: hydrated,
    listing: await listBuildLibraryIpc(),
    detectedLogPath: env.detectedPath,
    clientLogHooked: env.hooked,
  };
}

export async function saveBuildEditorRecord(params: {
  roomId: string;
  payload: BuildEditorSubmitPayload;
  activeBuildPath: string | null;
  currentSnapshot: HudSessionSnapshot | null;
  liveSnapshot: HudSessionSnapshot | null;
}): Promise<{
  relativePath: string;
  isEditingActive: boolean;
  compiledBuild: ValidatedPobBuild;
  activeSnapshot: HudSessionSnapshot;
}> {
  const { roomId, payload, activeBuildPath, currentSnapshot, liveSnapshot } = params;
  const now = Date.now();
  const editMode = payload.mode.kind === "edit" ? payload.mode : null;
  const isEditingActive = Boolean(editMode && editMode.targetPath === activeBuildPath);

  const baseRecord = editMode
    ? isEditingActive
      ? editMode.record
      : await loadBuildFileIpc(editMode.targetPath)
    : null;
  const preservedProgress =
    isEditingActive && liveSnapshot
      ? extractCampaignProgress(liveSnapshot, { wasExplicitlyReset: false })
      : baseRecord?.progress ?? createEmptyCampaignProgress(now);
  const preservedElapsed =
    isEditingActive && liveSnapshot ? liveSnapshot.runElapsedMs : baseRecord?.runElapsedMs ?? 0;
  const preservedSplits =
    isEditingActive && liveSnapshot ? liveSnapshot.actSplitsMs : baseRecord?.actSplitsMs ?? {};

  const compiled = await compilePobProfileToSnapshot({
    roomId,
    profileId: baseRecord?.id ?? createNewBuildId(),
    rawPobInput: payload.rawInput,
    cachedXml: payload.cachedXml,
    selection: payload.selection,
    customRouteText: payload.customRouteText,
    leagueStart: payload.leagueStart,
    characterName: payload.characterName || undefined,
    previousSnapshot: isEditingActive ? currentSnapshot : null,
    carryProgressFromPrevious: isEditingActive,
  });

  const baseSnap = isEditingActive
    ? {
        ...compiled.snapshot,
        characterName: payload.characterName || compiled.snapshot.characterName,
      }
    : applySavedCampaignProgress(compiled.snapshot, preservedProgress);

  const nextRecord: SavedBuildFileRecord = {
    schemaVersion: 1,
    id: baseRecord?.id ?? compiled.snapshot.profileId,
    name: payload.name,
    notes: payload.notes,
    rawInput: payload.rawInput || compiled.decodedXml,
    cachedXml: compiled.decodedXml,
    leagueStart: payload.leagueStart,
    customRouteText: payload.customRouteText,
    selection: compiled.selection,
    characterName: payload.characterName,
    selectedLeague: payload.selectedLeague,
    summary: buildSummaryFromSnapshot({
      ...baseSnap,
      runElapsedMs: preservedElapsed,
      actSplitsMs: preservedSplits,
    }),
    progress: preservedProgress,
    runElapsedMs: preservedElapsed,
    actSplitsMs: preservedSplits,
    createdAtMs: baseRecord?.createdAtMs ?? now,
    updatedAtMs: now,
  };

  const saved = await saveBuildFileIpc({
    folderPath: payload.folderPath,
    record: nextRecord,
    overwritePath: editMode ? editMode.targetPath : null,
    setActive: isEditingActive || payload.activateAfterSave,
  });
  const synced = syncBuildSetsForLevel(baseSnap, compiled.build);

  return {
    relativePath: saved.relativePath,
    isEditingActive,
    compiledBuild: compiled.build,
    activeSnapshot: {
      ...synced,
      characterName: payload.characterName || synced.characterName,
      runElapsedMs: preservedElapsed,
      actSplitsMs: preservedSplits,
    },
  };
}
