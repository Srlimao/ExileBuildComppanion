import { poe1LeagueStarterFilterMeta, type LootFilterPresetId } from "@exile-hud/game-data";
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

const SIM_STORAGE_KEY = "exile_hud_sim_loot_filter_v1";
const SIM_FILTER_DIR = "C:\\Users\\Player\\Documents\\My Games\\Path of Exile";

function readSimulatedInstalledIds(): LootFilterPresetId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is LootFilterPresetId => id === "regular" || id === "semi_strict");
  } catch {
    return [];
  }
}

function buildSimulatedStatus(installedIds: LootFilterPresetId[]): LootFilterDirectoryStatus {
  const uniqueIds = poe1LeagueStarterFilterMeta.presets
    .map((p) => p.id)
    .filter((id) => installedIds.includes(id));
  const installedFileNames = poe1LeagueStarterFilterMeta.presets
    .filter((p) => uniqueIds.includes(p.id))
    .map((p) => p.targetFileName);
  return {
    filterDir: SIM_FILTER_DIR,
    dirExists: uniqueIds.length > 0,
    installedPresetIds: uniqueIds,
    installedFileNames,
  };
}

/** Reads the local Path of Exile item filter directory and installed starter filter status. */
export async function getLootFilterStatusIpc(): Promise<LootFilterDirectoryStatus> {
  if (!isTauriRuntime()) {
    return buildSimulatedStatus(readSimulatedInstalledIds());
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LootFilterDirectoryStatus>("get_loot_filter_status");
}

/** Installs the selected baked league-start filter preset(s) into the user's PoE filter folder. */
export async function installLeagueStarterFilterIpc(
  presetId: LootFilterSelection,
): Promise<LootFilterInstallResult> {
  if (!isTauriRuntime()) {
    const existing = new Set<LootFilterPresetId>(readSimulatedInstalledIds());
    const targetIds: LootFilterPresetId[] =
      presetId === "both" ? ["regular", "semi_strict"] : [presetId];
    for (const id of targetIds) existing.add(id);

    const nextIds = Array.from(existing);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(nextIds));
      } catch {
        // Ignore storage quota errors in browser preview
      }
    }
    const installedPresets = poe1LeagueStarterFilterMeta.presets.filter((p) =>
      targetIds.includes(p.id),
    );
    return {
      installedPaths: installedPresets.map((p) => `${SIM_FILTER_DIR}\\${p.targetFileName}`),
      installedFileNames: installedPresets.map((p) => p.targetFileName),
      status: buildSimulatedStatus(nextIds),
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LootFilterInstallResult>("install_league_starter_filter", { presetId });
}

/** Creates (if needed) and opens the Path of Exile item filter folder in Windows Explorer. */
export async function openLootFilterFolderIpc(): Promise<string> {
  if (!isTauriRuntime()) {
    return SIM_FILTER_DIR;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("open_loot_filter_folder");
}
