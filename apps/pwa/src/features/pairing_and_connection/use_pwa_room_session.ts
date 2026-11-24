import type {
  DeviceFormFactor,
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  SupportedGameId,
  ViewerToRoomMessage,
  WidgetGridItemLayout,
} from "@exile-hud/core";
import { applySavedCampaignProgress, resolveSnapshotGameId } from "@exile-hud/core";
import {
  isPoe2PassiveTreeHydrated,
  loadPassiveTreeDataset,
  normalizeSupportedGameId,
} from "@exile-hud/game-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInteractiveDemoSnapshot } from "./demo_campaign_snapshot_factory.js";
import { createPoe2DemoSnapshotSync, recomputePoe2DemoPassiveTree } from "./demo_poe2_snapshot_factory.js";
import { EdgeWebSocketRoomClient, type ConnectionPhase } from "./edge_websocket_room_client.js";
import {
  clearCachedRoomSnapshot,
  loadCachedLayoutsByGame,
  loadCachedRoomSnapshot,
  loadDemoProgress,
  saveCachedLayoutsForGame,
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

function mergeModeGrids(base: ModeWidgetGrids, incoming?: ModeWidgetGrids): ModeWidgetGrids {
  if (!incoming) return base;
  return {
    "tablet-landscape": { ...base["tablet-landscape"], ...incoming["tablet-landscape"] },
    "tablet-portrait": { ...base["tablet-portrait"], ...incoming["tablet-portrait"] },
    phone: { ...base.phone, ...incoming.phone },
  };
}

function parsePreviewMode(raw: string | null): HudContextMode | null {
  const m = raw?.toUpperCase();
  return m === "FIELD" || m === "TOWN" || m === "LAB" || m === "TREE" || m === "STANDBY" ? m : null;
}

export function usePwaRoomSession() {
  const bootstrap = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get("demo") === "1";
    const demoGame = normalizeSupportedGameId(params.get("game"));
    const initialPreviewMode = parsePreviewMode(params.get("mode"));
    const urlRoom = normalizeRoomCode(params.get("room") ?? "");
    const urlPin = normalizeRoomPin(params.get("pin") ?? "");
    const saved = !isDemo && !urlRoom ? loadRecentRoomSession() : null;
    const autoConnect = Boolean(saved && saved.autoConnect);
    const demoBase = demoGame === "poe2" ? createPoe2DemoSnapshotSync() : createInteractiveDemoSnapshot();
    const initialSnapshot = isDemo
      ? applySavedCampaignProgress(demoBase, loadDemoProgress(demoGame))
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
  const [layoutsByGame, setLayoutsByGame] = useState<Record<SupportedGameId, ModeWidgetGrids>>(
    loadCachedLayoutsByGame,
  );
  const [previewModeOverride, setPreviewModeOverride] = useState<HudContextMode | null>(
    bootstrap.initialPreviewMode,
  );
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
  const [connectEpoch, setConnectEpoch] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientRef = useRef<EdgeWebSocketRoomClient | null>(null);
  const activeGameId = resolveSnapshotGameId(snapshot);
  const activeGameIdRef = useRef<SupportedGameId>(activeGameId);
  activeGameIdRef.current = activeGameId;
  const layouts = layoutsByGame[activeGameId];

  const updateGameLayout = useCallback(
    (gameId: SupportedGameId, ff: DeviceFormFactor, mode: HudContextMode, items: WidgetGridItemLayout[]) => {
      setLayoutsByGame((prev) => {
        const nextGame = { ...prev[gameId], [ff]: { ...prev[gameId][ff], [mode]: items } };
        saveCachedLayoutsForGame(gameId, nextGame);
        return { ...prev, [gameId]: nextGame };
      });
    },
    [],
  );

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
      onHydrated: (snap, serverLayouts, serverLayoutsByGame) => {
        saveRecentRoomSession(roomId, pin, true);
        saveCachedRoomSnapshot(roomId, snap);
        setSnapshot(snap);
        const snapGame = resolveSnapshotGameId(snap);
        setLayoutsByGame((prev) => {
          const nextPoe1 = mergeModeGrids(prev.poe1, serverLayoutsByGame?.poe1 ?? (snapGame === "poe1" ? serverLayouts : undefined));
          const nextPoe2 = mergeModeGrids(prev.poe2, serverLayoutsByGame?.poe2 ?? (snapGame === "poe2" ? serverLayouts : undefined));
          saveCachedLayoutsForGame("poe1", nextPoe1);
          saveCachedLayoutsForGame("poe2", nextPoe2);
          return { poe1: nextPoe1, poe2: nextPoe2 };
        });
      },
      onSnapshotPatch: (snap) => {
        saveCachedRoomSnapshot(roomId, snap);
        setSnapshot(snap);
      },
      onLayoutUpdated: (ff, mode, items, gameId) => {
        updateGameLayout(gameId ?? activeGameIdRef.current, ff, mode, items);
      },
    });
    clientRef.current = client;
    client.connect();
    return () => {
      clientRef.current = null;
      client.disconnect();
    };
  }, [isDemo, roomId, pin, connectEpoch, updateGameLayout]);

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

  useEffect(() => {
    if (!isDemo || activeGameId !== "poe2" || isPoe2PassiveTreeHydrated()) return;
    let cancelled = false;
    void loadPassiveTreeDataset("poe2").then(() => {
      if (cancelled) return;
      setSnapshot((prev) =>
        prev && resolveSnapshotGameId(prev) === "poe2" ? recomputePoe2DemoPassiveTree(prev) : prev,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isDemo, activeGameId]);

  const startDemo = useCallback((initialMode?: HudContextMode, gameId: SupportedGameId = "poe1") => {
    clientRef.current?.disconnect();
    setIsDemo(true);
    if (initialMode) setPreviewModeOverride(initialMode);
    const base = gameId === "poe2" ? createPoe2DemoSnapshotSync() : createInteractiveDemoSnapshot();
    setSnapshot(applySavedCampaignProgress(base, loadDemoProgress(gameId)));
  }, []);

  const switchDemoGame = useCallback((nextGameId: SupportedGameId) => {
    setIsDemo(true);
    const base = nextGameId === "poe2" ? createPoe2DemoSnapshotSync() : createInteractiveDemoSnapshot();
    setSnapshot(applySavedCampaignProgress(base, loadDemoProgress(nextGameId)));
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
    updateGameLayout,
    previewModeOverride,
    setPreviewModeOverride,
    connectionPhase,
    errorMsg,
    joinRoom,
    startDemo,
    switchDemoGame,
    openPairingModal,
    reconnectNow,
    sendCommand,
  };
}
