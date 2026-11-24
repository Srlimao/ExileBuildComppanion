import {
  parsePoelabDailyJson,
  reduceTelemetrySession,
  resolveSnapshotGameId,
  type HudContextMode,
  type HudSessionSnapshot,
  type ViewerToRoomMessage,
  type WidgetGridItemLayout,
} from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import {
  CustomizableModeWidgetGrid,
  DeathRespawnResumeBanner,
  PassiveTreeCommandView,
  renderHudWidget,
  StandbySessionSummaryView,
  useHudI18n,
} from "@exile-hud/hud-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultOverlayLayoutForMode } from "./overlay_default_grid_presets.js";
import { OverlayFramelessResizeHandles } from "./overlay_frameless_resize_handles.js";
import { createOverlayViewerBusClient, type OverlayViewerBusClient } from "./overlay_local_bus.js";
import { OverlayTopDockBar } from "./overlay_top_dock_bar.js";
import {
  DEFAULT_OVERLAY_CONFIG,
  getOverlayConfigIpc,
  subscribeOverlayConfigUpdates,
  updateOverlayConfigIpc,
  type OverlayContextMode,
  type SavedOverlayConfig,
} from "./overlay_types_and_ipc.js";

/** Standalone transparent overlay window rendered from index.html?window=overlay (zero Cloudflare). */
export function OverlayHudApp() {
  const { appMsg } = useHudI18n();
  const [config, setConfig] = useState<SavedOverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [snapshot, setSnapshot] = useState<HudSessionSnapshot | null>(null);
  const [previewModeOverride, setPreviewModeOverride] = useState<HudContextMode | null>(null);
  const [fullTreeExpanded, setFullTreeExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const busRef = useRef<OverlayViewerBusClient | null>(null);

  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
    };
  }, []);

  useEffect(() => {
    void getOverlayConfigIpc().then(setConfig).catch(() => undefined);
    let unsub: () => void = () => undefined;
    void subscribeOverlayConfigUpdates(setConfig).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (config.clickThroughLocked && editMode) {
      setEditMode(false);
    }
  }, [config.clickThroughLocked, editMode]);

  useEffect(() => {
    const client = createOverlayViewerBusClient((nextSnap) => setSnapshot(nextSnap));
    busRef.current = client;
    return () => {
      client.close();
      busRef.current = null;
    };
  }, []);

  const persistConfig = useCallback((next: SavedOverlayConfig) => {
    setConfig(next);
    void updateOverlayConfigIpc(next);
  }, []);

  const sendCommand = useCallback((command: ViewerToRoomMessage) => {
    busRef.current?.sendCommand(command);
  }, []);

  const handleToggleCheckpoint = useCallback(
    (checkpointId: string) => {
      setSnapshot((prev) =>
        prev
          ? reduceTelemetrySession(
              prev,
              { type: "toggle_checkpoint", checkpointId },
              getGameAdapter(prev.gameId),
            )
          : prev,
      );
      sendCommand({ type: "viewer:toggle_checkpoint", checkpointId });
    },
    [sendCommand],
  );

  const handleToggleGem = useCallback(
    (gemStepId: string) => {
      setSnapshot((prev) =>
        prev
          ? reduceTelemetrySession(
              prev,
              { type: "toggle_gem", gemStepId },
              getGameAdapter(prev.gameId),
            )
          : prev,
      );
      sendCommand({ type: "viewer:toggle_gem", gemStepId });
    },
    [sendCommand],
  );

  const handleImportPoelab = useCallback(
    (rawJson: string) => {
      try {
        const lab = parsePoelabDailyJson(rawJson);
        setSnapshot((prev) => (prev ? { ...prev, lab } : prev));
        sendCommand({ type: "viewer:import_poelab_daily", rawJson });
      } catch {
        // Ignore invalid PoELab JSON
      }
    },
    [sendCommand],
  );

  const activeGameId = resolveSnapshotGameId(snapshot);
  const autoMode: HudContextMode = snapshot?.inGameTreeOpen ? "TREE" : (snapshot?.mode ?? "FIELD");
  const effectiveDisplayMode: HudContextMode = previewModeOverride ?? autoMode;
  const layoutModeKey: OverlayContextMode =
    effectiveDisplayMode === "TREE" || effectiveDisplayMode === "STANDBY" ? "TREE_COMPACT" : effectiveDisplayMode;

  const activeItems =
    config.modeLayouts[layoutModeKey] ??
    getDefaultOverlayLayoutForMode(layoutModeKey, { leagueStart: snapshot?.leagueStart, gameId: activeGameId });

  const saveOverlayModeLayout = useCallback(
    (modeKey: OverlayContextMode, items: WidgetGridItemLayout[]) => {
      persistConfig({
        ...config,
        modeLayouts: { ...config.modeLayouts, [modeKey]: items },
      });
    },
    [config, persistConfig],
  );

  const bgAlpha = Math.min(1, Math.max(0.35, config.opacityPercent / 100));

  return (
    <div
      style={{ backgroundColor: `rgba(var(--hud-bg-rgb, 0, 0, 0), ${bgAlpha})` }}
      className={`h-screen w-screen flex flex-col overflow-hidden rounded-xl border ${
        config.clickThroughLocked ? "border-hud-hairline" : "border-hud-accent/55 shadow-2xl"
      } text-hud-text transition-colors`}
    >
      <OverlayFramelessResizeHandles unlocked={!config.clickThroughLocked} />

      <OverlayTopDockBar
        snapshot={snapshot}
        config={config}
        activeDisplayMode={effectiveDisplayMode}
        previewModeOverride={previewModeOverride}
        fullTreeExpanded={fullTreeExpanded}
        editMode={editMode}
        onSelectPreviewMode={(m) => {
          setPreviewModeOverride(m);
          if (m !== "TREE") setFullTreeExpanded(false);
        }}
        onToggleFullTree={() => setFullTreeExpanded((v) => !v)}
        onToggleEditMode={() => setEditMode((v) => !v)}
        onUpdateConfig={persistConfig}
        onHideOverlay={() => persistConfig({ ...config, enabled: false })}
      />

      <div className={`flex-1 min-h-0 overflow-y-auto ${config.clickThroughLocked ? "pointer-events-none" : ""}`}>
        {!snapshot ? (
          <div className="p-4 text-xs text-hud-muted">
            {appMsg.desktop.waitingOverlaySnapshot}
          </div>
        ) : (
          <>
            {snapshot.resumeZoneBanner && (
              <DeathRespawnResumeBanner
                areaName={snapshot.resumeZoneBanner.areaName}
                onDismiss={() => setSnapshot((prev) => (prev ? { ...prev, resumeZoneBanner: null } : prev))}
              />
            )}

            {effectiveDisplayMode === "STANDBY" ? (
              <StandbySessionSummaryView
                snapshot={snapshot}
                onOverridePreview={() => setPreviewModeOverride("FIELD")}
              />
            ) : effectiveDisplayMode === "TREE" && fullTreeExpanded ? (
              <PassiveTreeCommandView
                snapshot={snapshot}
                onTriggerManualSync={() => sendCommand({ type: "viewer:request_character_sync" })}
              />
            ) : (
              <CustomizableModeWidgetGrid
                gameId={activeGameId}
                mode={layoutModeKey}
                formFactor="pc-overlay"
                items={activeItems}
                editMode={editMode && !config.clickThroughLocked}
                compactOverlay
                renderWidget={(widgetId) =>
                  renderHudWidget(widgetId, {
                    snapshot,
                    onToggleCheckpoint: handleToggleCheckpoint,
                    onToggleGem: handleToggleGem,
                    onOpenFullTree: () => setFullTreeExpanded(true),
                    onPushToPcClipboard: (regex) => sendCommand({ type: "viewer:request_regex_copy", regex }),
                    onImportPoelabJson: handleImportPoelab,
                  })
                }
                onUpdateLayout={(next) => saveOverlayModeLayout(layoutModeKey, next)}
                onResetDefaults={() =>
                  saveOverlayModeLayout(
                    layoutModeKey,
                    getDefaultOverlayLayoutForMode(layoutModeKey, {
                      leagueStart: snapshot?.leagueStart,
                      gameId: activeGameId,
                    }),
                  )
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
