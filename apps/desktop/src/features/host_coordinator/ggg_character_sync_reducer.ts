import {
  auditGearAndFlaskHygiene,
  buildVendorSearchRegex,
  computeBenchCraftSuggestions,
  computeNextTownCurrencyBudget,
  computePassiveTreeDiff,
  estimateEquippedResistances,
  reconcileAscendancyProgressFromPassives,
  verifySocketsAndGems,
  type GggItemModRecord,
  type HudSessionSnapshot,
  type ValidatedPobBuild,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  extractAllocatedMasteriesFromPassives,
  markEquippedItemSets,
} from "./client_log_sync_helper.js";
import type { CharacterPollResponse } from "./tauri_ipc_adapter.js";

/** Reconciles a GGG Character Window poll payload into the live session snapshot. */
export function applyGggCharacterResponseToSnapshot(
  snapshot: HudSessionSnapshot,
  build: ValidatedPobBuild,
  response: CharacterPollResponse,
): HudSessionSnapshot {
  if (!response.ok || !response.itemsJson) {
    return {
      ...snapshot,
      version: snapshot.version + 1,
      characterSyncStatus: "OFFLINE_FALLBACK",
    };
  }

  const items = (Array.isArray(response.itemsJson.items) ? response.itemsJson.items : []) as GggItemModRecord[];
  const passiveItems = (Array.isArray(response.passivesJson?.items)
    ? response.passivesJson.items
    : []) as GggItemModRecord[];
  const charMeta = response.itemsJson.character as
    | { level?: number; name?: string; wickerman?: unknown }
    | undefined;
  const rawWickerman =
    response.itemsJson.wickerman ?? charMeta?.wickerman ?? response.passivesJson?.wickerman;
  const wickermanItems = (Array.isArray(rawWickerman) ? rawWickerman : []) as GggItemModRecord[];
  const characterLevel = typeof charMeta?.level === "number" ? charMeta.level : snapshot.characterLevel;
  const allocatedHashes = Array.isArray(response.passivesJson?.hashes)
    ? (response.passivesJson.hashes as number[])
    : [];
  const allocatedMasteries = extractAllocatedMasteriesFromPassives(response.passivesJson);
  const apiBandit = response.passivesJson?.bandit_choice;
  const bandit =
    apiBandit === "Alira" || apiBandit === "Oak" || apiBandit === "Kraityn"
      ? apiBandit
      : apiBandit === "Eramir"
        ? "None"
        : build.bandit;

  const completedBossFlags: string[] = [];
  if (snapshot.highestUnlockedAct >= 6) completedBossFlags.push("kitava_act5");
  if (snapshot.highestUnlockedAct >= 11) completedBossFlags.push("kitava_act10");

  const resistances = estimateEquippedResistances({
    items,
    passiveItems,
    wickermanItems,
    allocatedNodeIds: allocatedHashes,
    allocatedMasteries,
    bandit,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    completedBossFlags,
    adapter: poe1GameAdapter,
  });

  const gemVerification = verifySocketsAndGems({
    items,
    skillSets: build.skillSets,
    gemSteps: snapshot.gemSteps,
    characterLevel,
  });

  const passiveTree = computePassiveTreeDiff({
    treeSpecs: build.treeSpecs,
    allocatedHashes,
    allocatedMasteries,
    characterLevel,
    adapter: poe1GameAdapter,
  });

  const benchCraftSuggestions = computeBenchCraftSuggestions({
    items,
    resistances,
    characterLevel,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    clearedAreaIds: snapshot.clearedAreaIds,
    checkpoints: snapshot.checkpoints,
    adapter: poe1GameAdapter,
  });

  const gearHygiene = auditGearAndFlaskHygiene({
    items,
    characterLevel,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    isAttackBuild: build.characterClass === "Ranger" || build.characterClass === "Duelist",
    benchCraftSuggestions,
  });

  const activeVendorRegex = buildVendorSearchRegex({
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    currentAct: snapshot.currentAct,
  });

  const nextSnapshot: HudSessionSnapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    characterName: charMeta?.name || snapshot.characterName,
    characterLevel,
    characterSyncStatus: "ONLINE_PUBLIC",
    lastCharacterSyncAt: Date.now(),
    gemSteps: gemVerification.updatedGemSteps,
    nextTownCurrencyBudget: computeNextTownCurrencyBudget(
      gemVerification.updatedGemSteps,
      snapshot.highestUnlockedAct,
    ),
    linkGroups: gemVerification.linkGroups,
    itemSets: markEquippedItemSets(build.itemSets, items),
    resistances,
    gearHygiene,
    benchCraftSuggestions,
    passiveTree,
    activeVendorRegex,
  };

  return reconcileAscendancyProgressFromPassives(nextSnapshot, allocatedHashes, poe1GameAdapter);
}
