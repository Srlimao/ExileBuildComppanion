import type { SupportedGameId } from "@exile-hud/core";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";
import type {
  BuildLibraryEntrySummary,
  BuildLibraryListing,
  BuildProgressPatch,
  SavedBuildFileRecord,
} from "./build_library_types.js";
import {
  createBuildFolderWeb,
  deleteBuildFolderWeb,
  deleteBuildWeb,
  duplicateBuildWeb,
  listBuildLibraryWeb,
  loadBuildFileWeb,
  renameBuildFolderWeb,
  renameOrMoveBuildWeb,
  saveBuildFileWeb,
  setActiveBuildPathWeb,
  updateBuildProgressWeb,
} from "./build_library_web_fallback.js";

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function listBuildLibraryIpc(
  gameId: SupportedGameId = "poe1",
): Promise<BuildLibraryListing> {
  if (!isTauriRuntime()) return listBuildLibraryWeb(gameId);
  return invokeTauri<BuildLibraryListing>("list_build_library", { gameId });
}

export async function loadBuildFileIpc(
  relativePath: string,
  gameId: SupportedGameId = "poe1",
): Promise<SavedBuildFileRecord> {
  if (!isTauriRuntime()) return loadBuildFileWeb(relativePath, gameId);
  return invokeTauri<SavedBuildFileRecord>("load_build_file", { relativePath, gameId });
}

export async function saveBuildFileIpc(params: {
  folderPath: string;
  record: SavedBuildFileRecord;
  overwritePath?: string | null;
  setActive: boolean;
  gameId?: SupportedGameId;
}): Promise<BuildLibraryEntrySummary> {
  const gameId = params.gameId ?? params.record.gameId ?? "poe1";
  if (!isTauriRuntime()) {
    return saveBuildFileWeb(
      params.folderPath,
      params.record,
      params.overwritePath ?? null,
      params.setActive,
      gameId,
    );
  }
  return invokeTauri<BuildLibraryEntrySummary>("save_build_file", {
    folderPath: params.folderPath,
    record: params.record,
    overwritePath: params.overwritePath ?? null,
    setActive: params.setActive,
    gameId,
  });
}

export async function updateBuildProgressIpc(
  relativePath: string,
  patch: BuildProgressPatch,
  gameId: SupportedGameId = "poe1",
): Promise<void> {
  if (!isTauriRuntime()) {
    updateBuildProgressWeb(relativePath, patch, gameId);
    return;
  }
  await invokeTauri("update_build_progress", { relativePath, patch, gameId });
}

export async function renameOrMoveBuildIpc(params: {
  fromPath: string;
  targetFolder: string;
  newName: string;
  nowMs?: number;
  gameId?: SupportedGameId;
}): Promise<BuildLibraryEntrySummary> {
  const nowMs = params.nowMs ?? Date.now();
  const gameId = params.gameId ?? "poe1";
  if (!isTauriRuntime()) {
    return renameOrMoveBuildWeb(params.fromPath, params.targetFolder, params.newName, nowMs, gameId);
  }
  return invokeTauri<BuildLibraryEntrySummary>("rename_or_move_build", {
    fromPath: params.fromPath,
    targetFolder: params.targetFolder,
    newName: params.newName,
    nowMs,
    gameId,
  });
}

export async function duplicateBuildIpc(params: {
  sourcePath: string;
  targetFolder: string;
  newName: string;
  copyProgress: boolean;
  newId: string;
  nowMs?: number;
  gameId?: SupportedGameId;
}): Promise<BuildLibraryEntrySummary> {
  const nowMs = params.nowMs ?? Date.now();
  const gameId = params.gameId ?? "poe1";
  if (!isTauriRuntime()) {
    return duplicateBuildWeb(
      params.sourcePath,
      params.targetFolder,
      params.newName,
      params.copyProgress,
      params.newId,
      nowMs,
      gameId,
    );
  }
  return invokeTauri<BuildLibraryEntrySummary>("duplicate_build", {
    sourcePath: params.sourcePath,
    targetFolder: params.targetFolder,
    newName: params.newName,
    copyProgress: params.copyProgress,
    newId: params.newId,
    nowMs,
    gameId,
  });
}

export async function deleteBuildIpc(
  relativePath: string,
  gameId: SupportedGameId = "poe1",
): Promise<string | null> {
  if (!isTauriRuntime()) return deleteBuildWeb(relativePath, gameId);
  return invokeTauri<string | null>("delete_build", { relativePath, gameId });
}

export async function createBuildFolderIpc(
  parentFolder: string,
  folderName: string,
  gameId: SupportedGameId = "poe1",
): Promise<string> {
  if (!isTauriRuntime()) return createBuildFolderWeb(parentFolder, folderName, gameId);
  return invokeTauri<string>("create_build_folder", { parentFolder, folderName, gameId });
}

export async function renameBuildFolderIpc(
  oldFolder: string,
  newName: string,
  gameId: SupportedGameId = "poe1",
): Promise<string> {
  if (!isTauriRuntime()) return renameBuildFolderWeb(oldFolder, newName, gameId);
  return invokeTauri<string>("rename_build_folder", { oldFolder, newName, gameId });
}

export async function deleteBuildFolderIpc(
  folderPath: string,
  recursive: boolean,
  gameId: SupportedGameId = "poe1",
): Promise<string | null> {
  if (!isTauriRuntime()) return deleteBuildFolderWeb(folderPath, recursive, gameId);
  return invokeTauri<string | null>("delete_build_folder", { folderPath, recursive, gameId });
}

export async function setActiveBuildPathIpc(
  relativePath: string | null,
  gameId: SupportedGameId = "poe1",
): Promise<void> {
  if (!isTauriRuntime()) {
    setActiveBuildPathWeb(relativePath, gameId);
    return;
  }
  await invokeTauri("set_active_build_path", { relativePath, gameId });
}

export async function openBuildsLibraryFolderIpc(
  gameId: SupportedGameId = "poe1",
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeTauri<string>("open_builds_library_folder", { gameId });
}
