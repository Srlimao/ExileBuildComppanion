import {
  reduceTelemetrySession,
  resetSnapshotProgress,
  type HudSessionSnapshot,
  type SupportedGameId,
  type ValidatedPobBuild,
  type ViewerPresenceEntry,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBuildLibrarySession } from "../build_library/use_build_library_session.js";
import { useHostOverlayBroadcastBridge } from "../overlay_hud/overlay_local_bus.js";
import { persistSnapshotProgressIfNeeded } from "./campaign_progress_persistence_client.js";
import { applyLogLinesToSnapshot, hookAndBootstrapLogPath, syncBuildSetsForLevel } from "./client_log_sync_helper.js";
import {
  generateRoomPin,
  loadClientLogPathPrefForGame,
  loadHostIdentityPrefs,
  saveClientLogPathPrefForGame,
  saveHostIdentityPrefs,
} from "./desktop_host_settings_storage.js";
import { applyViewerCommandToSnapshot } from "./desktop_telemetry_bridge.js";
import { createHostRunTimerClock } from "./host_run_timer_clock.js";
import { executeGggCharacterSync } from "./passive_tree_hotkey_sync_helper.js";
import { createHostRelaySession, type HostRelaySession } from "./relay_host_connection.js";
import {
  detectClientLogPath,
  setInGameTreeOpenIpc,
  setPassiveTreeHotkeyIpc,
  writeVendorRegexClipboard,
} from "./tauri_ipc_adapter.js";
import { useActiveGameModeController } from "./use_active_game_mode_controller.js";
import { useTauriHostEventBridge } from "./use_tauri_host_event_bridge.js";
import { useTrayStatusAndLocaleSync } from "./use_tray_status_and_locale_sync.js";

