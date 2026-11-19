import type { HudSessionSnapshot, ModeWidgetGrids, SavedCampaignProgress } from "@exile-hud/core";
import { normalizeRoomCode } from "./recent_room_storage.js";

export const LOCAL_LAYOUT_KEY = "exile_hud_widget_layouts_v1";
export const DEMO_PROGRESS_KEY = "exile_hud_demo_progress_v1";
export const LAST_SNAPSHOT_CACHE_KEY = "exile_hud_last_snapshot_v1";
export const SNAPSHOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedRoomSnapshotEnvelope {
  roomId: string;
  savedAtMs: number;
  snapshot: HudSessionSnapshot;
}

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadDemoProgress(): SavedCampaignProgress | null {
  try {
    const raw = getSafeStorage()?.getItem(DEMO_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as SavedCampaignProgress) : null;
  } catch {
    return null;
  }
}

export function saveDemoProgress(record: SavedCampaignProgress): void {
  try {
    getSafeStorage()?.setItem(DEMO_PROGRESS_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage error
  }
}

export function loadCachedLayouts(): ModeWidgetGrids {
  try {
    const raw = getSafeStorage()?.getItem(LOCAL_LAYOUT_KEY);
    if (raw) return JSON.parse(raw) as ModeWidgetGrids;
  } catch {
    // Ignore storage error
  }
  return { "tablet-landscape": {}, "tablet-portrait": {}, phone: {} };
}

export function loadCachedRoomSnapshot(
  roomId: string,
  nowMs = Date.now(),
): HudSessionSnapshot | null {
  const cleanRoom = normalizeRoomCode(roomId);
  if (!cleanRoom) return null;
  try {
    const raw = getSafeStorage()?.getItem(LAST_SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedRoomSnapshotEnvelope>;
    if (
      typeof parsed.roomId !== "string" ||
      typeof parsed.savedAtMs !== "number" ||
      !parsed.snapshot ||
      typeof parsed.snapshot !== "object"
    ) {
      return null;
    }
    if (normalizeRoomCode(parsed.roomId) !== cleanRoom) return null;
    if (nowMs - parsed.savedAtMs > SNAPSHOT_CACHE_TTL_MS) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}

export function saveCachedRoomSnapshot(
  roomId: string,
  snapshot: HudSessionSnapshot,
  nowMs = Date.now(),
): void {
  const cleanRoom = normalizeRoomCode(roomId);
  if (!cleanRoom) return;
  const envelope: CachedRoomSnapshotEnvelope = {
    roomId: cleanRoom,
    savedAtMs: nowMs,
    snapshot,
  };
  try {
    getSafeStorage()?.setItem(LAST_SNAPSHOT_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore storage error
  }
}

export function clearCachedRoomSnapshot(): void {
  try {
    getSafeStorage()?.removeItem(LAST_SNAPSHOT_CACHE_KEY);
  } catch {
    // Ignore storage error
  }
}
