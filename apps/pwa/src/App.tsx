import type {
  DeviceFormFactor,
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  WidgetGridItemLayout,
} from "@exile-hud/core";
import {
  applySavedCampaignProgress,
  createEmptyCampaignProgress,
  extractCampaignProgress,
  parsePoelabDailyJson,
  reduceTelemetrySession,
  resetSnapshotProgress,
  type SavedCampaignProgress,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  CustomizableModeWidgetGrid,
  DeathRespawnResumeBanner,
  getDefaultLayoutForMode,
  PassiveTreeCommandView,
  renderHudWidget,
  StandbySessionSummaryView,
} from "@exile-hud/hud-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HudTopTelemetryBar } from "./features/hud_shell/hud_top_telemetry_bar.js";
import { GggOauthCallbackView } from "./features/oauth_callback/ggg_oauth_callback_view.js";
import { createInteractiveDemoSnapshot } from "./features/pairing_and_connection/demo_campaign_snapshot_factory.js";
import {
  detectDeviceFormFactor,
  EdgeWebSocketRoomClient,
  type ConnectionPhase,
} from "./features/pairing_and_connection/edge_websocket_room_client.js";
import { QrPinJoinModal } from "./features/pairing_and_connection/qr_pin_join_modal.js";
import { useScreenWakeLock } from "./features/pairing_and_connection/screen_wake_lock_controller.js";

const LOCAL_LAYOUT_KEY = "exile_hud_widget_layouts_v1";
const DEMO_PROGRESS_KEY = "exile_hud_demo_progress_v1";

function loadDemoProgress(): SavedCampaignProgress | null {
  try {
    const raw = localStorage.getItem(DEMO_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as SavedCampaignProgress) : null;
  } catch {
    return null;
  }
}

function saveDemoProgress(record: SavedCampaignProgress): void {
  try {
    localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage error
  }
}

function loadCachedLayouts(): ModeWidgetGrids {
  try {
    const raw = localStorage.getItem(LOCAL_LAYOUT_KEY);
    if (raw) return JSON.parse(raw) as ModeWidgetGrids;
  } catch {
    // Ignore storage error
  }
  return { "tablet-landscape": {}, "tablet-portrait": {}, phone: {} };
}

