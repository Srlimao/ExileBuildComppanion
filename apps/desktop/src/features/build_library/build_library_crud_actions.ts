import { flushPendingProgressSave } from "../host_coordinator/campaign_progress_persistence_client.js";
import {
  createBuildFolderIpc,
  deleteBuildFolderIpc,
  deleteBuildIpc,
  duplicateBuildIpc,
  renameBuildFolderIpc,
  renameOrMoveBuildIpc,
} from "./build_library_ipc_client.js";
import { createNewBuildId, type BuildLibraryEntrySummary } from "./build_library_types.js";

export async function duplicateBuildEntry(
  entry: BuildLibraryEntrySummary,
  copyLabel: string,
): Promise<void> {
  await duplicateBuildIpc({
    sourcePath: entry.relativePath,
    targetFolder: entry.folderPath,
    newName: `${entry.name} (${copyLabel})`,
    copyProgress: false,
    newId: createNewBuildId(),
  });
}

export async function moveBuildEntry(
  relativePath: string,
  targetFolder: string,
): Promise<string> {
  const namePart = relativePath.split("/").pop()?.replace(/\.json$/i, "") ?? "Build";
  const moved = await renameOrMoveBuildIpc({
    fromPath: relativePath,
    targetFolder,
    newName: namePart,
  });
  return moved.relativePath;
}

export async function deleteBuildEntry(params: {
  relativePath: string;
  activeBuildPath: string | null;
  clearActiveBuildRef: () => void;
  ensureValidActive: (nextActive: string | null) => Promise<void>;
  refreshListing: () => Promise<unknown>;
}): Promise<void> {
  const wasActive = params.relativePath === params.activeBuildPath;
  if (wasActive) {
    await flushPendingProgressSave();
    params.clearActiveBuildRef();
  }
  const nextActive = await deleteBuildIpc(params.relativePath);
  if (wasActive) {
    await params.ensureValidActive(nextActive);
  } else {
    await params.refreshListing();
  }
}

export async function createFolderEntry(parentFolder: string, folderName: string): Promise<void> {
  await createBuildFolderIpc(parentFolder, folderName);
}

export async function renameFolderEntry(params: {
  oldFolder: string;
  newName: string;
  currentFolder: string;
  setCurrentFolder: (folder: string) => void;
}): Promise<void> {
  const nextPath = await renameBuildFolderIpc(params.oldFolder, params.newName);
  if (params.currentFolder === params.oldFolder) {
    params.setCurrentFolder(nextPath);
  } else if (params.currentFolder.startsWith(`${params.oldFolder}/`)) {
    params.setCurrentFolder(
      `${nextPath}/${params.currentFolder.slice(params.oldFolder.length + 1)}`,
    );
  }
}

export async function deleteFolderEntry(params: {
  folderPath: string;
  recursive: boolean;
  activeBuildPath: string | null;
  currentFolder: string;
  clearActiveBuildRef: () => void;
  setCurrentFolder: (folder: string) => void;
  ensureValidActive: (nextActive: string | null) => Promise<void>;
  refreshListing: () => Promise<unknown>;
}): Promise<void> {
  const activeInside =
    params.activeBuildPath?.toLowerCase().startsWith(`${params.folderPath.toLowerCase()}/`) ??
    false;
  if (activeInside) {
    await flushPendingProgressSave();
    params.clearActiveBuildRef();
  }
  const nextActive = await deleteBuildFolderIpc(params.folderPath, params.recursive);
  if (
    params.currentFolder === params.folderPath ||
    params.currentFolder.startsWith(`${params.folderPath}/`)
  ) {
    params.setCurrentFolder("");
  }
  if (activeInside) {
    await params.ensureValidActive(nextActive);
  } else {
    await params.refreshListing();
  }
}
