export const RECENT_ROOM_STORAGE_KEY = "exile_hud_recent_room_v1";

const MIN_ROOM_CODE_LEN = 3;
const MAX_ROOM_CODE_LEN = 12;

/** Normalizes a room identifier to trimmed uppercase ASCII alphanumerics. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidRoomCode(normalized: string): boolean {
  return normalized.length >= MIN_ROOM_CODE_LEN && normalized.length <= MAX_ROOM_CODE_LEN;
}

/** Loads the most recently used non-secret room ID from localStorage, if valid. */
export function loadRecentRoomId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage?.getItem(RECENT_ROOM_STORAGE_KEY);
    if (!raw) return null;
    const normalized = normalizeRoomCode(raw);
    return isValidRoomCode(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/** Persists a valid non-secret room ID to localStorage without storing PINs or tokens. */
export function saveRecentRoomId(roomId: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeRoomCode(roomId);
  if (!isValidRoomCode(normalized)) return;
  try {
    window.localStorage?.setItem(RECENT_ROOM_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

/** Removes any persisted recent room ID from localStorage. */
export function clearRecentRoomId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(RECENT_ROOM_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}
