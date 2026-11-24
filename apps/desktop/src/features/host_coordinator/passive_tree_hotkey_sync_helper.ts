import type { HudSessionSnapshot, ValidatedPobBuild } from "@exile-hud/core";
import { applyGggCharacterResponseToSnapshot } from "./ggg_character_sync_reducer.js";
import { pollCharacterWindow, writeVendorRegexClipboard } from "./tauri_ipc_adapter.js";

/** Executes forced or background GGG Character API sync and pushes the updated snapshot. */
export async function executeGggCharacterSync(params: {
  force: boolean;
  accountName: string;
  characterName: string;
  simulatedOutage: boolean;
  activeBuild: ValidatedPobBuild | null;
  getLatestSnapshot: () => HudSessionSnapshot | null;
  pushPatch: (next: HudSessionSnapshot, eventTag: string) => void;
  setSyncMessage: (msg: string | null) => void;
}): Promise<void> {
  const {
    force,
    accountName,
    characterName,
    simulatedOutage,
    activeBuild,
    getLatestSnapshot,
    pushPatch,
    setSyncMessage,
  } = params;

  const cur = getLatestSnapshot();
  if (!cur || !activeBuild) return;
  if (cur.gameId === "poe2") {
    if (force) {
      setSyncMessage("PoE 2 live GGG character sync awaits OAuth 2.1 — using Client.txt & heuristic tracking");
    }
    return;
  }
  if (simulatedOutage) {
    if (force) {
      setSyncMessage("Simulated GGG 429 outage active — using offline fallback targets");
      pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_429_outage");
    }
    return;
  }
  if (!accountName.trim() || !characterName.trim()) {
    if (force) setSyncMessage("Set AccountName#1234 and CharacterName first");
    return;
  }

  const res = await pollCharacterWindow({
    accountName,
    characterName,
    force,
  });

  if (!res.ok && !force) return;
  const latest = getLatestSnapshot();
  if (!latest) return;
  setSyncMessage(res.ok ? `${force ? "Synced" : "Auto-synced"} via Public API` : res.error);
  const next = applyGggCharacterResponseToSnapshot(latest, activeBuild, res);
  if (
    res.ok &&
    next.mode === "TOWN" &&
    next.autoClipboardEnabled &&
    next.activeVendorRegex &&
    next.activeVendorRegex !== latest.activeVendorRegex
  ) {
    void writeVendorRegexClipboard(next.activeVendorRegex);
  }
  pushPatch(next, force ? "ggg_sync" : "auto_ggg_sync");
}
