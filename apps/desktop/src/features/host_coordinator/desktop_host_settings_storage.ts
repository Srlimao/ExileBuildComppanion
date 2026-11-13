export interface HostIdentityPrefs {
  roomId: string;
  hostSecret: string;
  pin: string;
  relayUrl: string;
  accountName: string;
  characterName: string;
}

export const DEFAULT_RELAY_URL = "https://exile.dunhas.com";

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

/** Loads room identity, relay URL, and GGG character prefs from WebView localStorage. */
export function loadHostIdentityPrefs(): HostIdentityPrefs {
  return {
    roomId: localStorage.getItem("exile_room_id") || randomCode(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"),
    hostSecret: localStorage.getItem("exile_host_secret") || randomCode(20, "abcdefghijklmnopqrstuvwxyz0123456789"),
    pin: localStorage.getItem("exile_room_pin") || generateRoomPin(),
    relayUrl: localStorage.getItem("exile_relay_url") || DEFAULT_RELAY_URL,
    accountName: localStorage.getItem("exile_account") || "",
    characterName: localStorage.getItem("exile_character") || "ExileRunner",
  };
}

/** Saves room identity, relay URL, and GGG character prefs into WebView localStorage. */
export function saveHostIdentityPrefs(prefs: HostIdentityPrefs): void {
  localStorage.setItem("exile_room_id", prefs.roomId);
  localStorage.setItem("exile_host_secret", prefs.hostSecret);
  localStorage.setItem("exile_room_pin", prefs.pin);
  localStorage.setItem("exile_relay_url", prefs.relayUrl);
  localStorage.setItem("exile_account", prefs.accountName);
  localStorage.setItem("exile_character", prefs.characterName);
}
