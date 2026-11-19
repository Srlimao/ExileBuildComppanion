export const RECENT_ROOM_STORAGE_KEY = "exile_hud_recent_room_v1";
export const RECENT_ROOM_SESSION_KEY = "exile_hud_recent_room_session_v1";

const MIN_ROOM_CODE_LEN = 3;
const MAX_ROOM_CODE_LEN = 12;
const ROOM_PIN_PATTERN = /^[A-Za-z0-9]{4,8}$/;

export interface RecentRoomSession {
  roomId: string;
  pin: string;
  autoConnect: boolean;
  updatedAtMs: number;
}

/** Normalizes a room identifier to trimmed uppercase ASCII alphanumerics. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidRoomCode(normalized: string): boolean {
  return normalized.length >= MIN_ROOM_CODE_LEN && normalized.length <= MAX_ROOM_CODE_LEN;
}

/** Normalizes a 4-8 character alphanumeric room pairing PIN. */
export function normalizeRoomPin(raw: string): string {
  return raw.trim();
}

function isValidRoomPin(normalized: string): boolean {
  return ROOM_PIN_PATTERN.test(normalized);
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

/** Loads the persisted recent room session (roomId + PIN + autoConnect) for PWA auto-reconnect. */
export function loadRecentRoomSession(): RecentRoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage?.getItem(RECENT_ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecentRoomSession>;
    const cleanRoom = typeof parsed.roomId === "string" ? normalizeRoomCode(parsed.roomId) : "";
    const cleanPin = typeof parsed.pin === "string" ? normalizeRoomPin(parsed.pin) : "";
    if (!isValidRoomCode(cleanRoom) || !isValidRoomPin(cleanPin)) return null;
    return {
      roomId: cleanRoom,
      pin: cleanPin,
      autoConnect: typeof parsed.autoConnect === "boolean" ? parsed.autoConnect : true,
      updatedAtMs: typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : 0,
    };
  } catch {
    return null;
  }
}

/** Persists both the room code and pairing PIN for seamless Android PWA reconnects. */
export function saveRecentRoomSession(
  roomId: string,
  pin: string,
  autoConnect = true,
  nowMs = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const cleanRoom = normalizeRoomCode(roomId);
  const cleanPin = normalizeRoomPin(pin);
  if (!isValidRoomCode(cleanRoom)) return;
  saveRecentRoomId(cleanRoom);
  if (!isValidRoomPin(cleanPin)) return;
  const payload: RecentRoomSession = {
    roomId: cleanRoom,
    pin: cleanPin,
    autoConnect,
    updatedAtMs: nowMs,
  };
  try {
    window.localStorage?.setItem(RECENT_ROOM_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

/** Updates autoConnect on an existing recent room session (e.g. false after manual Switch Room). */
export function setRecentRoomAutoConnect(autoConnect: boolean): void {
  if (typeof window === "undefined") return;
  const existing = loadRecentRoomSession();
  if (!existing) return;
  const updated: RecentRoomSession = {
    ...existing,
    autoConnect,
    updatedAtMs: Date.now(),
  };
  try {
    window.localStorage?.setItem(RECENT_ROOM_SESSION_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

/** Clears the stored pairing PIN session while preserving the recent room code chip. */
export function clearRecentRoomPin(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(RECENT_ROOM_SESSION_KEY);
  } catch {
    // Ignore storage access errors
  }
}

/** Removes any persisted recent room ID and session from localStorage. */
export function clearRecentRoomId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(RECENT_ROOM_STORAGE_KEY);
    window.localStorage?.removeItem(RECENT_ROOM_SESSION_KEY);
  } catch {
    // Ignore storage access errors
  }
}
