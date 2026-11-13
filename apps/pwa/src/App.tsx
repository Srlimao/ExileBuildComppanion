import type {
  DeviceFormFactor,
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  WidgetGridItemLayout,
  WidgetId,
} from "@exile-hud/core";
import { parsePoelabDailyJson, reduceTelemetrySession } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeathRespawnResumeBanner } from "./features/hud_shell/death_respawn_resume_banner.js";
import { HudTopTelemetryBar } from "./features/hud_shell/hud_top_telemetry_bar.js";
import { StandbySessionSummaryView } from "./features/hud_shell/standby_session_summary_view.js";
import { createInteractiveDemoSnapshot } from "./features/pairing_and_connection/demo_campaign_snapshot_factory.js";
import {
  detectDeviceFormFactor,
  EdgeWebSocketRoomClient,
  type ConnectionPhase,
} from "./features/pairing_and_connection/edge_websocket_room_client.js";
import { QrPinJoinModal } from "./features/pairing_and_connection/qr_pin_join_modal.js";
import { useScreenWakeLock } from "./features/pairing_and_connection/screen_wake_lock_controller.js";
import { CustomizableModeWidgetGrid } from "./features/widget_grid_engine/customizable_mode_widget_grid.js";
import { getDefaultLayoutForMode } from "./features/widget_grid_engine/default_mode_grid_presets.js";
import { ActiveChecklistWidget } from "./features/widgets/active_checklist_widget.js";
import { DeferredBacklogWidget } from "./features/widgets/deferred_backlog_widget.js";
import { GearHygieneWidget } from "./features/widgets/gear_hygiene_widget.js";
import { LabCompassWidget } from "./features/widgets/lab_compass_widget.js";
import { PassiveTreeWidget } from "./features/widgets/passive_tree_widget.js";
import { PassiveTreeCommandView } from "./features/passive_tree_visualizer/passive_tree_command_view.js";
import { RegexSyncWidget } from "./features/widgets/regex_sync_widget.js";
import { ResistanceCapWidget } from "./features/widgets/resistance_cap_widget.js";
import { RunTimerWidget } from "./features/widgets/run_timer_widget.js";
import { SocketLinksWidget } from "./features/widgets/socket_links_widget.js";
import { VendorShoppingWidget } from "./features/widgets/vendor_shopping_widget.js";
import { ZoneLayoutWidget } from "./features/widgets/zone_layout_widget.js";

const LOCAL_LAYOUT_KEY = "exile_hud_widget_layouts_v1";

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
  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(() =>
    params.get("demo") === "1" ? createInteractiveDemoSnapshot() : null,
  );
  const [layouts, setLayouts] = useState<ModeWidgetGrids>(loadCachedLayouts);
  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(detectDeviceFormFactor);
  const [editMode, setEditMode] = useState(false);
  const [previewModeOverride, setPreviewModeOverride] = useState<HudContextMode | null>(null);
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
      setSnapshot((prev) =>
        prev ? reduceTelemetrySession(prev, { type: "toggle_checkpoint", checkpointId }, poe1GameAdapter) : prev,
      );
      clientRef.current?.sendCommand({ type: "viewer:toggle_checkpoint", checkpointId });
    },
    [],
  );

  const handleToggleGem = useCallback((gemStepId: string) => {
    setSnapshot((prev) =>
      prev ? reduceTelemetrySession(prev, { type: "toggle_gem", gemStepId }, poe1GameAdapter) : prev,
    );
    clientRef.current?.sendCommand({ type: "viewer:toggle_gem", gemStepId });
  }, []);

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
          setSnapshot(createInteractiveDemoSnapshot());
        }}
      />
    );
  }

  const autoMode: HudContextMode = snapshot.inGameTreeOpen ? "TREE" : snapshot.mode;
  const effectiveMode: HudContextMode = previewModeOverride ?? autoMode;
  const activeGridItems =
    layouts[formFactor]?.[effectiveMode] ?? getDefaultLayoutForMode(formFactor, effectiveMode);

  const renderWidget = (widgetId: WidgetId) => {
    switch (widgetId) {
      case "zone_layout":
        return <ZoneLayoutWidget snapshot={snapshot} />;
      case "active_checklist":
        return <ActiveChecklistWidget snapshot={snapshot} onToggleCheckpoint={handleToggleCheckpoint} />;
      case "vendor_shopping":
        return <VendorShoppingWidget snapshot={snapshot} onToggleGem={handleToggleGem} />;
      case "socket_links":
        return <SocketLinksWidget snapshot={snapshot} />;
      case "passive_tree":
        return <PassiveTreeWidget snapshot={snapshot} onOpenFullTree={() => setPreviewModeOverride("TREE")} />;
      case "regex_sync":
        return (
          <RegexSyncWidget
            snapshot={snapshot}
            onPushToPcClipboard={(regex) => clientRef.current?.sendCommand({ type: "viewer:request_regex_copy", regex })}
          />
        );
      case "deferred_backlog":
        return <DeferredBacklogWidget snapshot={snapshot} onToggleCheckpoint={handleToggleCheckpoint} />;
      case "resistance_cap":
        return <ResistanceCapWidget snapshot={snapshot} />;
      case "gear_hygiene":
        return <GearHygieneWidget snapshot={snapshot} />;
      case "run_timer":
        return <RunTimerWidget snapshot={snapshot} />;
      case "lab_compass":
        return <LabCompassWidget snapshot={snapshot} onImportPoelabJson={handleImportPoelab} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 pb-10">
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
          renderWidget={renderWidget}
          onUpdateLayout={(next) => handleUpdateLayout(effectiveMode, next)}
          onResetDefaults={() => handleUpdateLayout(effectiveMode, getDefaultLayoutForMode(formFactor, effectiveMode))}
        />
      )}
    </div>
  );
}
