import type { HudSessionSnapshot, ModeWidgetGrids, SavedCampaignProgress, SupportedGameId } from "@exile-hud/core";
import { normalizeRoomCode } from "./recent_room_storage.js";

export const LOCAL_LAYOUT_KEY = "exile_hud_widget_layouts_v1";
export const LOCAL_LAYOUT_POE2_KEY = "exile_hud_widget_layouts_poe2_v1";
export const DEMO_PROGRESS_KEY = "exile_hud_demo_progress_v1";
export const DEMO_PROGRESS_POE2_KEY = "exile_hud_demo_progress_poe2_v1";
export const LAST_SNAPSHOT_CACHE_KEY = "exile_hud_last_snapshot_v1";
export const SNAPSHOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmptyModeWidgetGrids(): ModeWidgetGrids {
  return { "tablet-landscape": {}, "tablet-portrait": {}, phone: {} };
}

function resolveLayoutStorageKey(gameId: SupportedGameId = "poe1"): string {
  return gameId === "poe2" ? LOCAL_LAYOUT_POE2_KEY : LOCAL_LAYOUT_KEY;
}

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

export function loadDemoProgress(gameId: SupportedGameId = "poe1"): SavedCampaignProgress | null {
  const key = gameId === "poe2" ? DEMO_PROGRESS_POE2_KEY : DEMO_PROGRESS_KEY;
  try {
    const raw = getSafeStorage()?.getItem(key);
    return raw ? (JSON.parse(raw) as SavedCampaignProgress) : null;
  } catch {
    return null;
  }
}

export function saveDemoProgress(record: SavedCampaignProgress, gameId: SupportedGameId = "poe1"): void {
  const key = gameId === "poe2" ? DEMO_PROGRESS_POE2_KEY : DEMO_PROGRESS_KEY;
  try {
    getSafeStorage()?.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore storage error
  }
}

export function loadCachedLayoutsForGame(gameId: SupportedGameId = "poe1"): ModeWidgetGrids {
  try {
    const raw = getSafeStorage()?.getItem(resolveLayoutStorageKey(gameId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ModeWidgetGrids>;
      return {
        "tablet-landscape": parsed["tablet-landscape"] ?? {},
        "tablet-portrait": parsed["tablet-portrait"] ?? {},
        phone: parsed.phone ?? {},
      };
    }
  } catch {
    // Ignore storage error
  }
  return createEmptyModeWidgetGrids();
}

export function saveCachedLayoutsForGame(gameId: SupportedGameId, layouts: ModeWidgetGrids): void {
  try {
    getSafeStorage()?.setItem(resolveLayoutStorageKey(gameId), JSON.stringify(layouts));
  } catch {
    // Ignore storage error
  }
}

export function loadCachedLayoutsByGame(): Record<SupportedGameId, ModeWidgetGrids> {
  return {
    poe1: loadCachedLayoutsForGame("poe1"),
    poe2: loadCachedLayoutsForGame("poe2"),
  };
}

export function loadCachedLayouts(): ModeWidgetGrids {
  return loadCachedLayoutsForGame("poe1");
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
