import { poe1LeagueStarterFilterMeta } from "@exile-hud/game-data";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getLootFilterStatusIpc,
  installLeagueStarterFilterIpc,
  openLootFilterFolderIpc,
} from "../src/features/loot_filter/loot_filter_types_and_ipc.js";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("loot_filter_types_and_ipc", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
  });

  it("exposes baked NeverSink league metadata from @exile-hud/game-data", () => {
    expect(poe1LeagueStarterFilterMeta.leagueName).toBe("Umbra");
    expect(poe1LeagueStarterFilterMeta.version).toBe("8.21.0a");
    expect(poe1LeagueStarterFilterMeta.defaultPresetId).toBe("regular");
    expect(poe1LeagueStarterFilterMeta.presets.map((p) => p.id)).toEqual([
      "regular",
      "semi_strict",
    ]);
  });

  it("simulates installing regular, semi_strict, and both presets cleanly in browser preview", async () => {
    const initial = await getLootFilterStatusIpc();
    expect(initial.installedPresetIds).toEqual([]);
    expect(initial.dirExists).toBe(false);

    const regRes = await installLeagueStarterFilterIpc("regular");
    expect(regRes.installedFileNames).toEqual(["ExileHUD_LeagueStart_Regular.filter"]);
    expect(regRes.status.installedPresetIds).toEqual(["regular"]);
    expect(regRes.status.dirExists).toBe(true);

    const bothRes = await installLeagueStarterFilterIpc("both");
    expect(bothRes.installedFileNames).toEqual([
      "ExileHUD_LeagueStart_Regular.filter",
      "ExileHUD_LeagueStart_SemiStrict.filter",
    ]);
    expect(bothRes.status.installedPresetIds).toEqual(["regular", "semi_strict"]);

    const persisted = await getLootFilterStatusIpc();
    expect(persisted.installedFileNames).toEqual([
      "ExileHUD_LeagueStart_Regular.filter",
      "ExileHUD_LeagueStart_SemiStrict.filter",
    ]);

    const folder = await openLootFilterFolderIpc();
    expect(folder).toContain("Path of Exile");
  });
});
