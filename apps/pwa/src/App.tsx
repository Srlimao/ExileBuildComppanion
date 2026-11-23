import type { DeviceFormFactor, HudContextMode, WidgetGridItemLayout } from "@exile-hud/core";
import {
  createEmptyCampaignProgress,
  extractCampaignProgress,
  parsePoelabDailyJson,
  reduceTelemetrySession,
  resetSnapshotProgress,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  CustomizableModeWidgetGrid,
  DeathRespawnResumeBanner,
  getDefaultLayoutForMode,
  HudErrorBoundary,
  localizeConnectionOrSyncMessage,
  PassiveTreeCommandView,
  renderHudWidget,
  StandbySessionSummaryView,
  useHudI18n,
} from "@exile-hud/hud-ui";
import { useCallback, useEffect, useState } from "react";
import { HudTopTelemetryBar } from "./features/hud_shell/hud_top_telemetry_bar.js";
import { GggOauthCallbackView } from "./features/oauth_callback/ggg_oauth_callback_view.js";
import { detectDeviceFormFactor } from "./features/pairing_and_connection/edge_websocket_room_client.js";
import { LOCAL_LAYOUT_KEY, saveDemoProgress } from "./features/pairing_and_connection/pwa_local_persistence.js";
import { QrPinJoinModal } from "./features/pairing_and_connection/qr_pin_join_modal.js";
import { useScreenWakeLock } from "./features/pairing_and_connection/screen_wake_lock_controller.js";
import { usePwaRoomSession } from "./features/pairing_and_connection/use_pwa_room_session.js";

export function App() {
  const { locale, msg, appMsg } = useHudI18n();
  const session = usePwaRoomSession();
  const {
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
  } = session;

  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(detectDeviceFormFactor);
  const [editMode, setEditMode] = useState(false);

  const wake = useScreenWakeLock(Boolean(snapshot));

  useEffect(() => {
    const onResize = () => setFormFactor(detectDeviceFormFactor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleToggleCheckpoint = useCallback(
    (checkpointId: string) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = reduceTelemetrySession(prev, { type: "toggle_checkpoint", checkpointId }, poe1GameAdapter);
        if (isDemo) saveDemoProgress(extractCampaignProgress(next, { wasExplicitlyReset: false }));
        return next;
      });
      sendCommand({ type: "viewer:toggle_checkpoint", checkpointId });
    },
    [isDemo, sendCommand, setSnapshot],
  );

  const handleToggleGem = useCallback(
    (gemStepId: string) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = reduceTelemetrySession(prev, { type: "toggle_gem", gemStepId }, poe1GameAdapter);
        if (isDemo) saveDemoProgress(extractCampaignProgress(next, { wasExplicitlyReset: false }));
        return next;
      });
      sendCommand({ type: "viewer:toggle_gem", gemStepId });
    },
    [isDemo, sendCommand, setSnapshot],
  );

  const handleResetProgress = useCallback(() => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const next = resetSnapshotProgress(prev);
      if (isDemo) saveDemoProgress(createEmptyCampaignProgress());
      return next;
    });
    sendCommand({ type: "viewer:reset_progress" });
  }, [isDemo, sendCommand, setSnapshot]);

  const handleUpdateLayout = useCallback(
    (mode: HudContextMode, items: WidgetGridItemLayout[]) => {
      setLayouts((prev) => {
        const next = { ...prev, [formFactor]: { ...prev[formFactor], [mode]: items } };
        try {
          localStorage.setItem(LOCAL_LAYOUT_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
      sendCommand({ type: "viewer:save_widget_layout", deviceFormFactor: formFactor, mode, items });
    },
    [formFactor, sendCommand, setLayouts],
  );

  const handleImportPoelab = useCallback(
    (rawJson: string) => {
      try {
        const lab = parsePoelabDailyJson(rawJson);
        setSnapshot((prev) => (prev ? { ...prev, lab } : prev));
        sendCommand({ type: "viewer:import_poelab_daily", rawJson });
      } catch {
        // Invalid JSON silently ignored
      }
    },
    [sendCommand, setSnapshot],
  );

  if (window.location.pathname.startsWith("/oauth/callback")) {
    return (
      <HudErrorBoundary variant="app" resetKey="oauth">
        <GggOauthCallbackView />
      </HudErrorBoundary>
    );
  }

  if (!snapshot) {
    return (
      <HudErrorBoundary variant="app" resetKey={`pairing:${roomId}`}>
        <QrPinJoinModal
          initialRoomId={roomId}
          initialPin={pin}
          connectionPhase={connectionPhase}
          errorMessage={localizeConnectionOrSyncMessage(errorMsg, locale)}
          onJoinRoom={joinRoom}
          onStartDemo={startDemo}
        />
      </HudErrorBoundary>
    );
  }

  const autoMode: HudContextMode = snapshot.inGameTreeOpen ? "TREE" : snapshot.mode;
  const effectiveMode: HudContextMode = previewModeOverride ?? autoMode;
  const activeGridItems =
    layouts[formFactor]?.[effectiveMode] ??
    getDefaultLayoutForMode(formFactor, effectiveMode, { leagueStart: snapshot.leagueStart });

  return (
    <HudErrorBoundary variant="app" resetKey={`${roomId}:${effectiveMode}`}>
      <div className="min-h-screen bg-hud-bg text-hud-text pb-[max(2.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] transition-colors">
        <a
          href="#hud-main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-hud-accent focus:text-hud-accent-fg focus:px-3 focus:py-2 focus:text-xs focus:font-semibold"
        >
          {msg.a11y.skipToContent}
        </a>

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
          onTriggerManualSync={() => sendCommand({ type: "viewer:request_character_sync" })}
          onResetProgress={handleResetProgress}
          onOpenPairingModal={openPairingModal}
          onReconnectNow={reconnectNow}
        />

        {snapshot.resumeZoneBanner && (
          <DeathRespawnResumeBanner
            areaName={snapshot.resumeZoneBanner.areaName}
            onDismiss={() => setSnapshot((prev) => (prev ? { ...prev, resumeZoneBanner: null } : prev))}
          />
        )}

        <main id="hud-main-content" tabIndex={-1} className="safe-x focus:outline-none">
          {effectiveMode === "STANDBY" ? (
            <StandbySessionSummaryView
              snapshot={snapshot}
              onOverridePreview={() => setPreviewModeOverride("FIELD")}
            />
          ) : effectiveMode === "TREE" ? (
            <PassiveTreeCommandView
              snapshot={snapshot}
              onTriggerManualSync={() => sendCommand({ type: "viewer:request_character_sync" })}
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
                  onPushToPcClipboard: (regex) => sendCommand({ type: "viewer:request_regex_copy", regex }),
                  onImportPoelabJson: handleImportPoelab,
                })
              }
              onUpdateLayout={(next) => handleUpdateLayout(effectiveMode, next)}
              onResetDefaults={() =>
                handleUpdateLayout(effectiveMode, getDefaultLayoutForMode(formFactor, effectiveMode, { leagueStart: snapshot.leagueStart }))
              }
            />
          )}
        </main>

        <footer className="max-w-7xl mx-auto px-4 safe-x pt-6 pb-2 text-center text-[11px] text-hud-dim">
          {appMsg.legalDisclaimer}
        </footer>
      </div>
    </HudErrorBoundary>
  );
}
