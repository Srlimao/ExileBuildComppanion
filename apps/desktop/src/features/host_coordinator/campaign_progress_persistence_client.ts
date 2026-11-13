import {
  applySavedCampaignProgress,
  createEmptyCampaignProgress,
  extractCampaignProgress,
  type HudSessionSnapshot,
  type SavedCampaignProgress,
  type ValidatedPobBuild,
} from "@exile-hud/core";
import { bootstrapHostEnvironment, syncBuildSetsForLevel } from "./client_log_sync_helper.js";
import { loadInitialSavedOrDefaultProfile, type CompileProfileFn } from "./pob_profile_persistence_client.js";
import {
  isTauriRuntime,
  loadSavedCampaignProgressIpc,
  saveCampaignProgressIpc,
} from "./tauri_ipc_adapter.js";

const WEB_PROGRESS_FALLBACK_KEY = "exile_saved_campaign_progress_v1";
const SAVE_DEBOUNCE_MS = 150;

let debounceTimer: number | null = null;
let pendingProgress: SavedCampaignProgress | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pendingProgress) {
      const toFlush = pendingProgress;
      pendingProgress = null;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      void persistCampaignProgress(toFlush);
    }
  });
}

/** Loads persisted checklist and gem completion from PC AppData JSON (or browser localStorage in preview). */
export async function loadSavedCampaignProgress(): Promise<SavedCampaignProgress | null> {
  if (isTauriRuntime()) {
    return loadSavedCampaignProgressIpc();
  }
  try {
    const raw = localStorage.getItem(WEB_PROGRESS_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as SavedCampaignProgress) : null;
  } catch {
    return null;
  }
}

/** Saves checklist and gem completion to PC AppData JSON (or browser localStorage in preview). */
export async function persistCampaignProgress(record: SavedCampaignProgress): Promise<void> {
  if (isTauriRuntime()) {
    await saveCampaignProgressIpc(record);
    return;
  }
  try {
    localStorage.setItem(WEB_PROGRESS_FALLBACK_KEY, JSON.stringify(record));
  } catch {
    // Ignore browser storage quota errors
  }
}

function didProgressStateChange(prev: HudSessionSnapshot | null, next: HudSessionSnapshot): boolean {
  if (!prev) return true;
  if (prev.checkpoints.length !== next.checkpoints.length || prev.gemSteps.length !== next.gemSteps.length) {
    return true;
  }
  for (let i = 0; i < next.checkpoints.length; i++) {
    const a = prev.checkpoints[i]!;
    const b = next.checkpoints[i]!;
    if (a.id !== b.id || a.completed !== b.completed || a.softCompleted !== b.softCompleted) {
      return true;
    }
  }
  for (let i = 0; i < next.gemSteps.length; i++) {
    const a = prev.gemSteps[i]!;
    const b = next.gemSteps[i]!;
    if (a.id !== b.id || a.manualCompleted !== b.manualCompleted || a.softAcquired !== b.softAcquired) {
      return true;
    }
  }
  return false;
}

/** Persists progress changes immediately on resets/toggles and debounces rapid log updates. */
export function persistSnapshotProgressIfNeeded(
  prev: HudSessionSnapshot | null,
  next: HudSessionSnapshot,
  eventTag: string,
): void {
  if (eventTag === "reset_progress" || eventTag === "viewer_reset_progress") {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingProgress = null;
    void persistCampaignProgress(createEmptyCampaignProgress());
    return;
  }

  if (!didProgressStateChange(prev, next)) return;

  const progress = extractCampaignProgress(next, { wasExplicitlyReset: false });
  if (eventTag === "viewer_checkpoint" || eventTag === "viewer_gem") {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingProgress = null;
    void persistCampaignProgress(progress);
    return;
  }

  pendingProgress = progress;
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    const target = pendingProgress;
    pendingProgress = null;
    if (target) {
      void persistCampaignProgress(target);
    }
  }, SAVE_DEBOUNCE_MS);
}

/** Bootstraps PoB profile, PC environment, and persisted checklist/gem progress on startup. */
export async function initializeHostSessionWithProgress(
  params: { roomId: string; characterName: string },
  compileFn: CompileProfileFn,
): Promise<{
  compiled: Awaited<ReturnType<typeof loadInitialSavedOrDefaultProfile>>["compiled"];
  rawInput: string;
  leagueStart: boolean;
  customRouteText: string;
  storagePath: string;
  env: Awaited<ReturnType<typeof bootstrapHostEnvironment>>;
  hydratedSnapshot: HudSessionSnapshot;
}> {
  const [loaded, savedProgress] = await Promise.all([
    loadInitialSavedOrDefaultProfile(params, compileFn),
    loadSavedCampaignProgress().catch(() => null),
  ]);
  const env = await bootstrapHostEnvironment(loaded.compiled.snapshot);
  const synced = syncBuildSetsForLevel(env.snapshot, loaded.compiled.build);
  const hydratedSnapshot = applySavedCampaignProgress(synced, savedProgress);
  return {
    ...loaded,
    env,
    hydratedSnapshot,
  };
}

export type SyncBuildLevelFn = (snapshot: HudSessionSnapshot, build: ValidatedPobBuild | null) => HudSessionSnapshot;
