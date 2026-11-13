import type { GameAdapter } from "@exile-hud/game-data";
import type { ValidatedPobBuild } from "../pob_import/pob_endgame_fallback_validator.js";
import type { HudSessionSnapshot } from "../protocol/session_room_wire_protocol.js";
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
  const activeSpec = build.treeSpecs[0];
  const treeNodes = adapter.getPassiveTreeNodes();
  const targetNodesPreview = (activeSpec?.nodeIds ?? []).slice(0, 120).map((id) => {
    const meta = treeNodes[id];
    return { id, x: meta?.x ?? 0, y: meta?.y ?? 0, allocated: false, label: meta?.name ?? id };
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
    passiveTree: {
      specName: activeSpec?.title ?? "Default Tree",
      targetNodeCount: activeSpec?.nodeIds.length ?? 0,
      allocatedTargetCount: 0,
      remainingNodeIds: activeSpec?.nodeIds ?? [],
      remainingNotableNames: (activeSpec?.nodeIds ?? [])
        .map((id) => treeNodes[id])
        .filter((m) => m && (m.isNotable || m.isKeystone))
        .slice(0, 12)
        .map((m) => m!.name),
      respecPointsNeeded: 0,
      targetNodesPreview,
    },
    lab: {
      hasDailyLayout: false,
      difficultyLabel: "Normal Labyrinth",
      currentRoomId: null,
      currentRoomName: null,
      rooms: [],
      completedTrialAreaIds: [],
    },
    zoneLayoutPaths: adapter.getZoneLayoutVariants("1_1_1"),
  };
}
