import type { HudSessionSnapshot, ValidatedPobBuild } from "@exile-hud/core";
import { applyGggCharacterResponseToSnapshot } from "./desktop_telemetry_bridge.js";
import { pollCharacterWindow } from "./tauri_ipc_adapter.js";

/** Executes forced or background GGG Character API sync and pushes the updated snapshot. */
export async function executeGggCharacterSync(params: {
  force: boolean;
  accountName: string;
  characterName: string;
  hasStoredSession: boolean;
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
    hasStoredSession,
    simulatedOutage,
    activeBuild,
    getLatestSnapshot,
    pushPatch,
    setSyncMessage,
  } = params;

  const cur = getLatestSnapshot();
  if (!cur || !activeBuild) return;
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
    usePoesessid: hasStoredSession,
    force,
  });

  if (!res.ok && !force) return;
  const latest = getLatestSnapshot();
  if (!latest) return;
  const modeLabel = res.usedPoesessid ? "POESESSID" : "Public API";
  setSyncMessage(res.ok ? `${force ? "Synced" : "Auto-synced"} via ${modeLabel}` : res.error);
  pushPatch(
    applyGggCharacterResponseToSnapshot(latest, activeBuild, res),
    force ? "ggg_sync" : "auto_ggg_sync",
  );
}
