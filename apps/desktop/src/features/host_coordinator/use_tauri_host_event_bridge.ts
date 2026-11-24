import { reduceTelemetrySession, type HudSessionSnapshot } from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import { useEffect, type MutableRefObject } from "react";
import { subscribeTauriListeners, writeVendorRegexClipboard } from "./tauri_ipc_adapter.js";

interface UseTauriHostEventBridgeParams {
  snapshotRef: MutableRefObject<HudSessionSnapshot | null>;
  processLogLines: (lines: string[]) => void;
  pushPatch: (next: HudSessionSnapshot, eventTag: string) => void;
  runGggSync: (force: boolean) => void;
  setClientLogPathState: (path: string) => void;
  setClientLogFound: (found: boolean) => void;
}

/** Subscribes to Rust host telemetry events (log lines, PoE process state, hotkey, tray actions). */
export function useTauriHostEventBridge({
  snapshotRef,
  processLogLines,
  pushPatch,
  runGggSync,
  setClientLogPathState,
  setClientLogFound,
}: UseTauriHostEventBridgeParams): void {
  useEffect(() => {
    let cleanup: () => void = () => undefined;
    void subscribeTauriListeners({
      onClientLogLines: processLogLines,
      onPoeProcessState: (running) => {
        const cur = snapshotRef.current;
        if (cur) {
          pushPatch(
            reduceTelemetrySession(cur, { type: "process_state", running }, getGameAdapter(cur.gameId)),
            "poe_process",
          );
        }
      },
      onClientLogPathChanged: (nextPath) => {
        setClientLogPathState(nextPath);
        setClientLogFound(true);
        if (snapshotRef.current && !snapshotRef.current.clientLogHooked) {
          pushPatch({ ...snapshotRef.current, clientLogHooked: true }, "log_auto_switched");
        }
      },
      onPassiveTreeState: (open) => {
        const cur = snapshotRef.current;
        if (cur) {
          pushPatch(
            reduceTelemetrySession(cur, { type: "in_game_tree_state", open }, getGameAdapter(cur.gameId)),
            "poe_tree_hotkey",
          );
        }
        if (open) runGggSync(false);
      },
      onTrayAction: (action) => {
        if (action === "force-sync") runGggSync(true);
        if (action === "copy-regex" && snapshotRef.current?.activeVendorRegex) {
          void writeVendorRegexClipboard(snapshotRef.current.activeVendorRegex);
        }
      },
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup();
  }, [processLogLines, pushPatch, runGggSync, setClientLogFound, setClientLogPathState, snapshotRef]);
}