export function useDesktopHostController() {
  const [initPrefs] = useState(loadHostIdentityPrefs);
  const [activeGameId, setActiveGameId] = useState<SupportedGameId>(initPrefs.activeGameId);
  const [roomId] = useState(initPrefs.roomId);
  const [hostSecret] = useState(initPrefs.hostSecret);
  const [pin, setPin] = useState(initPrefs.pin);
  const [relayUrl, setRelayUrl] = useState(initPrefs.relayUrl);
  const [accountName, setAccountName] = useState(initPrefs.accountName);
  const [selectedLeague, setSelectedLeagueState] = useState(initPrefs.selectedLeague);
  const [characterName, setCharacterNameState] = useState(initPrefs.characterName);
  const [passiveTreeHotkey, setPassiveTreeHotkey] = useState(initPrefs.passiveTreeHotkey);

  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(null);
  const [activeBuild, setActiveBuild] = useState<ValidatedPobBuild | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [simulatedOutage, setSimulatedOutage] = useState(false);
  const [clientLogPath, setClientLogPathState] = useState(() =>
    loadClientLogPathPrefForGame(initPrefs.activeGameId),
  );
  const [clientLogFound, setClientLogFound] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<ViewerPresenceEntry[]>([]);

  const relayRef = useRef<HostRelaySession | null>(null);
  const snapshotRef = useRef<HudSessionSnapshot | null>(null);
  const activeGameIdRef = useRef<SupportedGameId>(activeGameId);
  const timerClockRef = useRef(createHostRunTimerClock());
  const activeBuildRef = useRef<ValidatedPobBuild | null>(null);
  const activeBuildPathRef = useRef<string | null>(null);
  const summarySyncCallbackRef = useRef<(snap: HudSessionSnapshot) => void>(() => undefined);
  const selectedLeagueRef = useRef(selectedLeague);
  const syncPrefsRef = useRef({ accountName, characterName, simulatedOutage });
  activeBuildRef.current = activeBuild;
  activeGameIdRef.current = activeGameId;
  selectedLeagueRef.current = selectedLeague;
  syncPrefsRef.current = { accountName, characterName, simulatedOutage };

  const getLiveSnapshot = useCallback(() => timerClockRef.current.advanceSnapshotRef(snapshotRef), []);

  useEffect(() => {
    saveHostIdentityPrefs({
      activeGameId,
      poe1ClientLogPath: loadClientLogPathPrefForGame("poe1"),
      poe2ClientLogPath: loadClientLogPathPrefForGame("poe2"),
      roomId, hostSecret, pin, relayUrl, accountName, selectedLeague, characterName, passiveTreeHotkey,
    });
  }, [activeGameId, roomId, hostSecret, pin, relayUrl, accountName, selectedLeague, characterName, passiveTreeHotkey]);

  useEffect(() => {
    void setPassiveTreeHotkeyIpc(passiveTreeHotkey);
  }, [passiveTreeHotkey]);

  const pushPatch = useCallback((rawNext: HudSessionSnapshot, eventTag: string) => {
    const next = timerClockRef.current.reconcileOutgoingSnapshot(snapshotRef.current, rawNext, eventTag);
    persistSnapshotProgressIfNeeded(snapshotRef.current, next, eventTag, {
      activeBuildPath: activeBuildPathRef.current,
      onSummaryUpdated: summarySyncCallbackRef.current,
    });
    setSnapshot(next);
    snapshotRef.current = next;
    relayRef.current?.sendPatch(next, eventTag);
  }, []);

  const runGggSync = useCallback(
    (force: boolean) => {
      void executeGggCharacterSync({
        force,
        ...syncPrefsRef.current,
        activeBuild: activeBuildRef.current,
        getLatestSnapshot: getLiveSnapshot,
        pushPatch,
        setSyncMessage,
      });
    },
    [getLiveSnapshot, pushPatch],
  );

  const buildLibrary = useBuildLibrarySession({
    roomId, activeGameId, activeBuildPathRef, snapshotRef, activeBuildRef, timerClockRef, syncPrefsRef,
    getLiveSnapshot, setSnapshot, setActiveBuild, setCharacterName: setCharacterNameState,
    setSelectedLeague: setSelectedLeagueState, pushPatch, runGggSync,
  });
  summarySyncCallbackRef.current = buildLibrary.updateActiveListingSummary;

  const { switchGameMode } = useActiveGameModeController({
    activeGameId, activeGameIdRef, clientLogPath, setActiveGameId,
    setClientLogPathState, setClientLogFound, setSyncMessage, getLiveSnapshot,
    pushPatch, switchLibraryToGame: buildLibrary.switchLibraryToGame,
  });

  const handleViewerCommand = useCallback(
    (cmd: ViewerToRoomMessage) => {
      const cur = getLiveSnapshot();
      if (!cur) return;
      const outcome = applyViewerCommandToSnapshot(cur, cmd);
      if (outcome.copyRegex) void writeVendorRegexClipboard(outcome.copyRegex);
      if (outcome.requestSync) runGggSync(true);
      if (outcome.nextSnapshot && outcome.eventTag) pushPatch(outcome.nextSnapshot, outcome.eventTag);
    },
    [getLiveSnapshot, pushPatch, runGggSync],
  );

  useHostOverlayBroadcastBridge(snapshot, snapshotRef, handleViewerCommand, getLiveSnapshot);

  const connectRelay = useCallback(
    (overrideSnap?: HudSessionSnapshot, overridePin?: string, overrideRelayUrl?: string) => {
      const targetSnap = overrideSnap ?? getLiveSnapshot();
      if (!targetSnap) return;
      setRelayError(null);
      relayRef.current?.close();
      relayRef.current = createHostRelaySession({
        relayUrl: overrideRelayUrl ?? relayUrl, roomId, hostSecret, pin: overridePin ?? pin,
        snapshot: targetSnap, getLatestSnapshot: getLiveSnapshot,
        onConnected: () => { setRelayConnected(true); setRelayError(null); },
        onDisconnected: () => setRelayConnected(false),
        onError: (msg) => setRelayError(`${msg} — running offline locally`),
        onViewersChange: setViewers, onViewerCommand: handleViewerCommand,
      });
    },
    [getLiveSnapshot, handleViewerCommand, hostSecret, pin, relayUrl, roomId],
  );

  useEffect(() => {
    void (async () => {
      const savedLog = loadClientLogPathPrefForGame(activeGameIdRef.current);
      const booted = await buildLibrary.bootstrapInitialLibraryBuild(savedLog || null);
      if (booted.detectedLogPath) {
        setClientLogPathState(booted.detectedLogPath);
        saveClientLogPathPrefForGame(activeGameIdRef.current, booted.detectedLogPath);
      }
      setClientLogFound(booted.clientLogHooked);
      connectRelay(booted.snapshot);
      runGggSync(false);
    })();
    return () => relayRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTrayStatusAndLocaleSync(snapshot, relayConnected);

  const processLogLines = useCallback(
    (lines: string[]) => {
      const cur = getLiveSnapshot();
      if (!cur || lines.length === 0) return;
      const logged = applyLogLinesToSnapshot(cur, lines);
      if (logged === cur) return;
      const next = syncBuildSetsForLevel(logged, activeBuildRef.current);
      if (next.characterName !== cur.characterName) {
        setCharacterNameState(next.characterName);
        syncPrefsRef.current.characterName = next.characterName;
        buildLibrary.persistCharacterLink(next.characterName);
      }
      if (cur.currentAreaId !== next.currentAreaId && cur.inGameTreeOpen) void setInGameTreeOpenIpc(false);
      if (next.mode === "TOWN" && cur.mode !== "TOWN" && next.autoClipboardEnabled && next.activeVendorRegex) {
        void writeVendorRegexClipboard(next.activeVendorRegex);
      }
      if (cur.currentAreaId !== next.currentAreaId) runGggSync(false);
      pushPatch(next, "client_log_batch");
    },
    [buildLibrary, getLiveSnapshot, pushPatch, runGggSync],
  );

  useTauriHostEventBridge({
    snapshotRef, processLogLines, pushPatch, runGggSync, setClientLogPathState, setClientLogFound,
  });

  const applySelectedLogPath = async (p: string, manual: boolean, eventTag: string) => {
    setClientLogPathState(p);
    saveClientLogPathPrefForGame(activeGameIdRef.current, p);
    const { hooked, nextSnapshot } = await hookAndBootstrapLogPath(p, manual, getLiveSnapshot());
    setClientLogFound(hooked);
    if (nextSnapshot) {
      if (nextSnapshot.characterName) {
        setCharacterNameState(nextSnapshot.characterName);
        buildLibrary.persistCharacterLink(nextSnapshot.characterName);
      }
      pushPatch(nextSnapshot, eventTag);
    }
  };

  const setCharacterName = useCallback(
    (nextChar: string) => {
      setCharacterNameState(nextChar);
      syncPrefsRef.current.characterName = nextChar;
      buildLibrary.persistCharacterLink(nextChar, selectedLeagueRef.current);
    },
    [buildLibrary],
  );

  const setSelectedLeague = useCallback(
    (nextLeague: string) => {
      setSelectedLeagueState(nextLeague);
      selectedLeagueRef.current = nextLeague;
      buildLibrary.persistCharacterLink(syncPrefsRef.current.characterName, nextLeague);
    },
    [buildLibrary],
  );

  const selectCharacter = useCallback(
    (nextChar: string, nextAccount?: string) => {
      if (nextAccount !== undefined) {
        setAccountName(nextAccount);
        syncPrefsRef.current.accountName = nextAccount;
      }
      setCharacterNameState(nextChar);
      syncPrefsRef.current.characterName = nextChar;
      buildLibrary.persistCharacterLink(nextChar, selectedLeagueRef.current);
      const cur = getLiveSnapshot();
      if (cur && nextChar && cur.characterName !== nextChar) {
        pushPatch({ ...cur, version: cur.version + 1, characterName: nextChar }, "select_character");
      }
      if (nextChar.trim()) runGggSync(true);
    },
    [buildLibrary, getLiveSnapshot, pushPatch, runGggSync],
  );

  return {
    activeGameId, switchGameMode,
    roomId, pin, relayUrl, snapshot, accountName, selectedLeague, characterName,
    syncMessage, simulatedOutage, clientLogPath, clientLogFound,
    relayConnected, relayError, viewers, passiveTreeHotkey, setPassiveTreeHotkey,
    setAccountName, setSelectedLeague, setCharacterName, selectCharacter, buildLibrary,
    forceSync: async () => runGggSync(true),
    simulateLogLines: processLogLines,
    toggleSimInGameTree: () => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const open = !cur.inGameTreeOpen;
      void setInGameTreeOpenIpc(open);
      pushPatch(reduceTelemetrySession(cur, { type: "in_game_tree_state", open }, getGameAdapter(cur.gameId)), "sim_tree");
    },
    reconnectRelay: () => connectRelay(),
    setRelayUrl: (u: string) => { setRelayUrl(u); connectRelay(undefined, undefined, u); },
    rotatePin: () => { const nextPin = generateRoomPin(); setPin(nextPin); connectRelay(undefined, nextPin); },
    setLogPath: (p: string) => applySelectedLogPath(p, true, "log_path"),
    autoDetectPath: async () => { const res = await detectClientLogPath(activeGameIdRef.current); if (res.detectedPath) await applySelectedLogPath(res.detectedPath, false, "log_auto_detect"); },
    toggleAutoClipboard: () => { const cur = getLiveSnapshot(); if (cur) pushPatch({ ...cur, autoClipboardEnabled: !cur.autoClipboardEnabled }, "toggle_clip"); },
    copyRegexNow: async () => { if (snapshot?.activeVendorRegex) await writeVendorRegexClipboard(snapshot.activeVendorRegex); },
    toggleSimPoeRunning: () => { const cur = snapshotRef.current; if (cur) pushPatch(reduceTelemetrySession(cur, { type: "process_state", running: !cur.poeRunning }, getGameAdapter(cur.gameId)), "sim_poe"); },
    toggleSimulatedOutage: () => { const next = !simulatedOutage; setSimulatedOutage(next); const cur = snapshotRef.current; if (cur && next) pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_outage_on"); },
    resetProgress: () => { const cur = snapshotRef.current; if (cur) pushPatch(resetSnapshotProgress(cur), "reset_progress"); },
  };
}
