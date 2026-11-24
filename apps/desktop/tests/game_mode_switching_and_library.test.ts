import { getGameAdapter, getLeagueStarterFilterMetaForGame } from "@exile-hud/game-data";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStarterBuildRecordForGame } from "../src/features/build_library/build_library_game_scope.js";
import {
  deleteBuildWeb,
  listBuildLibraryWeb,
  saveBuildFileWeb,
} from "../src/features/build_library/build_library_web_fallback.js";
import {
  loadClientLogPathPrefForGame,
  saveClientLogPathPrefForGame,
} from "../src/features/host_coordinator/desktop_host_settings_storage.js";
import {
  getLootFilterStatusIpc,
  installLeagueStarterFilterIpc,
  openLootFilterFolderIpc,
} from "../src/features/loot_filter/loot_filter_types_and_ipc.js";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
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
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return store;
}

describe("game_mode_switching_and_library", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  it("resolves PoE 1 and PoE 2 game adapters with isolated stages, locales, and penalties", () => {
    const poe1 = getGameAdapter("poe1");
    const poe1Default = getGameAdapter(undefined);
    const poe2 = getGameAdapter("poe2");

    expect(poe1Default.gameId).toBe("poe1");
    expect(poe1.getCampaignStageCount()).toBe(10);
    expect(poe2.getCampaignStageCount()).toBe(7);

    expect(poe1.getDefaultStartAreaId()).toBe("1_1_1");
    expect(poe2.getDefaultStartAreaId()).toBe("G1_1");

    expect(poe2.getActDisplayLabel(5, "en")).toBe("Interlude 1");
    expect(poe2.getActDisplayLabel(5, "pt-BR")).toBe("Interlúdio 1");

    expect([1, 2, 3, 4, 5, 6, 8].map((stage) => poe2.getResistancePenaltyForAct(stage, []))).toEqual([
      0, -10, -20, -30, -40, -50, -60,
    ]);
  });

  it("exposes PoE 2 NeverSink starter filter metadata", () => {
    const meta = getLeagueStarterFilterMetaForGame("poe2");
    expect(meta.version).toBe("0.10.4a");
    expect(meta.presets.map((p) => p.targetFileName)).toEqual([
      "ExileHUD_PoE2_LeagueStart_Regular.filter",
      "ExileHUD_PoE2_LeagueStart_SemiStrict.filter",
    ]);
  });

  it("isolates PoE 1 and PoE 2 web build libraries cleanly", () => {
    const poe1Starter = createStarterBuildRecordForGame("poe1", 1000);
    const poe2Starter = createStarterBuildRecordForGame("poe2", 2000);

    saveBuildFileWeb("", poe1Starter, null, true, "poe1");
    saveBuildFileWeb("", poe2Starter, null, true, "poe2");

    const poe1List = listBuildLibraryWeb("poe1");
    const poe2List = listBuildLibraryWeb("poe2");

    expect(poe1List.rootDir).toContain("exile_build_library_v1");
    expect(poe2List.rootDir).toContain("exile_build_library_poe2_v1");
    expect(poe1List.builds.map((b) => b.name)).toEqual(["Starter RF Elementalist"]);
    expect(poe2List.builds.map((b) => b.name)).toEqual(["PoE 2 Starter Invoker"]);

    deleteBuildWeb(poe2List.builds[0]!.relativePath, "poe2");
    expect(listBuildLibraryWeb("poe2").builds).toHaveLength(0);
    expect(listBuildLibraryWeb("poe1").builds).toHaveLength(1);
  });

  it("installs PoE 2 loot filters into Path of Exile 2 without touching PoE 1 state", async () => {
    const res = await installLeagueStarterFilterIpc("both", "poe2");
    expect(res.installedFileNames).toEqual([
      "ExileHUD_PoE2_LeagueStart_Regular.filter",
      "ExileHUD_PoE2_LeagueStart_SemiStrict.filter",
    ]);
    expect(res.status.filterDir).toContain("Path of Exile 2");
    expect(res.status.installedPresetIds).toEqual(["regular", "semi_strict"]);

    const poe1Status = await getLootFilterStatusIpc("poe1");
    expect(poe1Status.installedPresetIds).toEqual([]);
    expect(await openLootFilterFolderIpc("poe2")).toContain("Path of Exile 2");
  });

  it("stores PoE 1 and PoE 2 Client.txt path prefs independently", () => {
    saveClientLogPathPrefForGame("poe1", "C:\\PoE1\\logs\\Client.txt");
    saveClientLogPathPrefForGame("poe2", "D:\\PoE2\\logs\\Client.txt");

    expect(loadClientLogPathPrefForGame("poe1")).toBe("C:\\PoE1\\logs\\Client.txt");
    expect(loadClientLogPathPrefForGame("poe2")).toBe("D:\\PoE2\\logs\\Client.txt");
  });
});
