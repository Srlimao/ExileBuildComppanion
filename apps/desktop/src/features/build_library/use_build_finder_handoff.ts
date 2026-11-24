import type { SupportedGameId } from "@exile-hud/core";
import { useEffect, useRef } from "react";
import {
  subscribeBuildFinderSelected,
  type BuildFinderSelectionPayload,
} from "../build_finder/build_finder_ipc_and_api.js";

interface UseBuildFinderHandoffArgs {
  activeGameId?: SupportedGameId;
  notesTouched: boolean;
  onApplySelection: (payload: {
    name: string;
    rawInput: string;
    leagueStart: boolean;
    notes?: string;
  }) => void;
}

/** Subscribes to `build-finder:selected` events and applies incoming builds into the New Build editor. */
export function useBuildFinderHandoff({
  activeGameId,
  notesTouched,
  onApplySelection,
}: UseBuildFinderHandoffArgs) {
  const latestRef = useRef({ activeGameId, notesTouched, onApplySelection });
  latestRef.current = { activeGameId, notesTouched, onApplySelection };

  useEffect(() => {
    let unsub: () => void = () => undefined;
    void subscribeBuildFinderSelected((payload: BuildFinderSelectionPayload) => {
      const { activeGameId: game, notesTouched: touched, onApplySelection: apply } = latestRef.current;
      if (game && payload.gameId !== game) return;
      const guideNote = [
        payload.guideUrl ? `Guide: ${payload.guideUrl}` : "",
        payload.author ? `Author: ${payload.author} (${payload.source})` : "",
        payload.patchVersion ? `Patch: ${payload.patchVersion}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      apply({
        name: payload.title,
        rawInput: payload.pobInput,
        leagueStart: payload.leagueStart,
        notes: !touched && guideNote ? guideNote : undefined,
      });
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);
}
