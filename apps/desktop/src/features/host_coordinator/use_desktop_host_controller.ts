import {
  reduceTelemetrySession,
  type HudSessionSnapshot,
  type PobBuildPreview,
  type PobSetSelection,
  type ValidatedPobBuild,
  type ViewerPresenceEntry,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateRoomPin,
  loadHostIdentityPrefs,
  saveHostIdentityPrefs,
} from "./desktop_host_settings_storage.js";
import {
  applyLogLinesToSnapshot,
  bootstrapHostEnvironment,
  hookAndBootstrapLogPath,
  syncBuildSetsForLevel,
} from "./client_log_sync_helper.js";
import {
  applyGggCharacterResponseToSnapshot,
  applyViewerCommandToSnapshot,
  compilePobProfileToSnapshot,
  DEFAULT_STARTER_POB_XML,
  deriveTrayIndicator,
  inspectPobBuildSets,
} from "./desktop_telemetry_bridge.js";
import {
  compileAndSavePobProfile,
  loadInitialSavedOrDefaultProfile,
  openPobStorageFolder,
} from "./pob_profile_persistence_client.js";
import { createHostRelaySession, type HostRelaySession } from "./relay_host_connection.js";
import {
  clearPoesessid,
  detectClientLogPath,
  pollCharacterWindow,
  savePoesessid,
  setTrayTelemetryStatus,
  subscribeTauriListeners,
  writeVendorRegexClipboard,
} from "./tauri_ipc_adapter.js";

