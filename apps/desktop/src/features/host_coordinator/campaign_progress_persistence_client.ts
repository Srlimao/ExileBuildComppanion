import {
  createEmptyCampaignProgress,
  extractCampaignProgress,
  type HudSessionSnapshot,
  type SavedCampaignProgress,
} from "@exile-hud/core";
import { updateBuildProgressIpc } from "../build_library/build_library_ipc_client.js";
import {
  buildSummaryFromSnapshot,
  type BuildProgressPatch,
} from "../build_library/build_library_types.js";
import {
  isTauriRuntime,
  loadSavedCampaignProgressIpc,
  saveCampaignProgressIpc,
} from "./tauri_ipc_adapter.js";

const WEB_PROGRESS_FALLBACK_KEY = "exile_saved_campaign_progress_v1";
const SAVE_DEBOUNCE_MS = 150;

interface PendingBuildProgressSave {
  activeBuildPath: string | null;
  progress: SavedCampaignProgress;
  patch: BuildProgressPatch | null;
}

let debounceTimer: number | null = null;
let pendingSave: PendingBuildProgressSave | null = null;

async function writePendingSave(target: PendingBuildProgressSave): Promise<void> {
  if (target.activeBuildPath && target.patch) {
    await updateBuildProgressIpc(target.activeBuildPath, target.patch).catch(() => undefined);
    return;
  }
  await persistCampaignProgress(target.progress);
}

/** Immediately writes any debounced campaign progress save before switching or unloading. */
export async function flushPendingProgressSave(): Promise<void> {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const toFlush = pendingSave;
  pendingSave = null;
  if (toFlush) {
    await writePendingSave(toFlush);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void flushPendingProgressSave();
  });
}

/** Loads legacy persisted checklist and gem completion from PC AppData JSON or browser fallback. */
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

/** Saves legacy checklist and gem completion when no active library build path is present. */
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
  if (
    prev.currentAreaId !== next.currentAreaId ||
    (prev.visitedAreaIds?.length ?? 0) !== (next.visitedAreaIds?.length ?? 0) ||
    (prev.clearedAreaIds?.length ?? 0) !== (next.clearedAreaIds?.length ?? 0) ||
    Object.keys(prev.actSplitsMs ?? {}).length !== Object.keys(next.actSplitsMs ?? {}).length ||
    prev.checkpoints.length !== next.checkpoints.length ||
    prev.gemSteps.length !== next.gemSteps.length
  ) {
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

/** Persists progress changes strictly onto the active build file ("one save, one progression"). */
export function persistSnapshotProgressIfNeeded(
  prev: HudSessionSnapshot | null,
  next: HudSessionSnapshot,
  eventTag: string,
  activeBuildCtx?: {
    activeBuildPath: string | null;
    onSummaryUpdated?: (snapshot: HudSessionSnapshot) => void;
  },
): void {
  if (eventTag === "switch_build") return;

  const activeBuildPath = activeBuildCtx?.activeBuildPath ?? null;

  if (eventTag === "reset_progress" || eventTag === "viewer_reset_progress") {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingSave = null;
    const emptyProgress = createEmptyCampaignProgress();
    if (activeBuildPath) {
      void updateBuildProgressIpc(activeBuildPath, {
        progress: emptyProgress,
        summary: buildSummaryFromSnapshot(next),
        runElapsedMs: 0,
        actSplitsMs: {},
        updatedAtMs: Date.now(),
      }).catch(() => undefined);
      activeBuildCtx?.onSummaryUpdated?.(next);
    } else {
      void persistCampaignProgress(emptyProgress);
    }
    return;
  }

  if (!didProgressStateChange(prev, next)) return;

  const now = Date.now();
  const progress = extractCampaignProgress(next, { wasExplicitlyReset: false, nowMs: now });
  const patch: BuildProgressPatch | null = activeBuildPath
    ? {
        progress,
        summary: buildSummaryFromSnapshot(next),
        runElapsedMs: next.runElapsedMs,
        actSplitsMs: next.actSplitsMs,
        ...(next.characterName ? { characterName: next.characterName } : {}),
        updatedAtMs: now,
      }
    : null;

  activeBuildCtx?.onSummaryUpdated?.(next);

  const payload: PendingBuildProgressSave = { activeBuildPath, progress, patch };
  if (eventTag === "viewer_checkpoint" || eventTag === "viewer_gem") {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingSave = null;
    void writePendingSave(payload);
    return;
  }

  pendingSave = payload;
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    const target = pendingSave;
    pendingSave = null;
    if (target) {
      void writePendingSave(target);
    }
  }, SAVE_DEBOUNCE_MS);
}

/** Persists linked character name and league immediately onto the active build file. */
export function persistActiveBuildCharacterLink(
  activeBuildPath: string | null,
  characterName: string,
  selectedLeague?: string,
): void {
  if (!activeBuildPath) return;
  void updateBuildProgressIpc(activeBuildPath, {
    characterName,
    ...(selectedLeague !== undefined ? { selectedLeague } : {}),
    updatedAtMs: Date.now(),
  }).catch(() => undefined);
}
