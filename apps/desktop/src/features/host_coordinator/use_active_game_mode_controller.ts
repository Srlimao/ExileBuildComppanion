import type { HudSessionSnapshot, SupportedGameId } from "@exile-hud/core";
import { useCallback, type MutableRefObject } from "react";
import { hookAndBootstrapLogPath } from "./client_log_sync_helper.js";
import {
  loadClientLogPathPrefForGame,
  saveClientLogPathPrefForGame,
} from "./desktop_host_settings_storage.js";
import { setActiveGameModeIpc } from "./tauri_ipc_adapter.js";

interface UseActiveGameModeControllerParams {
  activeGameId: SupportedGameId;
  activeGameIdRef: MutableRefObject<SupportedGameId>;
  clientLogPath: string;
  setActiveGameId: (gameId: SupportedGameId) => void;
  setClientLogPathState: (path: string) => void;
  setClientLogFound: (found: boolean) => void;
  setSyncMessage: (msg: string | null) => void;
  getLiveSnapshot: () => HudSessionSnapshot | null;
  pushPatch: (next: HudSessionSnapshot, eventTag: string) => void;
  switchLibraryToGame: (nextGameId: SupportedGameId, prevGameId: SupportedGameId) => Promise<void>;
}

/** Coordinates explicit PoE 1 <-> PoE 2 switches across library, Rust log tailer, and snapshot. */
export function useActiveGameModeController({
  activeGameId,
  activeGameIdRef,
  clientLogPath,
  setActiveGameId,
  setClientLogPathState,
  setClientLogFound,
  setSyncMessage,
  getLiveSnapshot,
  pushPatch,
  switchLibraryToGame,
}: UseActiveGameModeControllerParams) {
  const switchGameMode = useCallback(
    async (nextGameId: SupportedGameId) => {
      const prevGameId = activeGameIdRef.current;
      if (nextGameId === prevGameId) return;

      if (clientLogPath.trim()) {
        saveClientLogPathPrefForGame(prevGameId, clientLogPath.trim());
      }

      activeGameIdRef.current = nextGameId;
      setActiveGameId(nextGameId);
      setSyncMessage(null);

      await switchLibraryToGame(nextGameId, prevGameId);

      const savedLog = loadClientLogPathPrefForGame(nextGameId).trim();
      const logRes = await setActiveGameModeIpc(nextGameId, savedLog || null, Boolean(savedLog));
      if (logRes.detectedPath) {
        setClientLogPathState(logRes.detectedPath);
        const { hooked, nextSnapshot } = await hookAndBootstrapLogPath(
          logRes.detectedPath,
          Boolean(savedLog),
          getLiveSnapshot(),
        );
        setClientLogFound(hooked);
        if (nextSnapshot) {
          pushPatch(nextSnapshot, "game_mode_switched");
        }
      } else {
        setClientLogPathState(savedLog);
        setClientLogFound(false);
        const cur = getLiveSnapshot();
        if (cur?.clientLogHooked) {
          pushPatch({ ...cur, version: cur.version + 1, clientLogHooked: false }, "game_mode_switched");
        }
      }
    },
    [
      activeGameIdRef,
      clientLogPath,
      getLiveSnapshot,
      pushPatch,
      setActiveGameId,
      setClientLogFound,
      setClientLogPathState,
      setSyncMessage,
      switchLibraryToGame,
    ],
  );

  return { activeGameId, switchGameMode };
}
