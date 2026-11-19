import { buildInitialSessionSnapshot, validateAndEnrichPobBuild } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearCachedRoomSnapshot,
  loadCachedRoomSnapshot,
  saveCachedRoomSnapshot,
  SNAPSHOT_CACHE_TTL_MS,
} from "../src/features/pairing_and_connection/pwa_local_persistence.js";
import {
  RECENT_ROOM_SESSION_KEY,
  RECENT_ROOM_STORAGE_KEY,
  clearRecentRoomId,
  clearRecentRoomPin,
  loadRecentRoomId,
  loadRecentRoomSession,
  normalizeRoomCode,
  saveRecentRoomId,
  saveRecentRoomSession,
  setRecentRoomAutoConnect,
} from "../src/features/pairing_and_connection/recent_room_storage.js";

function installMockLocalStorage(): { store: Map<string, string>; restore: () => void } {
  const store = new Map<string, string>();
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string): string | null {
          return store.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
          store.set(key, String(value));
        },
        removeItem(key: string): void {
          store.delete(key);
        },
      },
    },
  });

  return {
    store,
    restore(): void {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    },
  };
}

let cleanupStorage: (() => void) | null = null;

afterEach(() => {
  if (cleanupStorage) {
    cleanupStorage();
    cleanupStorage = null;
  }
});

describe("recent_room_storage", () => {
  it("normalizes lowercase, whitespace, and punctuation to uppercase ASCII alphanumerics", () => {
    expect(normalizeRoomCode(" exile-9 ")).toBe("EXILE9");
    expect(normalizeRoomCode("ab12!@#cd")).toBe("AB12CD");
    expect(normalizeRoomCode("   ")).toBe("");
  });

  it("persists, reloads, and clears valid room codes", () => {
    const mock = installMockLocalStorage();
    cleanupStorage = mock.restore;

    expect(loadRecentRoomId()).toBeNull();

    saveRecentRoomId(" exile-9 ");
    expect(mock.store.get(RECENT_ROOM_STORAGE_KEY)).toBe("EXILE9");
    expect(loadRecentRoomId()).toBe("EXILE9");

    clearRecentRoomId();
    expect(loadRecentRoomId()).toBeNull();
  });

  it("rejects too-short, too-long, or corrupted stored room codes", () => {
    const mock = installMockLocalStorage();
    cleanupStorage = mock.restore;

    saveRecentRoomId("AB");
    expect(mock.store.has(RECENT_ROOM_STORAGE_KEY)).toBe(false);

    saveRecentRoomId("ABCDEFGHIJKLM");
    expect(mock.store.has(RECENT_ROOM_STORAGE_KEY)).toBe(false);

    mock.store.set(RECENT_ROOM_STORAGE_KEY, "!!1!!");
    expect(loadRecentRoomId()).toBeNull();
  });

  it("persists room session with PIN/autoConnect, toggles autoConnect, and clears PIN selectively", () => {
    const mock = installMockLocalStorage();
    cleanupStorage = mock.restore;

    saveRecentRoomSession(" exile-9 ", " 1234 ", true, 1000);
    expect(loadRecentRoomId()).toBe("EXILE9");
    expect(loadRecentRoomSession()).toEqual({
      roomId: "EXILE9",
      pin: "1234",
      autoConnect: true,
      updatedAtMs: 1000,
    });

    setRecentRoomAutoConnect(false);
    expect(loadRecentRoomSession()?.autoConnect).toBe(false);

    clearRecentRoomPin();
    expect(loadRecentRoomSession()).toBeNull();
    expect(loadRecentRoomId()).toBe("EXILE9");

    saveRecentRoomSession("EXILE9", "5678", true, 2000);
    expect(mock.store.has(RECENT_ROOM_SESSION_KEY)).toBe(true);
    clearRecentRoomId();
    expect(mock.store.has(RECENT_ROOM_SESSION_KEY)).toBe(false);
    expect(loadRecentRoomId()).toBeNull();
  });

  it("caches room snapshot per roomId with 24h TTL and clear support", () => {
    const mock = installMockLocalStorage();
    cleanupStorage = mock.restore;

    const build = validateAndEnrichPobBuild(
      {
        buildName: "CacheTest",
        characterClass: "Witch",
        ascendancyName: "Elementalist",
        bandit: "None",
        buildLevel: 1,
        skillSets: [],
        treeSpecs: [],
        itemSets: [],
        uniqueRequiredGems: [],
      },
      poe1GameAdapter,
    );
    const snap = buildInitialSessionSnapshot({
      roomId: "EXILE9",
      profileId: "p1",
      build,
      checkpoints: [],
      gemSteps: [],
      adapter: poe1GameAdapter,
    });

    saveCachedRoomSnapshot("exile-9", snap, 10_000);
    expect(loadCachedRoomSnapshot("EXILE9", 20_000)?.buildName).toBe("CacheTest");
    expect(loadCachedRoomSnapshot("OTHER1", 20_000)).toBeNull();
    expect(loadCachedRoomSnapshot("EXILE9", 10_000 + SNAPSHOT_CACHE_TTL_MS + 1)).toBeNull();

    clearCachedRoomSnapshot();
    expect(loadCachedRoomSnapshot("EXILE9", 20_000)).toBeNull();
  });
});
