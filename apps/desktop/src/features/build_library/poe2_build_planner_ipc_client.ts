import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";

export interface Poe2BuildPlannerFileSummary {
  fileName: string;
  buildName: string;
  ascendancy: string;
  author: string;
  byteSize: number;
  modifiedAtMs: number;
}

export interface Poe2BuildPlannerScanResult {
  plannerDir: string;
  dirExists: boolean;
  files: Poe2BuildPlannerFileSummary[];
}

/** Lists `.build` files found in `Documents\My Games\Path of Exile 2\BuildPlanner\`. */
export async function scanPoe2BuildPlannerDir(): Promise<Poe2BuildPlannerScanResult> {
  if (!isTauriRuntime()) {
    return { plannerDir: "", dirExists: false, files: [] };
  }
  return invoke<Poe2BuildPlannerScanResult>("scan_poe2_build_planner_dir");
}

/** Reads the UTF-8 JSON content of a specific `.build` file in `BuildPlanner\`. */
export async function readPoe2BuildPlannerFile(fileName: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Reading BuildPlanner folder requires the Windows Desktop app.");
  }
  return invoke<string>("read_poe2_build_planner_file", { fileName });
}

/** Creates (if missing) and opens the PoE 2 `BuildPlanner\` folder in Windows Explorer. */
export async function openPoe2BuildPlannerFolder(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string>("open_poe2_build_planner_folder");
}
