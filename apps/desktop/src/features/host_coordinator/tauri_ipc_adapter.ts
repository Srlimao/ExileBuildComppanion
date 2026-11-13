export interface ClientLogDetectionResult {
  detectedPath: string | null;
  checkedCandidates: string[];
}

export interface CharacterPollResponse {
  ok: boolean;
  statusCode: number;
  usedPoesessid: boolean;
  throttledMs: number | null;
  error: string | null;
  itemsJson: Record<string, any> | null;
  passivesJson: Record<string, any> | null;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let mockVaultHasSession = false;

async function callInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function detectClientLogPath(): Promise<ClientLogDetectionResult> {
  if (!isTauriRuntime()) {
    return {
      detectedPath: "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt",
      checkedCandidates: [],
    };
  }
  return callInvoke<ClientLogDetectionResult>("detect_client_log_path");
}

export async function setClientLogPath(path: string, manual = false): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return callInvoke<boolean>("set_client_log_path", { path, manual });
}

export async function readBootstrapLogLines(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return callInvoke<string[]>("read_bootstrap_log_lines");
}

export async function checkPoeRunning(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return callInvoke<boolean>("check_poe_running");
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

export async function savePoesessid(value: string): Promise<void> {
  if (!isTauriRuntime()) {
    mockVaultHasSession = value.trim().length > 0;
    return;
  }
  await callInvoke("save_poesessid", { value });
}

export async function hasPoesessid(): Promise<boolean> {
  if (!isTauriRuntime()) return mockVaultHasSession;
  return callInvoke<boolean>("has_poesessid");
}

export async function clearPoesessid(): Promise<void> {
  if (!isTauriRuntime()) {
    mockVaultHasSession = false;
    return;
  }
  await callInvoke("clear_poesessid");
}

export async function pollCharacterWindow(params: {
  accountName: string;
  characterName: string;
  usePoesessid: boolean;
  force: boolean;
}): Promise<CharacterPollResponse> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      statusCode: 503,
      usedPoesessid: false,
      throttledMs: 60_000,
      error: "GGG HTTP fetch requires Windows Tauri desktop runtime (use Replay Simulator in browser preview).",
      itemsJson: null,
      passivesJson: null,
    };
  }
  return callInvoke<CharacterPollResponse>("poll_character_window", params);
}

export async function setTrayTelemetryStatus(
  status: "gray" | "green" | "amber",
  tooltip: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await callInvoke("set_tray_telemetry_status", { status, tooltip });
}

export async function subscribeTauriListeners(handlers: {
  onClientLogLines: (lines: string[]) => void;
  onPoeProcessState: (running: boolean) => void;
  onTrayAction: (action: string) => void;
  onClientLogPathChanged?: (path: string) => void;
}): Promise<() => void> {
  if (!isTauriRuntime()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  const unsub1 = await listen<string[]>("client-log-lines", (ev) => handlers.onClientLogLines(ev.payload));
  const unsub2 = await listen<boolean>("poe-process-state", (ev) => handlers.onPoeProcessState(ev.payload));
  const unsub3 = await listen<string>("tray-action", (ev) => handlers.onTrayAction(ev.payload));
  const unsub4 = await listen<string>("client-log-path-changed", (ev) =>
    handlers.onClientLogPathChanged?.(ev.payload),
  );
  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
}
