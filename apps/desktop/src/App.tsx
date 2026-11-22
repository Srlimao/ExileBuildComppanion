import { useHudI18n } from "@exile-hud/hud-ui";
import { useEffect, useState } from "react";
import { DesktopUpdateFooterBar } from "./features/auto_updater/desktop_update_footer_bar.js";
import { BuildLibraryManagerView } from "./features/build_library/build_library_manager_view.js";
import { DesktopControlHeader, type DesktopTabKey } from "./features/control_shell/desktop_control_header.js";
import { CampaignSimulatorDrawer } from "./features/environment_panel/campaign_simulator_drawer.js";
import { ClientLogSettingsCard } from "./features/environment_panel/client_log_settings_card.js";
import { useDesktopHostController } from "./features/host_coordinator/use_desktop_host_controller.js";
import { LeagueStarterFilterCard } from "./features/loot_filter/league_starter_filter_card.js";
import { OverlayControlCenterCard } from "./features/overlay_hud/overlay_control_center_card.js";
import {
  DEFAULT_OVERLAY_CONFIG,
  getOverlayConfigIpc,
  subscribeOverlayConfigUpdates,
  toggleOverlayClickThroughIpc,
  toggleOverlayVisibilityIpc,
  updateOverlayConfigIpc,
  type SavedOverlayConfig,
} from "./features/overlay_hud/overlay_types_and_ipc.js";
import { ConnectTabView } from "./features/pairing_panel/connect_tab_view.js";

/** Precision Tray Companion shell for the Windows desktop Control Center. */
export function App() {
  const { appMsg } = useHudI18n();
  const [tab, setTab] = useState<DesktopTabKey>("builds");
  const ctl = useDesktopHostController();
  const [overlayConfig, setOverlayConfig] = useState<SavedOverlayConfig>(DEFAULT_OVERLAY_CONFIG);

  useEffect(() => {
    void getOverlayConfigIpc().then(setOverlayConfig).catch(() => undefined);
    let unsub: () => void = () => undefined;
    void subscribeOverlayConfigUpdates(setOverlayConfig).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);

  const handleUpdateOverlayConfig = (next: SavedOverlayConfig) => {
    setOverlayConfig(next);
    void updateOverlayConfigIpc(next);
  };

  return (
    <div className="h-screen flex flex-col bg-hud-bg text-hud-text overflow-hidden transition-colors">
      <DesktopControlHeader
        tab={tab}
        onSelectTab={setTab}
        snapshot={ctl.snapshot}
        overlayEnabled={overlayConfig.enabled}
        overlayToggleHotkey={overlayConfig.toggleVisibilityHotkey}
        onToggleOverlay={() => void toggleOverlayVisibilityIpc()}
        roomId={ctl.roomId}
        pin={ctl.pin}
        relayUrl={ctl.relayUrl}
        relayConnected={ctl.relayConnected}
        viewerCount={ctl.viewers.length}
        onRotatePin={ctl.rotatePin}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5">
        {tab === "builds" && (
          <BuildLibraryManagerView
            listing={ctl.buildLibrary.listing}
            snapshot={ctl.snapshot}
            currentFolder={ctl.buildLibrary.currentFolder}
            editorMode={ctl.buildLibrary.editorMode}
            busy={ctl.buildLibrary.busy}
            error={ctl.buildLibrary.error}
            onChangeFolder={ctl.buildLibrary.setCurrentFolder}
            onOpenCreateEditor={ctl.buildLibrary.openCreateEditor}
            onOpenEditEditor={ctl.buildLibrary.openEditEditor}
            onCloseEditor={ctl.buildLibrary.closeEditor}
            onInspectBuild={ctl.buildLibrary.inspectBuild}
            onSaveFromEditor={ctl.buildLibrary.saveFromEditor}
            onActivateBuild={ctl.buildLibrary.activateBuild}
            onDuplicateBuild={(entry) =>
              ctl.buildLibrary.handleDuplicateBuild(entry, appMsg.desktop.copySuffix)
            }
            onMoveBuild={ctl.buildLibrary.handleMoveBuild}
            onDeleteBuild={ctl.buildLibrary.handleDeleteBuild}
            onCreateFolder={ctl.buildLibrary.handleCreateFolder}
            onRenameFolder={ctl.buildLibrary.handleRenameFolder}
            onDeleteFolder={ctl.buildLibrary.handleDeleteFolder}
            onOpenLibraryFolder={ctl.buildLibrary.openBuildsFolder}
            onResetProgress={ctl.resetProgress}
          />
        )}

        {tab === "overlay" && (
          <OverlayControlCenterCard
            config={overlayConfig}
            onUpdateConfig={handleUpdateOverlayConfig}
            onToggleVisibility={() => void toggleOverlayVisibilityIpc()}
            onToggleLock={() => void toggleOverlayClickThroughIpc()}
            onResetOverlayLayouts={() => handleUpdateOverlayConfig({ ...overlayConfig, modeLayouts: {} })}
          />
        )}

        {tab === "connect" && (
          <ConnectTabView
            roomId={ctl.roomId}
            pin={ctl.pin}
            relayUrl={ctl.relayUrl}
            relayConnected={ctl.relayConnected}
            relayError={ctl.relayError}
            viewers={ctl.viewers}
            onChangeRelayUrl={ctl.setRelayUrl}
            onRotatePin={ctl.rotatePin}
            onReconnectRelay={ctl.reconnectRelay}
            accountName={ctl.accountName}
            selectedLeague={ctl.selectedLeague}
            characterName={ctl.characterName}
            pobCharacterClass={ctl.snapshot?.characterClass ?? null}
            syncStatus={ctl.snapshot?.characterSyncStatus ?? "UNCONFIGURED"}
            syncMessage={ctl.syncMessage}
            onChangeAccount={ctl.setAccountName}
            onChangeLeague={ctl.setSelectedLeague}
            onChangeCharacter={ctl.setCharacterName}
            onSelectCharacter={ctl.selectCharacter}
            onForceSync={ctl.forceSync}
          />
        )}

        {tab === "game" && (
          <div className="space-y-3">
            <ClientLogSettingsCard
              clientLogPath={ctl.clientLogPath}
              clientLogFound={ctl.clientLogFound}
              autoClipboard={ctl.snapshot?.autoClipboardEnabled ?? true}
              inGameTreeOpen={ctl.snapshot?.inGameTreeOpen ?? false}
              passiveTreeHotkey={ctl.passiveTreeHotkey}
              activeVendorRegex={ctl.snapshot?.activeVendorRegex ?? ""}
              onSetLogPath={ctl.setLogPath}
              onAutoDetectPath={ctl.autoDetectPath}
              onToggleAutoClipboard={ctl.toggleAutoClipboard}
              onChangePassiveTreeHotkey={ctl.setPassiveTreeHotkey}
              onCopyRegexNow={ctl.copyRegexNow}
            />

            <LeagueStarterFilterCard />

            <CampaignSimulatorDrawer
              poeRunning={ctl.snapshot?.poeRunning ?? false}
              inGameTreeOpen={ctl.snapshot?.inGameTreeOpen ?? false}
              passiveTreeHotkey={ctl.passiveTreeHotkey}
              simulatedOutage={ctl.simulatedOutage}
              onSimulateLogLines={ctl.simulateLogLines}
              onToggleSimPoeRunning={ctl.toggleSimPoeRunning}
              onToggleSimInGameTree={ctl.toggleSimInGameTree}
              onToggleSimulatedOutage={ctl.toggleSimulatedOutage}
            />
          </div>
        )}
      </main>

      <DesktopUpdateFooterBar />
    </div>
  );
}
