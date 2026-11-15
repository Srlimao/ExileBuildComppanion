import {
  reduceTelemetrySession,
  resetSnapshotProgress,
  type HudSessionSnapshot,
  type PobBuildPreview,
  type PobSetSelection,
  type ValidatedPobBuild,
  type ViewerPresenceEntry,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { useCallback, useEffect, useRef, useState } from "react";
import { initializeHostSessionWithProgress, persistSnapshotProgressIfNeeded } from "./campaign_progress_persistence_client.js";
import { generateRoomPin, loadHostIdentityPrefs, saveHostIdentityPrefs } from "./desktop_host_settings_storage.js";
import { applyLogLinesToSnapshot, hookAndBootstrapLogPath, syncBuildSetsForLevel } from "./client_log_sync_helper.js";
import { applyGggCharacterResponseToSnapshot, applyViewerCommandToSnapshot, compilePobProfileToSnapshot, DEFAULT_STARTER_POB_XML, deriveTrayIndicator, inspectPobBuildSets } from "./desktop_telemetry_bridge.js";
import { compileAndSavePobProfile, openPobStorageFolder } from "./pob_profile_persistence_client.js";
import { createHostRunTimerClock } from "./host_run_timer_clock.js";
import { createHostRelaySession, type HostRelaySession } from "./relay_host_connection.js";
import {
  clearPoesessid,
  detectClientLogPath,
  savePoesessid,
  setInGameTreeOpenIpc,
  setPassiveTreeHotkeyIpc,
  setTrayTelemetryStatus,
  writeVendorRegexClipboard,
} from "./tauri_ipc_adapter.js";
import { executeGggCharacterSync } from "./passive_tree_hotkey_sync_helper.js";
import { useTauriHostEventBridge } from "./use_tauri_host_event_bridge.js";
import { useHostOverlayBroadcastBridge } from "../overlay_hud/overlay_local_bus.js";

export function useDesktopHostController() {
  const [initPrefs] = useState(loadHostIdentityPrefs);
  const [roomId] = useState(initPrefs.roomId);
  const [hostSecret] = useState(initPrefs.hostSecret);
  const [pin, setPin] = useState(initPrefs.pin);
  const [relayUrl, setRelayUrl] = useState(initPrefs.relayUrl);
  const [accountName, setAccountName] = useState(initPrefs.accountName);
  const [characterName, setCharacterName] = useState(initPrefs.characterName);
  const [passiveTreeHotkey, setPassiveTreeHotkey] = useState(initPrefs.passiveTreeHotkey);

  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(null);
  const [activeBuild, setActiveBuild] = useState<ValidatedPobBuild | null>(null);
  const [pobInput, setPobInput] = useState(DEFAULT_STARTER_POB_XML);
  const [pobPreview, setPobPreview] = useState<PobBuildPreview | null>(null);
  const [pobSelection, setPobSelection] = useState<PobSetSelection | null>(null);
  const [pobStoragePath, setPobStoragePath] = useState("");
  const [leagueStart, setLeagueStart] = useState(true);
  const [customRouteText, setCustomRouteText] = useState("");
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [simulatedOutage, setSimulatedOutage] = useState(false);
  const [clientLogPath, setClientLogPathState] = useState("");
  const [clientLogFound, setClientLogFound] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<ViewerPresenceEntry[]>([]);

  const relayRef = useRef<HostRelaySession | null>(null);
  const snapshotRef = useRef<HudSessionSnapshot | null>(null);
  const timerClockRef = useRef(createHostRunTimerClock());
  const activeBuildRef = useRef<ValidatedPobBuild | null>(null);
  const syncPrefsRef = useRef({ accountName, characterName, hasStoredSession, simulatedOutage });
  activeBuildRef.current = activeBuild;
  syncPrefsRef.current = { accountName, characterName, hasStoredSession, simulatedOutage };

  const getLiveSnapshot = useCallback(() => timerClockRef.current.advanceSnapshotRef(snapshotRef), []);

  useEffect(() => {
    saveHostIdentityPrefs({ roomId, hostSecret, pin, relayUrl, accountName, characterName, passiveTreeHotkey });
  }, [roomId, hostSecret, pin, relayUrl, accountName, characterName, passiveTreeHotkey]);

  useEffect(() => {
    void setPassiveTreeHotkeyIpc(passiveTreeHotkey);
  }, [passiveTreeHotkey]);

  const pushPatch = useCallback((rawNext: HudSessionSnapshot, eventTag: string) => {
    const next = timerClockRef.current.reconcileOutgoingSnapshot(snapshotRef.current, rawNext, eventTag);
    persistSnapshotProgressIfNeeded(snapshotRef.current, next, eventTag);
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
        relayUrl: overrideRelayUrl ?? relayUrl,
        roomId,
        hostSecret,
        pin: overridePin ?? pin,
        snapshot: targetSnap,
        getLatestSnapshot: getLiveSnapshot,
        onConnected: () => {
          setRelayConnected(true);
          setRelayError(null);
        },
        onDisconnected: () => setRelayConnected(false),
        onError: (msg) => setRelayError(`${msg} — running offline locally`),
        onViewersChange: setViewers,
        onViewerCommand: handleViewerCommand,
      });
    },
    [getLiveSnapshot, handleViewerCommand, hostSecret, pin, relayUrl, roomId],
  );

  useEffect(() => {
    void (async () => {
      const init = await initializeHostSessionWithProgress({ roomId, characterName }, compilePobProfileToSnapshot);
      const { compiled, env, hydratedSnapshot } = init;

      if (init.storagePath) setPobStoragePath(init.storagePath);
      setPobInput(init.rawInput);
      setLeagueStart(init.leagueStart);
      setCustomRouteText(init.customRouteText);
      setPobPreview(compiled.preview);
      setPobSelection(compiled.selection);
      setActiveBuild(compiled.build);
      setHasStoredSession(env.hasSession);
      if (env.detectedPath) setClientLogPathState(env.detectedPath);
      setClientLogFound(env.hooked);
      if (hydratedSnapshot.characterName && hydratedSnapshot.characterName !== characterName) {
        setCharacterName(hydratedSnapshot.characterName);
      }

      timerClockRef.current.syncBaseSnapshot(hydratedSnapshot);
      setSnapshot(hydratedSnapshot);
      snapshotRef.current = hydratedSnapshot;
      activeBuildRef.current = compiled.build;
      syncPrefsRef.current = {
        ...syncPrefsRef.current,
        characterName: hydratedSnapshot.characterName || characterName,
        hasStoredSession: env.hasSession,
      };
      connectRelay(hydratedSnapshot);
      runGggSync(false);
    })();
    return () => relayRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const indicator = deriveTrayIndicator(snapshot, relayConnected);
    void setTrayTelemetryStatus(indicator.status, indicator.tooltip);
  }, [snapshot, relayConnected]);

  const processLogLines = useCallback(
    (lines: string[]) => {
      const cur = getLiveSnapshot();
      if (!cur || lines.length === 0) return;
      const logged = applyLogLinesToSnapshot(cur, lines);
      if (logged === cur) return;
      const next = syncBuildSetsForLevel(logged, activeBuildRef.current);
      if (next.characterName !== cur.characterName) {
        setCharacterName(next.characterName);
        syncPrefsRef.current.characterName = next.characterName;
      }
      if (cur.currentAreaId !== next.currentAreaId && cur.inGameTreeOpen) {
        void setInGameTreeOpenIpc(false);
      }
      if (next.mode === "TOWN" && cur.mode !== "TOWN" && next.autoClipboardEnabled && next.activeVendorRegex) {
        void writeVendorRegexClipboard(next.activeVendorRegex);
      }
      if (cur.currentAreaId !== next.currentAreaId) runGggSync(false);
      pushPatch(next, "client_log_batch");
    },
    [getLiveSnapshot, pushPatch, runGggSync],
  );

  useTauriHostEventBridge({
    snapshotRef,
    processLogLines,
    pushPatch,
    runGggSync,
    setClientLogPathState,
    setClientLogFound,
  });

  const applyBuild = async (nextCfg: { pobInput: string; cachedXml?: string | null; selection?: PobSetSelection | null; leagueStart: boolean; customRouteText: string }) => {
    setCompileLoading(true);
    setCompileError(null);
    try {
      const { compiled, syncedSnapshot } = await compileAndSavePobProfile(
        { roomId, characterName, previousSnapshot: getLiveSnapshot(), ...nextCfg },
        compilePobProfileToSnapshot,
        syncBuildSetsForLevel,
      );
      setPobInput(nextCfg.pobInput);
      setLeagueStart(nextCfg.leagueStart);
      setCustomRouteText(nextCfg.customRouteText);
      setActiveBuild(compiled.build);
      setPobPreview(compiled.preview);
      setPobSelection(compiled.selection);
      pushPatch(syncedSnapshot, "build_updated");
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompileLoading(false);
    }
  };

  const applySelectedLogPath = async (p: string, manual: boolean, eventTag: string) => {
    setClientLogPathState(p);
    const { hooked, nextSnapshot } = await hookAndBootstrapLogPath(p, manual, getLiveSnapshot());
    setClientLogFound(hooked);
    if (nextSnapshot) {
      if (nextSnapshot.characterName) setCharacterName(nextSnapshot.characterName);
      pushPatch(nextSnapshot, eventTag);
    }
  };

  return {
    roomId, pin, relayUrl, snapshot, pobInput, pobPreview, pobSelection, pobStoragePath,
    leagueStart, customRouteText, compileLoading, compileError, accountName, characterName,
    hasStoredSession, syncMessage, simulatedOutage, clientLogPath, clientLogFound,
    relayConnected, relayError, viewers, passiveTreeHotkey, setPassiveTreeHotkey,
    setAccountName, setCharacterName, applyBuild,
    inspectBuild: (rawPobInput: string, previousSelection?: PobSetSelection | null) => inspectPobBuildSets({ rawPobInput, previousSelection }),
    openStorageFolder: openPobStorageFolder,
    forceSync: async () => runGggSync(true),
    simulateLogLines: processLogLines,
    toggleSimInGameTree: () => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const open = !cur.inGameTreeOpen;
      void setInGameTreeOpenIpc(open);
      pushPatch(reduceTelemetrySession(cur, { type: "in_game_tree_state", open }, poe1GameAdapter), "sim_tree");
    },
    reconnectRelay: () => connectRelay(),
    setRelayUrl: (u: string) => { setRelayUrl(u); connectRelay(undefined, undefined, u); },
    rotatePin: () => { const nextPin = generateRoomPin(); setPin(nextPin); connectRelay(undefined, nextPin); },
    savePoesessid: async (val: string) => { await savePoesessid(val); setHasStoredSession(true); },
    clearPoesessid: async () => { await clearPoesessid(); setHasStoredSession(false); },
    setLogPath: (p: string) => applySelectedLogPath(p, true, "log_path"),
    autoDetectPath: async () => { const res = await detectClientLogPath(); if (res.detectedPath) await applySelectedLogPath(res.detectedPath, false, "log_auto_detect"); },
    toggleAutoClipboard: () => { const cur = getLiveSnapshot(); if (cur) pushPatch({ ...cur, autoClipboardEnabled: !cur.autoClipboardEnabled }, "toggle_clip"); },
    copyRegexNow: async () => { if (snapshot?.activeVendorRegex) await writeVendorRegexClipboard(snapshot.activeVendorRegex); },
    toggleSimPoeRunning: () => { const cur = snapshotRef.current; if (cur) pushPatch(reduceTelemetrySession(cur, { type: "process_state", running: !cur.poeRunning }, poe1GameAdapter), "sim_poe"); },
    toggleSimulatedOutage: () => { const next = !simulatedOutage; setSimulatedOutage(next); const cur = snapshotRef.current; if (cur && next) pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_outage_on"); },
    resetProgress: () => { const cur = snapshotRef.current; if (cur) pushPatch(resetSnapshotProgress(cur), "reset_progress"); },
  };
}
