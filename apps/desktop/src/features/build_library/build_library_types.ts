import {
  countCompletedProgress,
  type HudSessionSnapshot,
  type PobSetSelection,
  type SavedCampaignProgress,
} from "@exile-hud/core";

export interface BuildProgressSummary {
  characterClass: string;
  ascendancyName: string;
  buildLevel: number;
  completedCheckpoints: number;
  totalCheckpoints: number;
  completedGems: number;
  totalGems: number;
  currentAct: number;
  currentAreaName: string;
}

export interface SavedBuildFileRecord {
  schemaVersion: number;
  id: string;
  name: string;
  notes: string;
  rawInput: string;
  cachedXml: string | null;
  leagueStart: boolean;
  customRouteText: string;
  selection: PobSetSelection | null;
  characterName: string;
  selectedLeague: string;
  summary: BuildProgressSummary;
  progress: SavedCampaignProgress;
  runElapsedMs: number;
  actSplitsMs: Record<string, number>;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildLibraryEntrySummary {
  relativePath: string;
  folderPath: string;
  id: string;
  name: string;
  notes: string;
  leagueStart: boolean;
  characterName: string;
  selectedLeague: string;
  summary: BuildProgressSummary;
  runElapsedMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildLibraryListing {
  rootDir: string;
  activeBuildPath: string | null;
  folders: string[];
  builds: BuildLibraryEntrySummary[];
}

export interface BuildProgressPatch {
  progress?: SavedCampaignProgress;
  summary?: BuildProgressSummary;
  runElapsedMs?: number;
  actSplitsMs?: Record<string, number>;
  characterName?: string;
  selectedLeague?: string;
  updatedAtMs: number;
}

export type BuildSortKey = "updated" | "name" | "class" | "level";

export type BuildEditorMode =
  | { kind: "closed" }
  | { kind: "create"; targetFolder: string }
  | { kind: "edit"; targetPath: string; targetFolder: string; record: SavedBuildFileRecord };

export function createEmptyBuildProgressSummary(): BuildProgressSummary {
  return {
    characterClass: "",
    ascendancyName: "",
    buildLevel: 1,
    completedCheckpoints: 0,
    totalCheckpoints: 0,
    completedGems: 0,
    totalGems: 0,
    currentAct: 1,
    currentAreaName: "",
  };
}

export function buildSummaryFromSnapshot(snapshot: HudSessionSnapshot): BuildProgressSummary {
  const counts = countCompletedProgress(snapshot);
  return {
    characterClass: snapshot.characterClass,
    ascendancyName: snapshot.ascendancyName,
    buildLevel: snapshot.characterLevel,
    completedCheckpoints: counts.completedCheckpoints,
    totalCheckpoints: counts.totalCheckpoints,
    completedGems: counts.completedGems,
    totalGems: counts.totalGems,
    currentAct: snapshot.currentAct || 1,
    currentAreaName: snapshot.currentAreaName,
  };
}

export function createNewBuildId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getChildFolders(allFolders: readonly string[], currentFolder: string): string[] {
  const prefix = currentFolder ? `${currentFolder}/` : "";
  return allFolders
    .filter((folder) => {
      if (prefix) {
        if (!folder.startsWith(prefix)) return false;
        const rest = folder.slice(prefix.length);
        return rest.length > 0 && !rest.includes("/");
      }
      return folder.length > 0 && !folder.includes("/");
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function getFolderBreadcrumbs(currentFolder: string): Array<{ label: string; path: string }> {
  if (!currentFolder) return [];
  const parts = currentFolder.split("/").filter(Boolean);
  return parts.map((label, idx) => ({
    label,
    path: parts.slice(0, idx + 1).join("/"),
  }));
}

export function getParentFolderPath(currentFolder: string): string {
  const idx = currentFolder.lastIndexOf("/");
  return idx === -1 ? "" : currentFolder.slice(0, idx);
}

export function countBuildsInFolder(
  builds: readonly BuildLibraryEntrySummary[],
  folderPath: string,
): number {
  const prefix = `${folderPath.toLowerCase()}/`;
  const target = folderPath.toLowerCase();
  return builds.filter((b) => {
    const f = b.folderPath.toLowerCase();
    return f === target || f.startsWith(prefix);
  }).length;
}

export function filterAndSortBuilds(
  builds: readonly BuildLibraryEntrySummary[],
  currentFolder: string,
  searchQuery: string,
  sortKey: BuildSortKey,
): BuildLibraryEntrySummary[] {
  const needle = searchQuery.trim().toLowerCase();
  const filtered = builds.filter((b) => {
    if (!needle) {
      return b.folderPath === currentFolder;
    }
    const haystack = [
      b.name,
      b.summary.characterClass,
      b.summary.ascendancyName,
      b.characterName,
      b.selectedLeague,
      b.notes,
      b.folderPath,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return [...filtered].sort((a, b) => {
    if (sortKey === "name") {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    if (sortKey === "class") {
      const ca = a.summary.ascendancyName || a.summary.characterClass;
      const cb = b.summary.ascendancyName || b.summary.characterClass;
      return ca.localeCompare(cb, undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name);
    }
    if (sortKey === "level") {
      return b.summary.buildLevel - a.summary.buildLevel || a.name.localeCompare(b.name);
    }
    return b.updatedAtMs - a.updatedAtMs;
  });
}
