import { afterEach, describe, expect, it } from "vitest";
import {
  RECENT_ROOM_STORAGE_KEY,
  clearRecentRoomId,
  loadRecentRoomId,
  normalizeRoomCode,
  saveRecentRoomId,
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
});
