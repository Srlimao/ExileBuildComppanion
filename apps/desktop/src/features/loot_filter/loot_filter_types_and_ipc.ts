import {
  getLeagueStarterFilterMetaForGame,
  type LootFilterPresetId,
  type SupportedGameId,
} from "@exile-hud/game-data";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";

export type LootFilterSelection = LootFilterPresetId | "both";

export interface LootFilterDirectoryStatus {
  filterDir: string;
  dirExists: boolean;
  installedPresetIds: LootFilterPresetId[];
  installedFileNames: string[];
}

export interface LootFilterInstallResult {
  installedPaths: string[];
  installedFileNames: string[];
  status: LootFilterDirectoryStatus;
}

function simStorageKeyForGame(gameId: SupportedGameId): string {
  return gameId === "poe2" ? "exile_hud_sim_loot_filter_poe2_v1" : "exile_hud_sim_loot_filter_v1";
}

function simFilterDirForGame(gameId: SupportedGameId): string {
  return gameId === "poe2"
    ? "C:\\Users\\Player\\Documents\\My Games\\Path of Exile 2"
    : "C:\\Users\\Player\\Documents\\My Games\\Path of Exile";
}

function readSimulatedInstalledIds(gameId: SupportedGameId): LootFilterPresetId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(simStorageKeyForGame(gameId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is LootFilterPresetId => id === "regular" || id === "semi_strict");
  } catch {
    return [];
  }
}

function buildSimulatedStatus(
  installedIds: LootFilterPresetId[],
  gameId: SupportedGameId,
): LootFilterDirectoryStatus {
  const meta = getLeagueStarterFilterMetaForGame(gameId);
  const uniqueIds = meta.presets.map((p) => p.id).filter((id) => installedIds.includes(id));
  const installedFileNames = meta.presets
    .filter((p) => uniqueIds.includes(p.id))
    .map((p) => p.targetFileName);
  return {
    filterDir: simFilterDirForGame(gameId),
    dirExists: uniqueIds.length > 0,
    installedPresetIds: uniqueIds,
    installedFileNames,
  };
}

/** Reads the local PoE 1 or PoE 2 item filter directory and installed starter filter status. */
export async function getLootFilterStatusIpc(
  gameId: SupportedGameId = "poe1",
): Promise<LootFilterDirectoryStatus> {
  if (!isTauriRuntime()) {
    return buildSimulatedStatus(readSimulatedInstalledIds(gameId), gameId);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LootFilterDirectoryStatus>("get_loot_filter_status", { gameId });
}

/** Installs the selected baked league-start filter preset(s) into the target game's filter folder. */
export async function installLeagueStarterFilterIpc(
  presetId: LootFilterSelection,
  gameId: SupportedGameId = "poe1",
): Promise<LootFilterInstallResult> {
  if (!isTauriRuntime()) {
    const existing = new Set<LootFilterPresetId>(readSimulatedInstalledIds(gameId));
    const targetIds: LootFilterPresetId[] =
      presetId === "both" ? ["regular", "semi_strict"] : [presetId];
    for (const id of targetIds) existing.add(id);

    const nextIds = Array.from(existing);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(simStorageKeyForGame(gameId), JSON.stringify(nextIds));
      } catch {
        // Ignore storage quota errors in browser preview
      }
    }
    const meta = getLeagueStarterFilterMetaForGame(gameId);
    const simDir = simFilterDirForGame(gameId);
    const installedPresets = meta.presets.filter((p) => targetIds.includes(p.id));
    return {
      installedPaths: installedPresets.map((p) => `${simDir}\\${p.targetFileName}`),
      installedFileNames: installedPresets.map((p) => p.targetFileName),
      status: buildSimulatedStatus(nextIds, gameId),
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LootFilterInstallResult>("install_league_starter_filter", { presetId, gameId });
}

/** Creates (if needed) and opens the PoE 1 or PoE 2 item filter folder in Windows Explorer. */
export async function openLootFilterFolderIpc(
  gameId: SupportedGameId = "poe1",
): Promise<string> {
  if (!isTauriRuntime()) {
    return simFilterDirForGame(gameId);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("open_loot_filter_folder", { gameId });
}
