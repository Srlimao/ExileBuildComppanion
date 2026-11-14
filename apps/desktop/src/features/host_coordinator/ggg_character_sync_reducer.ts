import {
  auditGearAndFlaskHygiene,
  buildVendorSearchRegex,
  computeNextTownCurrencyBudget,
  computePassiveTreeDiff,
  estimateEquippedResistances,
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
  const charMeta = response.itemsJson.character as { level?: number; name?: string } | undefined;
  const characterLevel = typeof charMeta?.level === "number" ? charMeta.level : snapshot.characterLevel;
  const allocatedHashes = Array.isArray(response.passivesJson?.hashes)
    ? (response.passivesJson.hashes as number[])
    : [];

  const completedBossFlags: string[] = [];
  if (snapshot.highestUnlockedAct >= 6) completedBossFlags.push("kitava_act5");
  if (snapshot.highestUnlockedAct >= 11) completedBossFlags.push("kitava_act10");

  const resistances = estimateEquippedResistances({
    items,
    allocatedNodeIds: allocatedHashes,
    bandit: build.bandit,
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
    allocatedMasteries: extractAllocatedMasteriesFromPassives(response.passivesJson),
    characterLevel,
    adapter: poe1GameAdapter,
  });

  const gearHygiene = auditGearAndFlaskHygiene({
    items,
    characterLevel,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    isAttackBuild: build.characterClass === "Ranger" || build.characterClass === "Duelist",
  });

  const activeVendorRegex = buildVendorSearchRegex({
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    currentAct: snapshot.currentAct,
  });

  return {
    ...snapshot,
    version: snapshot.version + 1,
    characterName: charMeta?.name || snapshot.characterName,
    characterLevel,
    characterSyncStatus: response.usedPoesessid ? "ONLINE_POESESSID" : "ONLINE_PUBLIC",
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
    passiveTree,
    activeVendorRegex,
  };
}