export function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [roomId, setRoomId] = useState(() => params.get("room")?.toUpperCase() ?? "");
  const [pin, setPin] = useState(() => params.get("pin") ?? "");
  const [isDemo, setIsDemo] = useState(() => params.get("demo") === "1");
  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(() => {
    if (params.get("demo") !== "1") return null;
    return applySavedCampaignProgress(createInteractiveDemoSnapshot(), loadDemoProgress());
  });
  const [layouts, setLayouts] = useState<ModeWidgetGrids>(loadCachedLayouts);
  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(detectDeviceFormFactor);
  const [editMode, setEditMode] = useState(false);
  const [previewModeOverride, setPreviewModeOverride] = useState<HudContextMode | null>(() => {
    const m = params.get("mode")?.toUpperCase();
    return m === "FIELD" || m === "TOWN" || m === "LAB" || m === "TREE" || m === "STANDBY" ? m : null;
  });
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientRef = useRef<EdgeWebSocketRoomClient | null>(null);

  const wake = useScreenWakeLock(Boolean(snapshot));

  useEffect(() => {
    const onResize = () => setFormFactor(detectDeviceFormFactor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isDemo || !roomId || !pin) return;
    const client = new EdgeWebSocketRoomClient(roomId, pin, {
      onStatusChange: (phase, detail) => {
        setConnectionPhase(phase);
        if (phase === "error") setErrorMsg(detail ?? "Connection rejected");
        else if (phase === "connected") setErrorMsg(null);
      },
      onHydrated: (snap, serverLayouts) => {
        setSnapshot(snap);
        setLayouts((prev) => ({ ...prev, ...serverLayouts }));
      },
      onSnapshotPatch: (snap) => setSnapshot(snap),
      onLayoutUpdated: (ff, mode, items) => {
        setLayouts((prev) => {
          const next = { ...prev, [ff]: { ...prev[ff], [mode]: items } };
          localStorage.setItem(LOCAL_LAYOUT_KEY, JSON.stringify(next));
          return next;
        });
      },
    });
    clientRef.current = client;
    client.connect();
    return () => client.disconnect();
  }, [isDemo, roomId, pin]);

  const handleToggleCheckpoint = useCallback(
    (checkpointId: string) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = reduceTelemetrySession(prev, { type: "toggle_checkpoint", checkpointId }, poe1GameAdapter);
        if (isDemo) saveDemoProgress(extractCampaignProgress(next, { wasExplicitlyReset: false }));
        return next;
      });
      clientRef.current?.sendCommand({ type: "viewer:toggle_checkpoint", checkpointId });
    },
    [isDemo],
  );

  const handleToggleGem = useCallback(
    (gemStepId: string) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = reduceTelemetrySession(prev, { type: "toggle_gem", gemStepId }, poe1GameAdapter);
        if (isDemo) saveDemoProgress(extractCampaignProgress(next, { wasExplicitlyReset: false }));
        return next;
      });
      clientRef.current?.sendCommand({ type: "viewer:toggle_gem", gemStepId });
    },
    [isDemo],
  );

  const handleResetProgress = useCallback(() => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const next = resetSnapshotProgress(prev);
      if (isDemo) saveDemoProgress(createEmptyCampaignProgress());
      return next;
    });
    clientRef.current?.sendCommand({ type: "viewer:reset_progress" });
  }, [isDemo]);

  const handleUpdateLayout = useCallback(
    (mode: HudContextMode, items: WidgetGridItemLayout[]) => {
      setLayouts((prev) => {
        const next = { ...prev, [formFactor]: { ...prev[formFactor], [mode]: items } };
        localStorage.setItem(LOCAL_LAYOUT_KEY, JSON.stringify(next));
        return next;
      });
      clientRef.current?.sendCommand({
        type: "viewer:save_widget_layout",
        deviceFormFactor: formFactor,
        mode,
        items,
      });
    },
    [formFactor],
  );

  const handleImportPoelab = useCallback((rawJson: string) => {
    try {
      const lab = parsePoelabDailyJson(rawJson);
      setSnapshot((prev) => (prev ? { ...prev, lab } : prev));
      clientRef.current?.sendCommand({ type: "viewer:import_poelab_daily", rawJson });
    } catch {
      // Invalid JSON silently ignored
    }
  }, []);

  if (window.location.pathname.startsWith("/oauth/callback")) {
    return <GggOauthCallbackView />;
  }

  if (!snapshot) {
    return (
      <QrPinJoinModal
        initialRoomId={roomId}
        initialPin={pin}
        errorMessage={errorMsg}
        onJoinRoom={(r, p) => {
          setIsDemo(false);
          setRoomId(r);
          setPin(p);
        }}
        onStartDemo={() => {
          setIsDemo(true);
          setSnapshot(applySavedCampaignProgress(createInteractiveDemoSnapshot(), loadDemoProgress()));
        }}
      />
    );
  }

  const autoMode: HudContextMode = snapshot.inGameTreeOpen ? "TREE" : snapshot.mode;
  const effectiveMode: HudContextMode = previewModeOverride ?? autoMode;
  const activeGridItems =
    layouts[formFactor]?.[effectiveMode] ?? getDefaultLayoutForMode(formFactor, effectiveMode);

  return (
    <div className="min-h-screen bg-hud-bg text-hud-text pb-10 transition-colors">
      <HudTopTelemetryBar
        snapshot={snapshot}
        activeDisplayMode={effectiveMode}
        previewModeOverride={previewModeOverride}
        editLayoutMode={editMode}
        formFactor={formFactor}
        connectionPhase={connectionPhase}
        wakeLocked={wake.locked}
        isDemo={isDemo}
        onToggleEditLayout={() => setEditMode((v) => !v)}
        onSelectPreviewMode={(m) => setPreviewModeOverride(m)}
        onTriggerManualSync={() => clientRef.current?.sendCommand({ type: "viewer:request_character_sync" })}
        onResetProgress={handleResetProgress}
        onOpenPairingModal={() => {
          setIsDemo(false);
          setSnapshot(null);
        }}
      />

      {snapshot.resumeZoneBanner && (
        <DeathRespawnResumeBanner
          areaName={snapshot.resumeZoneBanner.areaName}
          onDismiss={() => setSnapshot((prev) => (prev ? { ...prev, resumeZoneBanner: null } : prev))}
        />
      )}

      {effectiveMode === "STANDBY" ? (
        <StandbySessionSummaryView
          snapshot={snapshot}
          onOverridePreview={() => setPreviewModeOverride("FIELD")}
        />
      ) : effectiveMode === "TREE" ? (
        <PassiveTreeCommandView
          snapshot={snapshot}
          onTriggerManualSync={() => clientRef.current?.sendCommand({ type: "viewer:request_character_sync" })}
        />
      ) : (
        <CustomizableModeWidgetGrid
          mode={effectiveMode}
          formFactor={formFactor}
          items={activeGridItems}
          editMode={editMode}
          renderWidget={(widgetId) =>
            renderHudWidget(widgetId, {
              snapshot,
              onToggleCheckpoint: handleToggleCheckpoint,
              onToggleGem: handleToggleGem,
              onOpenFullTree: () => setPreviewModeOverride("TREE"),
              onPushToPcClipboard: (regex) =>
                clientRef.current?.sendCommand({ type: "viewer:request_regex_copy", regex }),
              onImportPoelabJson: handleImportPoelab,
            })
          }
          onUpdateLayout={(next) => handleUpdateLayout(effectiveMode, next)}
          onResetDefaults={() => handleUpdateLayout(effectiveMode, getDefaultLayoutForMode(formFactor, effectiveMode))}
        />
      )}

      <footer className="max-w-7xl mx-auto px-4 pt-6 pb-2 text-center text-[11px] text-hud-dim">
        Exile Relay — This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </footer>
    </div>
  );
}
