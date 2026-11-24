import { normalizeSupportedGameId, type SupportedGameId } from "@exile-hud/game-data";

export interface HostIdentityPrefs {
  activeGameId: SupportedGameId;
  poe1ClientLogPath: string;
  poe2ClientLogPath: string;
  roomId: string;
  hostSecret: string;
  pin: string;
  relayUrl: string;
  accountName: string;
  selectedLeague: string;
  characterName: string;
  passiveTreeHotkey: string;
}

export const DEFAULT_RELAY_URL = "https://exile-relay.dunhas.com";
const ACTIVE_GAME_STORAGE_KEY = "exile_active_game_id_v1";
const POE1_LOG_PATH_KEY = "exile_poe1_client_log_path";
const POE2_LOG_PATH_KEY = "exile_poe2_client_log_path";

export function randomCode(len: number, alphabet: string): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateRoomPin(): string {
  return randomCode(4, "0123456789");
}

/** Loads room identity, active game mode, and per-game prefs from WebView localStorage. */
export function loadHostIdentityPrefs(): HostIdentityPrefs {
  const storedRelay = localStorage.getItem("exile_relay_url");
  const relayUrl =
    !storedRelay || storedRelay === "https://exile.dunhas.com"
      ? DEFAULT_RELAY_URL
      : storedRelay;

  return {
    activeGameId: normalizeSupportedGameId(localStorage.getItem(ACTIVE_GAME_STORAGE_KEY)),
    poe1ClientLogPath: localStorage.getItem(POE1_LOG_PATH_KEY) || "",
    poe2ClientLogPath: localStorage.getItem(POE2_LOG_PATH_KEY) || "",
    roomId: localStorage.getItem("exile_room_id") || randomCode(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"),
    hostSecret: localStorage.getItem("exile_host_secret") || randomCode(20, "abcdefghijklmnopqrstuvwxyz0123456789"),
    pin: localStorage.getItem("exile_room_pin") || generateRoomPin(),
    relayUrl,
    accountName: localStorage.getItem("exile_account") || "",
    selectedLeague: localStorage.getItem("exile_league") || "",
    characterName: localStorage.getItem("exile_character") || "ExileRunner",
    passiveTreeHotkey: localStorage.getItem("exile_tree_hotkey") || "P",
  };
}

/** Saves room identity, active game mode, and per-game prefs into WebView localStorage. */
export function saveHostIdentityPrefs(prefs: HostIdentityPrefs): void {
  localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, prefs.activeGameId);
  localStorage.setItem(POE1_LOG_PATH_KEY, prefs.poe1ClientLogPath);
  localStorage.setItem(POE2_LOG_PATH_KEY, prefs.poe2ClientLogPath);
  localStorage.setItem("exile_room_id", prefs.roomId);
  localStorage.setItem("exile_host_secret", prefs.hostSecret);
  localStorage.setItem("exile_room_pin", prefs.pin);
  localStorage.setItem("exile_relay_url", prefs.relayUrl);
  localStorage.setItem("exile_account", prefs.accountName);
  localStorage.setItem("exile_league", prefs.selectedLeague);
  localStorage.setItem("exile_character", prefs.characterName);
  localStorage.setItem("exile_tree_hotkey", prefs.passiveTreeHotkey);
}

export function saveClientLogPathPrefForGame(gameId: SupportedGameId, logPath: string): void {
  localStorage.setItem(gameId === "poe2" ? POE2_LOG_PATH_KEY : POE1_LOG_PATH_KEY, logPath);
}

export function loadClientLogPathPrefForGame(gameId: SupportedGameId): string {
  return localStorage.getItem(gameId === "poe2" ? POE2_LOG_PATH_KEY : POE1_LOG_PATH_KEY) || "";
}
