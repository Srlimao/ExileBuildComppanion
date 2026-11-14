import type { GameAdapter } from "@exile-hud/game-data";
import type { ValidatedPobBuild } from "../pob_import/pob_endgame_fallback_validator.js";
import type { HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
import { computePassiveTreeDiff } from "../character_telemetry_diff/passive_tree_diff_calculator.js";
import { computeNextTownCurrencyBudget } from "../route_compiler/gem_quest_and_vendor_assigner.js";
import { buildVendorSearchRegex } from "../vendor_regex/vendor_search_regex_builder.js";

export function buildInitialSessionSnapshot(params: {
  roomId: string;
  profileId: string;
  build: ValidatedPobBuild;
  checkpoints: HudSessionSnapshot["checkpoints"];
  gemSteps: HudSessionSnapshot["gemSteps"];
  adapter: GameAdapter;
  characterName?: string;
}): HudSessionSnapshot {
  const { roomId, profileId, build, checkpoints, gemSteps, adapter, characterName } = params;
  const passiveTree = computePassiveTreeDiff({
    treeSpecs: build.treeSpecs,
    allocatedHashes: [],
    characterLevel: 1,
    adapter,
  });

  const linkGroups =
    build.skillSets[0]?.groups.map((g) => ({
      title: g.title,
      minLevel: build.skillSets[0]?.minLevel ?? 1,
      gems: g.gems.map((gm) => ({
        gemId: gm.gemId,
        name: gm.name,
        color: (gm.attribute === "strength"
          ? "R"
          : gm.attribute === "dexterity"
            ? "G"
            : gm.attribute === "intelligence"
              ? "B"
              : "W") as "R" | "G" | "B" | "W",
        isSupport: gm.isSupport,
        verifiedSocketed: false,
        unlinkedWarning: false,
      })),
      missingAuraWarning: false,
    })) ?? [];

  return {
    version: 1,
    roomId,
    profileId,
    buildName: build.buildName,
    characterClass: build.characterClass,
    ascendancyName: build.ascendancyName,
    characterName: characterName ?? "",
    characterLevel: 1,
    isEndgameOnlyFallback: build.isEndgameOnlyFallback,
    fallbackNotice: build.fallbackNotice,
    leagueStart: true,
    poeRunning: false,
    clientLogHooked: false,
    characterSyncStatus: "UNCONFIGURED",
    lastCharacterSyncAt: null,
    mode: "FIELD",
    inGameTreeOpen: false,
    currentAreaId: "1_1_1",
    currentAreaName: "The Twilight Strand",
    currentAreaLevel: 1,
    currentAreaSeed: null,
    currentAct: 1,
    highestUnlockedAct: 1,
    lastCombatZoneId: "1_1_1",
    lastCombatZoneName: "The Twilight Strand",
    recentDeath: false,
    resumeZoneBanner: null,
    activeVendorRegex: buildVendorSearchRegex({ gemSteps, linkGroups, currentAct: 1 }),
    autoClipboardEnabled: true,
    runElapsedMs: 0,
    runTimerRunning: false,
    actSplitsMs: {},
    checkpoints,
    gemSteps,
    nextTownCurrencyBudget: computeNextTownCurrencyBudget(gemSteps, 1),
    linkGroups,
    itemSets: build.itemSets,
    resistances: {
      source: "ACT_TARGET_FALLBACK",
      kitavaPenalty: 0,
      fire: { actual: 0, target: 35 },
      cold: { actual: 0, target: 50 },
      lightning: { actual: 0, target: 35 },
      chaos: { actual: 0, target: 0 },
      upcomingBossWarning: adapter.getBossElementalWarnings(1)[0]?.warningText ?? null,
    },
    gearHygiene: [],
    passiveTree,
    lab: {
      hasDailyLayout: false,
      difficultyLabel: "Normal Labyrinth",
      currentRoomId: null,
      currentRoomName: null,
      rooms: [],
      completedTrialAreaIds: [],
    },
    visitedAreaIds: [],
    clearedAreaIds: [],
    zoneLayoutPaths: adapter.getZoneLayoutVariants("1_1_1"),
  };
}
