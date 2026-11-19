import {
  buildInitialSessionSnapshot,
  createEmptyCampaignProgress,
  validateAndEnrichPobBuild,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countBuildsInFolder,
  createEmptyBuildProgressSummary,
  filterAndSortBuilds,
  getChildFolders,
  getFolderBreadcrumbs,
  getParentFolderPath,
  type SavedBuildFileRecord,
} from "../src/features/build_library/build_library_types.js";
import {
  createBuildFolderWeb,
  deleteBuildFolderWeb,
  deleteBuildWeb,
  duplicateBuildWeb,
  listBuildLibraryWeb,
  loadBuildFileWeb,
  renameBuildFolderWeb,
  renameOrMoveBuildWeb,
  saveBuildFileWeb,
  setActiveBuildPathWeb,
  updateBuildProgressWeb,
} from "../src/features/build_library/build_library_web_fallback.js";
import {
  compilePobProfileToSnapshot,
  DEFAULT_STARTER_POB_XML,
} from "../src/features/host_coordinator/desktop_telemetry_bridge.js";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
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

function makeSampleRecord(id: string, name: string, updatedAtMs: number): SavedBuildFileRecord {
  return {
    schemaVersion: 1,
    id,
    name,
    notes: `${name} note`,
    rawInput: DEFAULT_STARTER_POB_XML,
    cachedXml: DEFAULT_STARTER_POB_XML,
    leagueStart: true,
    customRouteText: "",
    selection: null,
    characterName: `${name}Char`,
    selectedLeague: "Mercenaries",
    summary: {
      ...createEmptyBuildProgressSummary(),
      characterClass: "Witch",
      ascendancyName: "Elementalist",
      buildLevel: 42,
      completedCheckpoints: 3,
      totalCheckpoints: 50,
    },
    progress: {
      completedCheckpointIds: ["1|1_1_1|MANDATORY_PATH||Kill Hillock#1"],
      softCompletedCheckpointIds: [],
      manualCompletedGemIds: [],
      softAcquiredGemIds: [],
      wasExplicitlyReset: false,
      updatedAtMs,
    },
    runElapsedMs: 90_000,
    actSplitsMs: { "1": 80_000 },
    createdAtMs: 1000,
    updatedAtMs,
  };
}

