import {
  parseClientLogLine,
  reduceTelemetrySession,
  type HudSessionSnapshot,
  type ValidatedPobBuild,
  type ViewerPresenceEntry,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyGggCharacterResponseToSnapshot,
  applyViewerCommandToSnapshot,
  compilePobProfileToSnapshot,
  DEFAULT_STARTER_POB_XML,
  deriveTrayIndicator,
} from "./desktop_telemetry_bridge.js";
import { registerAndOpenHostRelaySocket } from "./relay_host_connection.js";
import {
  clearPoesessid,
  detectClientLogPath,
  hasPoesessid,
  pollCharacterWindow,
  savePoesessid,
  setClientLogPath,
  setTrayTelemetryStatus,
  subscribeTauriListeners,
  writeVendorRegexClipboard,
} from "./tauri_ipc_adapter.js";

function randomCode(len: number, alphabet: string): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const DEFAULT_RELAY = "https://exile.dunhas.com";

export function useDesktopHostController() {
  const [roomId] = useState(() => localStorage.getItem("exile_room_id") || randomCode(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"));
  const [hostSecret] = useState(() => localStorage.getItem("exile_host_secret") || randomCode(20, "abcdefghijklmnopqrstuvwxyz0123456789"));
  const [pin, setPin] = useState(() => localStorage.getItem("exile_room_pin") || randomCode(4, "0123456789"));
  const [relayUrl, setRelayUrl] = useState(() => localStorage.getItem("exile_relay_url") || DEFAULT_RELAY);

  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(null);
  const [activeBuild, setActiveBuild] = useState<ValidatedPobBuild | null>(null);
  const [pobInput, setPobInput] = useState(DEFAULT_STARTER_POB_XML);
  const [leagueStart, setLeagueStart] = useState(true);
  const [customRouteText, setCustomRouteText] = useState("");
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const [accountName, setAccountName] = useState(() => localStorage.getItem("exile_account") || "");
  const [characterName, setCharacterName] = useState(() => localStorage.getItem("exile_character") || "ExileRunner");
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [simulatedOutage, setSimulatedOutage] = useState(false);

  const [clientLogPath, setClientLogPathState] = useState("");
  const [clientLogFound, setClientLogFound] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<ViewerPresenceEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<HudSessionSnapshot | null>(null);
  snapshotRef.current = snapshot;

  useEffect(() => {
    localStorage.setItem("exile_room_id", roomId);
    localStorage.setItem("exile_host_secret", hostSecret);
    localStorage.setItem("exile_room_pin", pin);
    localStorage.setItem("exile_relay_url", relayUrl);
    localStorage.setItem("exile_account", accountName);
    localStorage.setItem("exile_character", characterName);
  }, [roomId, hostSecret, pin, relayUrl, accountName, characterName]);

  const pushPatch = useCallback((next: HudSessionSnapshot, eventTag: string) => {
    setSnapshot(next);
    snapshotRef.current = next;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "host:state_patch", snapshot: next, eventTag }));
    }
  }, []);

  const connectRelay = useCallback(
    async (overrideSnap?: HudSessionSnapshot, overridePin?: string, overrideRelayUrl?: string) => {
      const targetSnap = overrideSnap ?? snapshotRef.current;
      if (!targetSnap) return;
      try {
        setRelayError(null);
        wsRef.current?.close();
        wsRef.current = await registerAndOpenHostRelaySocket({
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
          onViewersChange: setViewers,
          onViewerCommand: (cmd) => {
            if (!snapshotRef.current) return;
            const outcome = applyViewerCommandToSnapshot(snapshotRef.current, cmd);
            if (outcome.copyRegex) void writeVendorRegexClipboard(outcome.copyRegex);
            if (outcome.nextSnapshot && outcome.eventTag) pushPatch(outcome.nextSnapshot, outcome.eventTag);
          },
        });
      } catch (err) {
        setRelayConnected(false);
        setRelayError(`Relay unreachable (${err instanceof Error ? err.message : String(err)}) — running offline locally`);
      }
    },
    [hostSecret, pin, pushPatch, relayUrl, roomId],
  );

  useEffect(() => {
    void (async () => {
      const compiled = await compilePobProfileToSnapshot({
        roomId,
        profileId: "default-starter",
        rawPobInput: DEFAULT_STARTER_POB_XML,
        leagueStart: true,
        characterName,
      });
      setActiveBuild(compiled.build);
      setSnapshot(compiled.snapshot);
      snapshotRef.current = compiled.snapshot;

      const [logRes, sess] = await Promise.all([detectClientLogPath(), hasPoesessid()]);
      setHasStoredSession(sess);
      if (logRes.detectedPath) {
        setClientLogPathState(logRes.detectedPath);
        setClientLogFound(await setClientLogPath(logRes.detectedPath));
      }
      await connectRelay(compiled.snapshot);
    })();
    return () => wsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const indicator = deriveTrayIndicator(snapshot, relayConnected);
    void setTrayTelemetryStatus(indicator.status, indicator.tooltip);
  }, [snapshot, relayConnected]);

  const processLogLines = useCallback(
    (lines: string[]) => {
      let next = snapshotRef.current;
      if (!next) return;
      const prevMode = next.mode;
      for (const raw of lines) {
        const parsed = parseClientLogLine(raw);
        if (!parsed) continue;
        next = reduceTelemetrySession(next, { type: "client_log", event: parsed, autoDetectCharacter: true }, poe1GameAdapter);
      }
      if (next !== snapshotRef.current) {
        if (next.mode === "TOWN" && prevMode !== "TOWN" && next.autoClipboardEnabled && next.activeVendorRegex) {
          void writeVendorRegexClipboard(next.activeVendorRegex);
        }
        pushPatch(next, "client_log_batch");
      }
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

  const applyBuild = async (nextCfg: { pobInput: string; leagueStart: boolean; customRouteText: string }) => {
    setCompileLoading(true);
    setCompileError(null);
    try {
      const compiled = await compilePobProfileToSnapshot({
        roomId,
        profileId: "user-build",
        rawPobInput: nextCfg.pobInput,
        customRouteText: nextCfg.customRouteText,
        leagueStart: nextCfg.leagueStart,
        characterName,
        previousSnapshot: snapshot,
      });
      setPobInput(nextCfg.pobInput);
      setLeagueStart(nextCfg.leagueStart);
      setCustomRouteText(nextCfg.customRouteText);
      setActiveBuild(compiled.build);
      pushPatch(compiled.snapshot, "build_updated");
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompileLoading(false);
    }
  };

  return {
    roomId, pin, relayUrl, snapshot, pobInput, leagueStart, customRouteText,
    compileLoading, compileError, accountName, characterName, hasStoredSession,
    syncMessage, simulatedOutage, clientLogPath, clientLogFound, relayConnected,
    relayError, viewers, setAccountName, setCharacterName, applyBuild,
    forceSync: handleForceSync,
    simulateLogLines: processLogLines,
    reconnectRelay: () => void connectRelay(),
    setRelayUrl: (u: string) => {
      setRelayUrl(u);
      void connectRelay(undefined, undefined, u);
    },
    rotatePin: () => {
      const nextPin = randomCode(4, "0123456789");
      setPin(nextPin);
      void connectRelay(undefined, nextPin);
    },
    savePoesessid: async (val: string) => {
      await savePoesessid(val);
      setHasStoredSession(true);
    },
    clearPoesessid: async () => {
      await clearPoesessid();
      setHasStoredSession(false);
    },
    setLogPath: async (p: string) => {
      setClientLogPathState(p);
      const ok = await setClientLogPath(p);
      setClientLogFound(ok);
      if (snapshot) pushPatch({ ...snapshot, clientLogHooked: ok }, "log_path");
    },
    autoDetectPath: async () => {
      const res = await detectClientLogPath();
      if (res.detectedPath) {
        setClientLogPathState(res.detectedPath);
        setClientLogFound(await setClientLogPath(res.detectedPath));
      }
    },
    toggleAutoClipboard: () => {
      if (snapshot) pushPatch({ ...snapshot, autoClipboardEnabled: !snapshot.autoClipboardEnabled }, "toggle_clip");
    },
    copyRegexNow: async () => {
      if (snapshot?.activeVendorRegex) await writeVendorRegexClipboard(snapshot.activeVendorRegex);
    },
    toggleSimPoeRunning: () => {
      const cur = snapshotRef.current;
      if (cur) pushPatch(reduceTelemetrySession(cur, { type: "process_state", running: !cur.poeRunning }, poe1GameAdapter), "sim_poe");
    },
    toggleSimulatedOutage: () => {
      const next = !simulatedOutage;
      setSimulatedOutage(next);
      const cur = snapshotRef.current;
      if (cur && next) pushPatch({ ...cur, version: cur.version + 1, characterSyncStatus: "OFFLINE_FALLBACK" }, "sim_outage_on");
    },
  };
}
