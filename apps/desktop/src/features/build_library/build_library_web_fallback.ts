import { createEmptyCampaignProgress } from "@exile-hud/core";
import type {
  BuildLibraryEntrySummary,
  BuildLibraryListing,
  BuildProgressPatch,
  SavedBuildFileRecord,
} from "./build_library_types.js";
import {
  WEB_BUILD_LIBRARY_KEY,
  findBuildKeyCI,
  folderOfRelPathWeb,
  normalizeBuildPathWeb,
  normalizeFolderWeb,
  pickNextActiveBuildKey,
  readWebLibraryStore,
  sanitizeSegmentWeb,
  toBuildEntrySummaryWeb,
  writeWebLibraryStore,
} from "./build_library_web_storage_core.js";

export { WEB_BUILD_LIBRARY_KEY };

export function listBuildLibraryWeb(): BuildLibraryListing {
  const store = readWebLibraryStore();
  const builds = Object.entries(store.files)
    .map(([rel, rec]) => toBuildEntrySummaryWeb(rel, rec))
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const activeKey = store.activeBuildPath ? findBuildKeyCI(store.files, store.activeBuildPath) : null;
  const resolvedActive = activeKey ?? pickNextActiveBuildKey(store.files);
  if (resolvedActive !== store.activeBuildPath) {
    store.activeBuildPath = resolvedActive;
    writeWebLibraryStore(store);
  }
  return {
    rootDir: `Browser localStorage (${WEB_BUILD_LIBRARY_KEY})`,
    activeBuildPath: resolvedActive,
    folders: [...store.folders].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    builds,
  };
}

export function loadBuildFileWeb(relativePath: string): SavedBuildFileRecord {
  const store = readWebLibraryStore();
  const norm = normalizeBuildPathWeb(relativePath);
  const key = findBuildKeyCI(store.files, norm);
  if (!key) throw new Error(`Build file not found: ${norm}`);
  return store.files[key]!;
}

export function saveBuildFileWeb(
  folderPath: string,
  record: SavedBuildFileRecord,
  overwritePath?: string | null,
  setActive = false,
): BuildLibraryEntrySummary {
  const store = readWebLibraryStore();
  const folder = normalizeFolderWeb(folderPath);
  if (folder && !store.folders.some((f) => f.toLowerCase() === folder.toLowerCase())) {
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const sub = parts.slice(0, i).join("/");
      if (!store.folders.some((f) => f.toLowerCase() === sub.toLowerCase())) store.folders.push(sub);
    }
  }
  let name = sanitizeSegmentWeb(record.name);
  if (!overwritePath) {
    const base = name;
    let idx = 2;
    while (findBuildKeyCI(store.files, folder ? `${folder}/${name}.json` : `${name}.json`)) {
      name = `${base} (${idx++})`;
    }
  }
  const targetRel = folder ? `${folder}/${name}.json` : `${name}.json`;
  if (overwritePath) {
    const oldNorm = normalizeBuildPathWeb(overwritePath);
    const oldKey = findBuildKeyCI(store.files, oldNorm);
    const collision = findBuildKeyCI(store.files, targetRel);
    if (collision && collision.toLowerCase() !== oldNorm.toLowerCase()) {
      throw new Error("A build with that name already exists in this folder");
    }
    if (oldKey) delete store.files[oldKey];
    if (store.activeBuildPath?.toLowerCase() === oldNorm.toLowerCase()) {
      store.activeBuildPath = targetRel;
    }
  }
  const nextRecord: SavedBuildFileRecord = { ...record, schemaVersion: 1, name };
  store.files[targetRel] = nextRecord;
  if (setActive) store.activeBuildPath = targetRel;
  store.migrated = true;
  writeWebLibraryStore(store);
  return toBuildEntrySummaryWeb(targetRel, nextRecord);
}

export function updateBuildProgressWeb(relativePath: string, patch: BuildProgressPatch): void {
  const store = readWebLibraryStore();
  const key = findBuildKeyCI(store.files, normalizeBuildPathWeb(relativePath));
  if (!key) throw new Error(`Build file not found: ${relativePath}`);
  const cur = store.files[key]!;
  store.files[key] = {
    ...cur,
    ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
    ...(patch.runElapsedMs !== undefined ? { runElapsedMs: patch.runElapsedMs } : {}),
    ...(patch.actSplitsMs !== undefined ? { actSplitsMs: patch.actSplitsMs } : {}),
    ...(patch.characterName !== undefined ? { characterName: patch.characterName } : {}),
    ...(patch.selectedLeague !== undefined ? { selectedLeague: patch.selectedLeague } : {}),
    updatedAtMs: patch.updatedAtMs,
  };
  writeWebLibraryStore(store);
}

export function renameOrMoveBuildWeb(
  fromPath: string,
  targetFolder: string,
  newName: string,
  nowMs: number,
): BuildLibraryEntrySummary {
  const cur = loadBuildFileWeb(fromPath);
  return saveBuildFileWeb(targetFolder, { ...cur, name: newName, updatedAtMs: nowMs }, fromPath, false);
}