describe("build_library helpers and web fallback store", () => {
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

  it("computes child folders, breadcrumbs, counts, and folder-scoped vs global search sorting", () => {
    const folders = ["3.26", "3.26/Witch", "3.26/Ranger", "3.26/Witch/Bossers", "Standard"];
    expect(getChildFolders(folders, "")).toEqual(["3.26", "Standard"]);
    expect(getChildFolders(folders, "3.26")).toEqual(["3.26/Ranger", "3.26/Witch"]);
    expect(getFolderBreadcrumbs("3.26/Witch/Bossers")).toEqual([
      { label: "3.26", path: "3.26" },
      { label: "Witch", path: "3.26/Witch" },
      { label: "Bossers", path: "3.26/Witch/Bossers" },
    ]);
    expect(getParentFolderPath("3.26/Witch")).toBe("3.26");
    expect(getParentFolderPath("3.26")).toBe("");

    saveBuildFileWeb("3.26/Witch", {
      ...makeSampleRecord("b1", "Alpha RF", 1000),
      summary: { ...createEmptyBuildProgressSummary(), characterClass: "Witch", ascendancyName: "Elementalist", buildLevel: 50 },
    });
    saveBuildFileWeb("Standard", {
      ...makeSampleRecord("b2", "Zeta LA", 2000),
      summary: { ...createEmptyBuildProgressSummary(), characterClass: "Ranger", ascendancyName: "Deadeye", buildLevel: 90 },
    });

    const listing = listBuildLibraryWeb();
    expect(countBuildsInFolder(listing.builds, "3.26")).toBe(1);
    expect(filterAndSortBuilds(listing.builds, "3.26/Witch", "", "updated").map((b) => b.name)).toEqual([
      "Alpha RF",
    ]);
    expect(filterAndSortBuilds(listing.builds, "3.26/Witch", "Zeta", "name").map((b) => b.name)).toEqual([
      "Zeta LA",
    ]);
    expect(filterAndSortBuilds(listing.builds, "", "a", "level").map((b) => b.name)).toEqual([
      "Zeta LA",
      "Alpha RF",
    ]);
  });

  it("enforces one save one progression across switches, duplicates, moves, renames, and deletes", () => {
    createBuildFolderWeb("", "Leagues");
    createBuildFolderWeb("Leagues", "3.26");
    const first = saveBuildFileWeb("Leagues/3.26", makeSampleRecord("id1", "RF Starter", 1000), null, true);
    const second = saveBuildFileWeb("Leagues/3.26", makeSampleRecord("id2", "RF Starter", 2000), null, false);
    expect(second.relativePath).toBe("Leagues/3.26/RF Starter (2).json");

    updateBuildProgressWeb(second.relativePath, {
      progress: createEmptyCampaignProgress(3000),
      characterName: "SecondRunner",
      runElapsedMs: 12_345,
      actSplitsMs: { "1": 10_000, "2": 12_000 },
      updatedAtMs: 3000,
    });

    const loadedFirst = loadBuildFileWeb(first.relativePath);
    const loadedSecond = loadBuildFileWeb(second.relativePath);
    expect(loadedFirst.characterName).toBe("RF StarterChar");
    expect(loadedFirst.runElapsedMs).toBe(90_000);
    expect(loadedSecond.characterName).toBe("SecondRunner");
    expect(loadedSecond.runElapsedMs).toBe(12_345);
    expect(loadedSecond.actSplitsMs).toEqual({ "1": 10_000, "2": 12_000 });

    const renamedFolder = renameBuildFolderWeb("Leagues", "Season");
    expect(renamedFolder).toBe("Season");
    expect(listBuildLibraryWeb().activeBuildPath).toBe("Season/3.26/RF Starter.json");

    const dup = duplicateBuildWeb("Season/3.26/RF Starter.json", "", "Fresh RF", false, "id3", 4000);
    const loadedDup = loadBuildFileWeb(dup.relativePath);
    expect(loadedDup.runElapsedMs).toBe(0);
    expect(loadedDup.characterName).toBe("");
    expect(loadedDup.progress.completedCheckpointIds).toEqual([]);

    const moved = renameOrMoveBuildWeb(second.relativePath.replace(/^Leagues/, "Season"), "", "Moved Starter", 5000);
    setActiveBuildPathWeb(moved.relativePath);
    expect(listBuildLibraryWeb().activeBuildPath).toBe("Moved Starter.json");

    const afterDeleteActive = deleteBuildWeb("Moved Starter.json");
    expect(afterDeleteActive).toBeTruthy();

    const afterFolderDelete = deleteBuildFolderWeb("Season", true);
    expect(afterFolderDelete).toBe("Fresh RF.json");
  });

  it("migrates legacy localStorage pob and progress once while keeping legacy keys intact", () => {
    localStorage.setItem(
      "exile_saved_pob_profile_v1",
      JSON.stringify({
        rawInput: "https://pobb.in/test",
        cachedXml: '<PathOfBuilding><Build buildName="Legacy Toxic Rain"/></PathOfBuilding>',
        leagueStart: false,
        customRouteText: "",
        selection: null,
        updatedAtMs: 1234,
      }),
    );
    localStorage.setItem(
      "exile_saved_campaign_progress_v1",
      JSON.stringify({
        completedCheckpointIds: ["1|1_1_1|MANDATORY_PATH||Kill Hillock#1"],
        softCompletedCheckpointIds: [],
        manualCompletedGemIds: ["gem_1"],
        softAcquiredGemIds: [],
        wasExplicitlyReset: false,
        updatedAtMs: 1235,
      }),
    );

    const listing = listBuildLibraryWeb();
    expect(listing.builds).toHaveLength(1);
    expect(listing.builds[0]!.name).toBe("Legacy Toxic Rain");
    expect(listing.activeBuildPath).toBe("Legacy Toxic Rain.json");
    expect(localStorage.getItem("exile_saved_pob_profile_v1")).not.toBeNull();
    expect(localStorage.getItem("exile_saved_campaign_progress_v1")).not.toBeNull();
  });

  it("isolates progress and character state when carryProgressFromPrevious is false", async () => {
    const build = validateAndEnrichPobBuild(
      {
        buildName: "Prev",
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
    const prevSnapshot = {
      ...buildInitialSessionSnapshot({
        roomId: "R1",
        profileId: "prev",
        build,
        checkpoints: [],
        gemSteps: [],
        adapter: poe1GameAdapter,
        characterName: "OldChar",
      }),
      poeRunning: true,
      clientLogHooked: true,
      autoClipboardEnabled: false,
      runElapsedMs: 55_000,
      actSplitsMs: { "1": 40_000 },
    };

    const next = await compilePobProfileToSnapshot({
      roomId: "R1",
      profileId: "new-build",
      rawPobInput: DEFAULT_STARTER_POB_XML,
      cachedXml: DEFAULT_STARTER_POB_XML,
      leagueStart: true,
      previousSnapshot: prevSnapshot,
      carryProgressFromPrevious: false,
    });

    expect(next.snapshot.poeRunning).toBe(true);
    expect(next.snapshot.clientLogHooked).toBe(true);
    expect(next.snapshot.autoClipboardEnabled).toBe(false);
    expect(next.snapshot.characterName).toBe("");
    expect(next.snapshot.runElapsedMs).toBe(0);
    expect(next.snapshot.actSplitsMs).toEqual({});
    expect(next.snapshot.checkpoints.every((c) => !c.completed)).toBe(true);
  });
});
