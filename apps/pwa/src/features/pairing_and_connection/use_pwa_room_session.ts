import type {
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  ViewerToRoomMessage,
} from "@exile-hud/core";
import { applySavedCampaignProgress } from "@exile-hud/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInteractiveDemoSnapshot } from "./demo_campaign_snapshot_factory.js";
import { EdgeWebSocketRoomClient, type ConnectionPhase } from "./edge_websocket_room_client.js";
import {
  clearCachedRoomSnapshot,
  loadCachedLayouts,
  loadCachedRoomSnapshot,
  loadDemoProgress,
  LOCAL_LAYOUT_KEY,
  saveCachedRoomSnapshot,
} from "./pwa_local_persistence.js";
import {
  clearRecentRoomPin,
  loadRecentRoomSession,
  normalizeRoomCode,
  normalizeRoomPin,
  saveRecentRoomSession,
  setRecentRoomAutoConnect,
} from "./recent_room_storage.js";

function parsePreviewMode(raw: string | null): HudContextMode | null {
  const m = raw?.toUpperCase();
  return m === "FIELD" || m === "TOWN" || m === "LAB" || m === "TREE" || m === "STANDBY" ? m : null;
}

export function usePwaRoomSession() {
  const bootstrap = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get("demo") === "1";
    const initialPreviewMode = parsePreviewMode(params.get("mode"));
    const urlRoom = normalizeRoomCode(params.get("room") ?? "");
    const urlPin = normalizeRoomPin(params.get("pin") ?? "");
    const saved = !isDemo && !urlRoom ? loadRecentRoomSession() : null;
    const autoConnect = Boolean(saved && saved.autoConnect);
    const initialSnapshot = isDemo
      ? applySavedCampaignProgress(createInteractiveDemoSnapshot(), loadDemoProgress())
      : autoConnect
        ? loadCachedRoomSnapshot(saved!.roomId)
        : null;
    return {
      isDemo,
      initialPreviewMode,
      roomId: urlRoom || saved?.roomId || "",
      pin: urlRoom ? urlPin : autoConnect ? saved!.pin : "",
      autoConnect,
      initialSnapshot,
    };
  }, []);

  const [roomId, setRoomId] = useState(bootstrap.roomId);
  const [pin, setPin] = useState(bootstrap.pin);
  const [isDemo, setIsDemo] = useState(bootstrap.isDemo);
  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(bootstrap.initialSnapshot);
  const [layouts, setLayouts] = useState<ModeWidgetGrids>(loadCachedLayouts);
  const [previewModeOverride, setPreviewModeOverride] = useState<HudContextMode | null>(
    bootstrap.initialPreviewMode,
  );
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
  const [connectEpoch, setConnectEpoch] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientRef = useRef<EdgeWebSocketRoomClient | null>(null);

  useEffect(() => {
    if (snapshot && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [snapshot]);

  useEffect(() => {
    if (isDemo || !roomId || !pin) return;
    const client = new EdgeWebSocketRoomClient(roomId, pin, {
      onStatusChange: (phase, detail, closeCode) => {
        setConnectionPhase(phase);
        if (phase === "connected") {
          setErrorMsg(null);
        } else if (phase === "error") {
          setErrorMsg(detail ?? "Connection rejected");
          if (closeCode === 4003) {
            clearRecentRoomPin();
            clearCachedRoomSnapshot();
            setPin("");
            setSnapshot(null);
          } else if (closeCode === 4001) {
            setRecentRoomAutoConnect(false);
            clearCachedRoomSnapshot();
            setSnapshot(null);
          }
        }
      },
      onHydrated: (snap, serverLayouts) => {
        saveRecentRoomSession(roomId, pin, true);
        saveCachedRoomSnapshot(roomId, snap);
        setSnapshot(snap);
        setLayouts((prev) => ({ ...prev, ...serverLayouts }));
      },
      onSnapshotPatch: (snap) => {
        saveCachedRoomSnapshot(roomId, snap);
        setSnapshot(snap);
      },
      onLayoutUpdated: (ff, mode, items) => {
        setLayouts((prev) => {
          const next = { ...prev, [ff]: { ...prev[ff], [mode]: items } };
          try {
            localStorage.setItem(LOCAL_LAYOUT_KEY, JSON.stringify(next));
          } catch {
            // Ignore storage quota errors
          }
          return next;
        });
      },
    });
    clientRef.current = client;
    client.connect();
    return () => {
      clientRef.current = null;
      client.disconnect();
    };
  }, [isDemo, roomId, pin, connectEpoch]);

  const joinRoom = useCallback((nextRoomId: string, nextPin: string) => {
    const cleanRoom = normalizeRoomCode(nextRoomId);
    const cleanPin = normalizeRoomPin(nextPin);
    if (!cleanRoom || !cleanPin) return;
    setErrorMsg(null);
    setIsDemo(false);
    saveRecentRoomSession(cleanRoom, cleanPin, true);
    setRoomId(cleanRoom);
    setPin(cleanPin);
    setConnectEpoch((n) => n + 1);
  }, []);

  const startDemo = useCallback((initialMode?: HudContextMode) => {
    clientRef.current?.disconnect();
    setIsDemo(true);
    if (initialMode) setPreviewModeOverride(initialMode);
    setSnapshot(applySavedCampaignProgress(createInteractiveDemoSnapshot(), loadDemoProgress()));
  }, []);

  const openPairingModal = useCallback(() => {
    clientRef.current?.disconnect();
    setRecentRoomAutoConnect(false);
    setIsDemo(false);
    setSnapshot(null);
  }, []);

  const reconnectNow = useCallback(() => {
    clientRef.current?.reconnectNow();
  }, []);

  const sendCommand = useCallback((cmd: ViewerToRoomMessage) => {
    clientRef.current?.sendCommand(cmd);
  }, []);

  return {
    roomId,
    pin,
    isDemo,
    snapshot,
    setSnapshot,
    layouts,
    setLayouts,
    previewModeOverride,
    setPreviewModeOverride,
    connectionPhase,
    errorMsg,
    joinRoom,
    startDemo,
    openPairingModal,
    reconnectNow,
    sendCommand,
  };
}