export function useDesktopHostController() {
  const [initPrefs] = useState(loadHostIdentityPrefs);
  const [roomId] = useState(initPrefs.roomId);
  const [hostSecret] = useState(initPrefs.hostSecret);
  const [pin, setPin] = useState(initPrefs.pin);
  const [relayUrl, setRelayUrl] = useState(initPrefs.relayUrl);
  const [accountName, setAccountName] = useState(initPrefs.accountName);
  const [characterName, setCharacterName] = useState(initPrefs.characterName);

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
  const activeBuildRef = useRef<ValidatedPobBuild | null>(null);
  snapshotRef.current = snapshot;
  activeBuildRef.current = activeBuild;

  useEffect(() => {
    saveHostIdentityPrefs({ roomId, hostSecret, pin, relayUrl, accountName, characterName });
  }, [roomId, hostSecret, pin, relayUrl, accountName, characterName]);

  const pushPatch = useCallback((next: HudSessionSnapshot, eventTag: string) => {
    setSnapshot(next);
    snapshotRef.current = next;
    relayRef.current?.sendPatch(next, eventTag);
  }, []);

  const connectRelay = useCallback(
    (overrideSnap?: HudSessionSnapshot, overridePin?: string, overrideRelayUrl?: string) => {
      const targetSnap = overrideSnap ?? snapshotRef.current;
      if (!targetSnap) return;
      setRelayError(null);
      relayRef.current?.close();
      relayRef.current = createHostRelaySession({
        relayUrl: overrideRelayUrl ?? relayUrl,
        roomId,
        hostSecret,
        pin: overridePin ?? pin,
        snapshot: targetSnap,
        getLatestSnapshot: () => snapshotRef.current,
        onConnected: () => {
          setRelayConnected(true);
          setRelayError(null);
        },
        onDisconnected: () => setRelayConnected(false),
        onError: (msg) => setRelayError(`${msg} — running offline locally`),
        onViewersChange: setViewers,
        onViewerCommand: (cmd) => {
          if (!snapshotRef.current) return;
          const outcome = applyViewerCommandToSnapshot(snapshotRef.current, cmd);
          if (outcome.copyRegex) void writeVendorRegexClipboard(outcome.copyRegex);
          if (outcome.nextSnapshot && outcome.eventTag) pushPatch(outcome.nextSnapshot, outcome.eventTag);
        },
      });
    },
    [hostSecret, pin, pushPatch, relayUrl, roomId],
  );

  useEffect(() => {
    void (async () => {
      const loaded = await loadInitialSavedOrDefaultProfile({ roomId, characterName }, compilePobProfileToSnapshot);
      const env = await bootstrapHostEnvironment(loaded.compiled.snapshot);
      const synced = syncBuildSetsForLevel(env.snapshot, loaded.compiled.build);

      if (loaded.storagePath) setPobStoragePath(loaded.storagePath);
      setPobInput(loaded.rawInput);
      setLeagueStart(loaded.leagueStart);
      setCustomRouteText(loaded.customRouteText);
      setPobPreview(loaded.compiled.preview);
      setPobSelection(loaded.compiled.selection);
      setActiveBuild(loaded.compiled.build);
      setHasStoredSession(env.hasSession);
      if (env.detectedPath) setClientLogPathState(env.detectedPath);
      setClientLogFound(env.hooked);
      if (synced.characterName && synced.characterName !== characterName) {
        setCharacterName(synced.characterName);
      }

      setSnapshot(synced);
      snapshotRef.current = synced;
      connectRelay(synced);
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
      const cur = snapshotRef.current;
      if (!cur || lines.length === 0) return;
      const logged = applyLogLinesToSnapshot(cur, lines);
      if (logged === cur) return;
      const next = syncBuildSetsForLevel(logged, activeBuildRef.current);
      if (next.characterName !== cur.characterName) setCharacterName(next.characterName);
      if (next.mode === "TOWN" && cur.mode !== "TOWN" && next.autoClipboardEnabled && next.activeVendorRegex) {
        void writeVendorRegexClipboard(next.activeVendorRegex);
      }
      pushPatch(next, "client_log_batch");
    },
    [pushPatch],
  );

  const handleForceSync = useCallback(async () => {
    const cur = snapshotRef.current;
    if (!cur || !activeBuild) return;
    if (simulatedOutage) {
      setSyncMessage("Simulated GGG 429 outage active — using offline fallback targets");
      pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_429_outage");
      return;
    }
    if (!accountName.trim() || !characterName.trim()) {
      setSyncMessage("Set AccountName#1234 and CharacterName first");
      return;
    }
    const res = await pollCharacterWindow({ accountName, characterName, usePoesessid: hasStoredSession, force: true });
    setSyncMessage(res.ok ? `Synced via ${res.usedPoesessid ? "POESESSID" : "Public API"}` : res.error);
    pushPatch(applyGggCharacterResponseToSnapshot(cur, activeBuild, res), "ggg_sync");
  }, [accountName, activeBuild, characterName, hasStoredSession, pushPatch, simulatedOutage]);

  useEffect(() => {
    let cleanup: () => void = () => undefined;
    void subscribeTauriListeners({
      onClientLogLines: processLogLines,
      onPoeProcessState: (running) => {
        const cur = snapshotRef.current;
        if (cur) pushPatch(reduceTelemetrySession(cur, { type: "process_state", running }, poe1GameAdapter), "poe_process");
      },
      onClientLogPathChanged: (nextPath) => {
        setClientLogPathState(nextPath);
        setClientLogFound(true);
        if (snapshotRef.current && !snapshotRef.current.clientLogHooked) {
          pushPatch({ ...snapshotRef.current, clientLogHooked: true }, "log_auto_switched");
        }
      },
      onTrayAction: (action) => {
        if (action === "force-sync") void handleForceSync();
        if (action === "copy-regex" && snapshotRef.current?.activeVendorRegex) {
          void writeVendorRegexClipboard(snapshotRef.current.activeVendorRegex);
        }
      },
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup();
  }, [handleForceSync, processLogLines, pushPatch]);

  const applyBuild = async (nextCfg: { pobInput: string; cachedXml?: string | null; selection?: PobSetSelection | null; leagueStart: boolean; customRouteText: string }) => {
    setCompileLoading(true);
    setCompileError(null);
    try {
      const { compiled, syncedSnapshot } = await compileAndSavePobProfile(
        { roomId, characterName, previousSnapshot: snapshot, ...nextCfg },
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
    const { hooked, nextSnapshot } = await hookAndBootstrapLogPath(p, manual, snapshotRef.current);
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
    relayConnected, relayError, viewers, setAccountName, setCharacterName, applyBuild,
    inspectBuild: (rawPobInput: string, previousSelection?: PobSetSelection | null) => inspectPobBuildSets({ rawPobInput, previousSelection }),
    openStorageFolder: openPobStorageFolder,
    forceSync: handleForceSync,
    simulateLogLines: processLogLines,
    reconnectRelay: () => connectRelay(),
    setRelayUrl: (u: string) => { setRelayUrl(u); connectRelay(undefined, undefined, u); },
    rotatePin: () => { const nextPin = generateRoomPin(); setPin(nextPin); connectRelay(undefined, nextPin); },
    savePoesessid: async (val: string) => { await savePoesessid(val); setHasStoredSession(true); },
    clearPoesessid: async () => { await clearPoesessid(); setHasStoredSession(false); },
    setLogPath: (p: string) => applySelectedLogPath(p, true, "log_path"),
    autoDetectPath: async () => { const res = await detectClientLogPath(); if (res.detectedPath) await applySelectedLogPath(res.detectedPath, false, "log_auto_detect"); },
    toggleAutoClipboard: () => { if (snapshot) pushPatch({ ...snapshot, autoClipboardEnabled: !snapshot.autoClipboardEnabled }, "toggle_clip"); },
    copyRegexNow: async () => { if (snapshot?.activeVendorRegex) await writeVendorRegexClipboard(snapshot.activeVendorRegex); },
    toggleSimPoeRunning: () => { const cur = snapshotRef.current; if (cur) pushPatch(reduceTelemetrySession(cur, { type: "process_state", running: !cur.poeRunning }, poe1GameAdapter), "sim_poe"); },
    toggleSimulatedOutage: () => { const next = !simulatedOutage; setSimulatedOutage(next); const cur = snapshotRef.current; if (cur && next) pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_outage_on"); },
  };
}
