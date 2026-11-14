import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export type InstallVariant = "portableStandalone" | "nsisSetup";

export interface AppUpdateStateSnapshot {
  phase: AppUpdatePhase;
  currentVersion: string;
  latestVersion: string | null;
  installVariant: InstallVariant;
  updateAvailable: boolean;
  assetDownloadUrl: string | null;
  checksumsUrl: string | null;
  releasePageUrl: string | null;
  assetSizeBytes: number | null;
  progressPercent: number | null;
  lastCheckedAtMs: number | null;
  error: string | null;
}

function buildBrowserPreviewFallbackState(): AppUpdateStateSnapshot {
  const mockUpdate =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mockUpdate") === "1";

  return {
    phase: mockUpdate ? "available" : "idle",
    currentVersion: "0.1.0",
    latestVersion: mockUpdate ? "v0.1.45" : "v0.1.0",
    installVariant: "portableStandalone",
    updateAvailable: mockUpdate,
    assetDownloadUrl: null,
    checksumsUrl: null,
    releasePageUrl: "https://github.com/Srlimao/ExileBuildComppanion/releases/latest",
    assetSizeBytes: mockUpdate ? 12_897_484 : null,
    progressPercent: null,
    lastCheckedAtMs: Date.now(),
    error: null,
  };
}

export async function getAppUpdateStateIpc(): Promise<AppUpdateStateSnapshot> {
  if (!isTauriRuntime()) {
    return buildBrowserPreviewFallbackState();
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AppUpdateStateSnapshot>("get_app_update_state");
}

export async function checkForAppUpdateIpc(): Promise<AppUpdateStateSnapshot> {
  if (!isTauriRuntime()) {
    return buildBrowserPreviewFallbackState();
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AppUpdateStateSnapshot>("check_for_app_update");
}

export async function installAppUpdateIpc(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("install_app_update");
}

export async function subscribeAppUpdateState(
  onChange: (snapshot: AppUpdateStateSnapshot) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<AppUpdateStateSnapshot>("app-update-state-changed", (ev) => {
    onChange(ev.payload);
  });
}
