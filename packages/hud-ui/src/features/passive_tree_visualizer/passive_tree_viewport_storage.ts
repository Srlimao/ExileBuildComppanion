import { clampViewWidth, type ViewportCamera } from "./pinch_zoom_math.js";

export interface SavedTreeViewport {
  specKey: string;
  camera: ViewportCamera;
  manualSpecId: string | null;
  updatedAt?: number;
}

const STORAGE_KEY = "exile_hud_tree_viewport_v1";
const MAX_PROFILES = 12;
const SAVE_DEBOUNCE_MS = 150;

const memoryCache = new Map<string, SavedTreeViewport>();
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function sanitizeEntry(raw: unknown): SavedTreeViewport | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.specKey !== "string" || rec.specKey.length === 0) return null;
  const cam = rec.camera as Record<string, unknown> | undefined;
  if (!cam || typeof cam !== "object") return null;
  const { centerX, centerY, width } = cam;
  if (
    typeof centerX !== "number" ||
    !Number.isFinite(centerX) ||
    typeof centerY !== "number" ||
    !Number.isFinite(centerY) ||
    typeof width !== "number" ||
    !Number.isFinite(width)
  ) {
    return null;
  }
  return {
    specKey: rec.specKey,
    camera: { centerX, centerY, width: clampViewWidth(width) },
    manualSpecId: typeof rec.manualSpecId === "string" ? rec.manualSpecId : null,
    updatedAt: typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt) ? rec.updatedAt : Date.now(),
  };
}

function hydrateCache(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return;
    for (const [profileId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const sanitized = sanitizeEntry(value);
      if (profileId && sanitized) memoryCache.set(profileId, sanitized);
    }
  } catch {
    // Ignore malformed persisted viewport payloads.
  }
}

function writeToLocalStorage(): void {
  if (memoryCache.size > MAX_PROFILES) {
    const newest = [...memoryCache.entries()]
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
      .slice(0, MAX_PROFILES);
    memoryCache.clear();
    for (const [key, val] of newest) memoryCache.set(key, val);
  }
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memoryCache.entries())));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

/** Loads the persisted viewport camera and bracket override for a build profile, if valid. */
export function loadSavedTreeViewport(profileId: string): SavedTreeViewport | null {
  if (!profileId) return null;
  hydrateCache();
  const entry = memoryCache.get(profileId);
  return entry ? { ...entry, camera: { ...entry.camera } } : null;
}

/** Saves the viewport camera and bracket override per profile with optional debounce. */
export function saveTreeViewport(profileId: string, entry: SavedTreeViewport, flushImmediate = false): void {
  if (!profileId) return;
  hydrateCache();
  const sanitized = sanitizeEntry({ ...entry, updatedAt: entry.updatedAt ?? Date.now() });
  if (!sanitized) return;
  memoryCache.set(profileId, sanitized);
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushImmediate) {
    writeToLocalStorage();
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeToLocalStorage();
  }, SAVE_DEBOUNCE_MS);
}

/** Clears the in-memory viewport cache (and optionally localStorage) for tests. */
export function clearSavedTreeViewportCache(clearStorage = false): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  memoryCache.clear();
  hydrated = false;
  if (clearStorage && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }
}