export function duplicateBuildWeb(
  sourcePath: string,
  targetFolder: string,
  newName: string,
  copyProgress: boolean,
  newId: string,
  nowMs: number,
): BuildLibraryEntrySummary {
  const cur = loadBuildFileWeb(sourcePath);
  const next: SavedBuildFileRecord = {
    ...cur,
    id: newId,
    name: newName,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    ...(copyProgress
      ? {}
      : {
          progress: createEmptyCampaignProgress(nowMs),
          runElapsedMs: 0,
          actSplitsMs: {},
          characterName: "",
          summary: {
            ...cur.summary,
            completedCheckpoints: 0,
            completedGems: 0,
            currentAct: 1,
            currentAreaName: "",
          },
        }),
  };
  return saveBuildFileWeb(targetFolder, next, null, false);
}

export function deleteBuildWeb(relativePath: string): string | null {
  const store = readWebLibraryStore();
  const norm = normalizeBuildPathWeb(relativePath);
  const key = findBuildKeyCI(store.files, norm);
  if (!key) throw new Error(`Build file not found: ${norm}`);
  delete store.files[key];
  if (store.activeBuildPath?.toLowerCase() === norm.toLowerCase()) {
    store.activeBuildPath = pickNextActiveBuildKey(store.files);
  }
  writeWebLibraryStore(store);
  return store.activeBuildPath;
}

export function createBuildFolderWeb(parentFolder: string, folderName: string): string {
  const store = readWebLibraryStore();
  const parent = normalizeFolderWeb(parentFolder);
  const clean = sanitizeSegmentWeb(folderName);
  const rel = parent ? `${parent}/${clean}` : clean;
  if (store.folders.some((f) => f.toLowerCase() === rel.toLowerCase())) {
    throw new Error("Folder already exists");
  }
  store.folders.push(rel);
  writeWebLibraryStore(store);
  return rel;
}

export function renameBuildFolderWeb(oldFolder: string, newName: string): string {
  const store = readWebLibraryStore();
  const oldNorm = normalizeFolderWeb(oldFolder);
  if (!oldNorm) throw new Error("Cannot rename root folder");
  const clean = sanitizeSegmentWeb(newName);
  const parent = folderOfRelPathWeb(oldNorm);
  const newNorm = parent ? `${parent}/${clean}` : clean;
  if (
    oldNorm.toLowerCase() !== newNorm.toLowerCase() &&
    store.folders.some((f) => f.toLowerCase() === newNorm.toLowerCase())
  ) {
    throw new Error("A folder with that name already exists");
  }
  const oldPrefix = `${oldNorm.toLowerCase()}/`;
  store.folders = store.folders.map((f) => {
    if (f.toLowerCase() === oldNorm.toLowerCase()) return newNorm;
    if (f.toLowerCase().startsWith(oldPrefix)) return `${newNorm}/${f.slice(oldPrefix.length)}`;
    return f;
  });
  const nextFiles: Record<string, SavedBuildFileRecord> = {};
  for (const [k, v] of Object.entries(store.files)) {
    if (k.toLowerCase().startsWith(oldPrefix)) {
      nextFiles[`${newNorm}/${k.slice(oldPrefix.length)}`] = v;
    } else {
      nextFiles[k] = v;
    }
  }
  store.files = nextFiles;
  if (store.activeBuildPath?.toLowerCase().startsWith(oldPrefix)) {
    store.activeBuildPath = `${newNorm}/${store.activeBuildPath.slice(oldPrefix.length)}`;
  }
  writeWebLibraryStore(store);
  return newNorm;
}

export function deleteBuildFolderWeb(folderPath: string, recursive: boolean): string | null {
  const store = readWebLibraryStore();
  const norm = normalizeFolderWeb(folderPath);
  if (!norm) throw new Error("Cannot delete root folder");
  const prefix = `${norm.toLowerCase()}/`;
  const hasInside =
    store.folders.some((f) => f.toLowerCase().startsWith(prefix)) ||
    Object.keys(store.files).some((k) => k.toLowerCase().startsWith(prefix));
  if (hasInside && !recursive) throw new Error("Folder is not empty");
  store.folders = store.folders.filter(
    (f) => f.toLowerCase() !== norm.toLowerCase() && !f.toLowerCase().startsWith(prefix),
  );
  for (const k of Object.keys(store.files)) {
    if (k.toLowerCase().startsWith(prefix)) delete store.files[k];
  }
  if (store.activeBuildPath?.toLowerCase().startsWith(prefix)) {
    store.activeBuildPath = pickNextActiveBuildKey(store.files);
  }
  writeWebLibraryStore(store);
  return store.activeBuildPath;
}

export function setActiveBuildPathWeb(relativePath: string | null): void {
  const store = readWebLibraryStore();
  if (!relativePath) {
    store.activeBuildPath = null;
  } else {
    const key = findBuildKeyCI(store.files, normalizeBuildPathWeb(relativePath));
    if (!key) throw new Error(`Build file not found: ${relativePath}`);
    store.activeBuildPath = key;
  }
  writeWebLibraryStore(store);
}
