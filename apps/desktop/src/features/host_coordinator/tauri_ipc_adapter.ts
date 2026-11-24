import type { SavedCampaignProgress, SupportedGameId } from "@exile-hud/core";

export interface ClientLogDetectionResult {
  detectedPath: string | null;
  checkedCandidates: string[];
}

export interface CharacterPollResponse {
  ok: boolean;
  statusCode: number;
  throttledMs: number | null;
  error: string | null;
  itemsJson: Record<string, any> | null;
  passivesJson: Record<string, any> | null;
}

export interface GggAccountCharacter {
  name: string;
  class: string;
  league: string;
  level: number;
  lastLoginTime: number | null;
  lastActive: boolean;
}

export interface AccountCharactersResponse {
  ok: boolean;
  statusCode: number;
  normalizedAccount: string;
  throttledMs: number | null;
  error: string | null;
  characters: GggAccountCharacter[];
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function callInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function detectClientLogPath(
  gameId?: SupportedGameId,
): Promise<ClientLogDetectionResult> {
  if (!isTauriRuntime()) {
    return {
      detectedPath:
        gameId === "poe2"
          ? "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt"
          : "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt",
      checkedCandidates: [],
    };
  }
  return callInvoke<ClientLogDetectionResult>("detect_client_log_path", {
    ...(gameId ? { gameId } : {}),
  });
}

export async function setActiveGameModeIpc(
  gameId: SupportedGameId,
  logPath?: string | null,
  manual?: boolean,
): Promise<ClientLogDetectionResult> {
  if (!isTauriRuntime()) {
    return detectClientLogPath(gameId);
  }
  return callInvoke<ClientLogDetectionResult>("set_active_game_mode", {
    gameId,
    logPath: logPath ?? null,
    manual: manual ?? Boolean(logPath?.trim()),
  });
}

export async function setClientLogPath(path: string, manual = false): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return callInvoke<boolean>("set_client_log_path", { path, manual });
}

export async function readBootstrapLogLines(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return callInvoke<string[]>("read_bootstrap_log_lines");
}

export async function checkPoeRunning(gameId?: SupportedGameId): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return callInvoke<boolean>("check_poe_running", { ...(gameId ? { gameId } : {}) });
}

export async function writeVendorRegexClipboard(regex: string): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(regex).catch(() => undefined);
    }
    return;
  }
  await callInvoke("write_vendor_regex_clipboard", { regex });
}

export async function pollCharacterWindow(params: {
  accountName: string;
  characterName: string;
  force: boolean;
}): Promise<CharacterPollResponse> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      statusCode: 503,
      throttledMs: 60_000,
      error: "GGG HTTP fetch requires Windows Tauri desktop runtime (use Replay Simulator in browser preview).",
      itemsJson: null,
      passivesJson: null,
    };
  }
  return callInvoke<CharacterPollResponse>("poll_character_window", params);
}

export async function fetchAccountCharactersIpc(accountName: string): Promise<AccountCharactersResponse> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      statusCode: 503,
      normalizedAccount: accountName.trim(),
      throttledMs: null,
      error: "GGG HTTP fetch requires Windows Tauri desktop runtime (use Replay Simulator in browser preview).",
      characters: [],
    };
  }
  return callInvoke<AccountCharactersResponse>("fetch_account_characters", { accountName });
}

export async function setTrayTelemetryStatus(
  status: "gray" | "green" | "amber",
  tooltip: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await callInvoke("set_tray_telemetry_status", { status, tooltip });
}

export async function setTrayLocaleIpc(locale: "pt-BR" | "en"): Promise<void> {
  if (!isTauriRuntime()) return;
  await callInvoke("set_tray_locale", { locale });
}

export interface TauriSavedPobSetSelection {
  passiveSpecIds: string[];
  skillSetIds: string[];
  itemSetIds: string[];
}

export interface TauriSavedPobProfileRecord {
  rawInput: string;
  cachedXml: string | null;
  leagueStart: boolean;
  customRouteText: string;
  selection: TauriSavedPobSetSelection | null;
  updatedAtMs: number;
}

export async function getPobProfileStoragePathIpc(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<string>("get_pob_profile_storage_path");
}

export async function loadSavedPobProfileIpc(): Promise<TauriSavedPobProfileRecord | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<TauriSavedPobProfileRecord | null>("load_saved_pob_profile");
}

export async function savePobProfileIpc(profile: TauriSavedPobProfileRecord): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<string>("save_pob_profile", { profile });
}

export async function loadSavedCampaignProgressIpc(): Promise<SavedCampaignProgress | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<SavedCampaignProgress | null>("load_saved_campaign_progress");
}

export async function saveCampaignProgressIpc(progress: SavedCampaignProgress): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<string>("save_campaign_progress", { progress });
}

export async function openAppDataFolderIpc(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return callInvoke<string>("open_app_data_folder");
}

export async function setPassiveTreeHotkeyIpc(hotkey: string): Promise<boolean> {
  if (!isTauriRuntime()) return hotkey.toUpperCase() !== "OFF";
  return callInvoke<boolean>("set_passive_tree_hotkey", { hotkey });
}

export async function setInGameTreeOpenIpc(open: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  await callInvoke("set_in_game_tree_open", { open });
}

export async function subscribeTauriListeners(handlers: {
  onClientLogLines: (lines: string[]) => void;
  onPoeProcessState: (running: boolean) => void;
  onTrayAction: (action: string) => void;
  onClientLogPathChanged?: (path: string) => void;
  onPassiveTreeState?: (open: boolean) => void;
}): Promise<() => void> {
  if (!isTauriRuntime()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  const unsub1 = await listen<string[]>("client-log-lines", (ev) => handlers.onClientLogLines(ev.payload));
  const unsub2 = await listen<boolean>("poe-process-state", (ev) => handlers.onPoeProcessState(ev.payload));
  const unsub3 = await listen<string>("tray-action", (ev) => handlers.onTrayAction(ev.payload));
  const unsub4 = await listen<string>("client-log-path-changed", (ev) =>
    handlers.onClientLogPathChanged?.(ev.payload),
  );
  const unsub5 = await listen<boolean>("poe-passive-tree-state", (ev) =>
    handlers.onPassiveTreeState?.(ev.payload),
  );
  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
  };
}
