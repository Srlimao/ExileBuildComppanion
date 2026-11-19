import { createEmptyCampaignProgress, type SavedCampaignProgress } from "@exile-hud/core";
import type { BuildLibraryEntrySummary, SavedBuildFileRecord } from "./build_library_types.js";

export const WEB_BUILD_LIBRARY_KEY = "exile_build_library_v1";
const LEGACY_POB_KEY = "exile_saved_pob_profile_v1";
const LEGACY_PROGRESS_KEY = "exile_saved_campaign_progress_v1";

export interface WebBuildLibraryStore {
  migrated: boolean;
  activeBuildPath: string | null;
  folders: string[];
  files: Record<string, SavedBuildFileRecord>;
}

const RESERVED_RE = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export function sanitizeSegmentWeb(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.endsWith(".")) {
    throw new Error("Invalid folder or build name");
  }
  if (trimmed.length > 80) throw new Error("Name exceeds 80 characters");
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
    throw new Error("Name contains unsupported filesystem characters");
  }
  const stem = trimmed.split(".")[0] ?? trimmed;
  if (RESERVED_RE.test(stem)) throw new Error(`'${trimmed}' is reserved on Windows`);
  return trimmed;
}

export function normalizeFolderWeb(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("/") || t.startsWith("\\") || t.includes(":")) {
    throw new Error("Folder path must be relative");
  }
  return t
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .map(sanitizeSegmentWeb)
    .join("/");
}

export function normalizeBuildPathWeb(raw: string): string {
  const parts = raw.trim().split(/[/\\]/);
  const file = parts.pop() ?? "";
  if (!file.toLowerCase().endsWith(".json")) throw new Error("Build file must end with .json");
  const cleanStem = sanitizeSegmentWeb(file.slice(0, -5));
  const cleanFolders = parts.map(sanitizeSegmentWeb);
  return [...cleanFolders, `${cleanStem}.json`].join("/");
}

export function folderOfRelPathWeb(relPath: string): string {
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? "" : relPath.slice(0, idx);
}

export function toBuildEntrySummaryWeb(
  rel: string,
  rec: SavedBuildFileRecord,
): BuildLibraryEntrySummary {
  return {
    relativePath: rel,
    folderPath: folderOfRelPathWeb(rel),
    id: rec.id,
    name: rec.name,
    notes: rec.notes,
    leagueStart: rec.leagueStart,
    characterName: rec.characterName,
    selectedLeague: rec.selectedLeague,
    summary: rec.summary,
    runElapsedMs: rec.runElapsedMs,
    createdAtMs: rec.createdAtMs,
    updatedAtMs: rec.updatedAtMs,
  };
}

export function findBuildKeyCI(
  files: Record<string, SavedBuildFileRecord>,
  rel: string,
): string | null {
  const lower = rel.toLowerCase();
  return Object.keys(files).find((k) => k.toLowerCase() === lower) ?? null;
}

export function pickNextActiveBuildKey(files: Record<string, SavedBuildFileRecord>): string | null {
  const entries = Object.entries(files);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1].updatedAtMs - a[1].updatedAtMs);
  return entries[0]![0];
}

function migrateLegacyWebStorage(store: WebBuildLibraryStore): void {
  if (store.migrated || Object.keys(store.files).length > 0) return;
  store.migrated = true;
  try {
    const rawPob = localStorage.getItem(LEGACY_POB_KEY);
    if (!rawPob) return;
    const pob = JSON.parse(rawPob) as {
      rawInput: string;
      cachedXml?: string | null;
      leagueStart?: boolean;
      customRouteText?: string;
      selection?: SavedBuildFileRecord["selection"];
      updatedAtMs?: number;
    };
    const rawProg = localStorage.getItem(LEGACY_PROGRESS_KEY);
    const progress: SavedCampaignProgress = rawProg
      ? (JSON.parse(rawProg) as SavedCampaignProgress)
      : createEmptyCampaignProgress();
    const m = pob.cachedXml?.match(/buildName="([^"]+)"/);
    let name = "Migrated Build";
    if (m?.[1]) {
      try {
        name = sanitizeSegmentWeb(m[1]);
      } catch {
        name = "Migrated Build";
      }
    }
    const rel = `${name}.json`;
    store.files[rel] = {
      schemaVersion: 1,
      id: "migrated-legacy-build",
      name,
      notes: "",
      rawInput: pob.rawInput,
      cachedXml: pob.cachedXml ?? null,
      leagueStart: pob.leagueStart ?? true,
      customRouteText: pob.customRouteText ?? "",
      selection: pob.selection ?? null,
      characterName: "",
      selectedLeague: "",
      summary: {
        characterClass: "",
        ascendancyName: "",
        buildLevel: 1,
        completedCheckpoints: progress.completedCheckpointIds.length,
        totalCheckpoints: 0,
        completedGems: progress.manualCompletedGemIds.length + progress.softAcquiredGemIds.length,
        totalGems: 0,
        currentAct: 1,
        currentAreaName: "",
      },
      progress,
      runElapsedMs: 0,
      actSplitsMs: {},
      createdAtMs: pob.updatedAtMs ?? Date.now(),
      updatedAtMs: pob.updatedAtMs ?? Date.now(),
    };
    store.activeBuildPath = rel;
  } catch {
    // ignore malformed legacy fallback
  }
}

export function readWebLibraryStore(): WebBuildLibraryStore {
  try {
    const raw = localStorage.getItem(WEB_BUILD_LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WebBuildLibraryStore;
      return {
        migrated: Boolean(parsed.migrated),
        activeBuildPath: parsed.activeBuildPath ?? null,
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        files: parsed.files ?? {},
      };
    }
  } catch {
    // ignore corrupt fallback
  }
  const store: WebBuildLibraryStore = {
    migrated: false,
    activeBuildPath: null,
    folders: [],
    files: {},
  };
  migrateLegacyWebStorage(store);
  writeWebLibraryStore(store);
  return store;
}

export function writeWebLibraryStore(store: WebBuildLibraryStore): void {
  localStorage.setItem(WEB_BUILD_LIBRARY_KEY, JSON.stringify(store));
}
