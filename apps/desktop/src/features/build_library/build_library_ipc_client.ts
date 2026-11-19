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

export async function listBuildLibraryIpc(): Promise<BuildLibraryListing> {
  if (!isTauriRuntime()) return listBuildLibraryWeb();
  return invokeTauri<BuildLibraryListing>("list_build_library");
}

export async function loadBuildFileIpc(relativePath: string): Promise<SavedBuildFileRecord> {
  if (!isTauriRuntime()) return loadBuildFileWeb(relativePath);
  return invokeTauri<SavedBuildFileRecord>("load_build_file", { relativePath });
}

export async function saveBuildFileIpc(params: {
  folderPath: string;
  record: SavedBuildFileRecord;
  overwritePath?: string | null;
  setActive: boolean;
}): Promise<BuildLibraryEntrySummary> {
  if (!isTauriRuntime()) {
    return saveBuildFileWeb(
      params.folderPath,
      params.record,
      params.overwritePath ?? null,
      params.setActive,
    );
  }
  return invokeTauri<BuildLibraryEntrySummary>("save_build_file", {
    folderPath: params.folderPath,
    record: params.record,
    overwritePath: params.overwritePath ?? null,
    setActive: params.setActive,
  });
}

export async function updateBuildProgressIpc(
  relativePath: string,
  patch: BuildProgressPatch,
): Promise<void> {
  if (!isTauriRuntime()) {
    updateBuildProgressWeb(relativePath, patch);
    return;
  }
  await invokeTauri("update_build_progress", { relativePath, patch });
}

export async function renameOrMoveBuildIpc(params: {
  fromPath: string;
  targetFolder: string;
  newName: string;
  nowMs?: number;
}): Promise<BuildLibraryEntrySummary> {
  const nowMs = params.nowMs ?? Date.now();
  if (!isTauriRuntime()) {
    return renameOrMoveBuildWeb(params.fromPath, params.targetFolder, params.newName, nowMs);
  }
  return invokeTauri<BuildLibraryEntrySummary>("rename_or_move_build", {
    fromPath: params.fromPath,
    targetFolder: params.targetFolder,
    newName: params.newName,
    nowMs,
  });
}

export async function duplicateBuildIpc(params: {
  sourcePath: string;
  targetFolder: string;
  newName: string;
  copyProgress: boolean;
  newId: string;
  nowMs?: number;
}): Promise<BuildLibraryEntrySummary> {
  const nowMs = params.nowMs ?? Date.now();
  if (!isTauriRuntime()) {
    return duplicateBuildWeb(
      params.sourcePath,
      params.targetFolder,
      params.newName,
      params.copyProgress,
      params.newId,
      nowMs,
    );
  }
  return invokeTauri<BuildLibraryEntrySummary>("duplicate_build", {
    sourcePath: params.sourcePath,
    targetFolder: params.targetFolder,
    newName: params.newName,
    copyProgress: params.copyProgress,
    newId: params.newId,
    nowMs,
  });
}

export async function deleteBuildIpc(relativePath: string): Promise<string | null> {
  if (!isTauriRuntime()) return deleteBuildWeb(relativePath);
  return invokeTauri<string | null>("delete_build", { relativePath });
}

export async function createBuildFolderIpc(
  parentFolder: string,
  folderName: string,
): Promise<string> {
  if (!isTauriRuntime()) return createBuildFolderWeb(parentFolder, folderName);
  return invokeTauri<string>("create_build_folder", { parentFolder, folderName });
}

export async function renameBuildFolderIpc(oldFolder: string, newName: string): Promise<string> {
  if (!isTauriRuntime()) return renameBuildFolderWeb(oldFolder, newName);
  return invokeTauri<string>("rename_build_folder", { oldFolder, newName });
}

export async function deleteBuildFolderIpc(
  folderPath: string,
  recursive: boolean,
): Promise<string | null> {
  if (!isTauriRuntime()) return deleteBuildFolderWeb(folderPath, recursive);
  return invokeTauri<string | null>("delete_build_folder", { folderPath, recursive });
}

export async function setActiveBuildPathIpc(relativePath: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    setActiveBuildPathWeb(relativePath);
    return;
  }
  await invokeTauri("set_active_build_path", { relativePath });
}

export async function openBuildsLibraryFolderIpc(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeTauri<string>("open_builds_library_folder");
}
