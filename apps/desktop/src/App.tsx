import { ExileRelayBrandIcon, ThemeSelectorPopover } from "@exile-hud/hud-ui";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { DesktopUpdateFooterBar } from "./features/auto_updater/desktop_update_footer_bar.js";
import { ClientLogAndSimulatorCard } from "./features/environment_panel/client_log_and_simulator_card.js";
import { CharacterSyncSettingsCard } from "./features/ggg_sync_panel/character_sync_settings_card.js";
import { useDesktopHostController } from "./features/host_coordinator/use_desktop_host_controller.js";
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
import { QrRoomPairingCard } from "./features/pairing_panel/qr_room_pairing_card.js";
import { CampaignProgressResetBar } from "./features/pob_profile_panel/campaign_progress_reset_bar.js";
import { PobBuildLoaderCard } from "./features/pob_profile_panel/pob_build_loader_card.js";

type TabKey = "pairing" | "overlay" | "build" | "simulator";

export function App() {
  const [tab, setTab] = useState<TabKey>("pairing");
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
    <div className="min-h-screen bg-hud-bg text-hud-text px-4 py-3.5 flex flex-col gap-4 transition-colors">
      <header className="flex items-center justify-between gap-2 border-b border-hud-hairline pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <ExileRelayBrandIcon className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-hud-text truncate">Exile Relay</h1>
            <p className="text-[11px] font-mono text-hud-muted truncate">
              {ctl.snapshot ? `${ctl.snapshot.mode} · ${ctl.snapshot.currentAreaName}` : "Initializing..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void toggleOverlayVisibilityIpc()}
            title={`Toggle local PC overlay (${overlayConfig.toggleVisibilityHotkey})`}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              overlayConfig.enabled
                ? "text-hud-ok bg-hud-subtle"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            {overlayConfig.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            HUD
          </button>

          <nav className="flex items-center gap-2.5 text-xs">
            {(["pairing", "overlay", "build", "simulator"] as TabKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`pb-0.5 border-b-2 capitalize cursor-pointer transition-colors ${
                  tab === key
                    ? "border-hud-accent text-hud-accent font-semibold"
                    : "border-transparent text-hud-muted hover:text-hud-text"
                }`}
              >
                {key === "build" ? "PoB" : key === "simulator" ? "Sim" : key === "overlay" ? "Overlay" : "Pair"}
              </button>
            ))}
          </nav>

          <ThemeSelectorPopover compact />
        </div>
      </header>

      {ctl.snapshot && (
        <CampaignProgressResetBar snapshot={ctl.snapshot} onResetProgress={ctl.resetProgress} />
      )}

      {tab === "pairing" && (
        <QrRoomPairingCard
          roomId={ctl.roomId}
          pin={ctl.pin}
          relayUrl={ctl.relayUrl}
          relayConnected={ctl.relayConnected}
          relayError={ctl.relayError}
          viewers={ctl.viewers}
          onChangeRelayUrl={ctl.setRelayUrl}
          onRotatePin={ctl.rotatePin}
          onReconnectRelay={ctl.reconnectRelay}
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

      {tab === "build" && (
        <div className="space-y-6">
          <PobBuildLoaderCard
            snapshot={ctl.snapshot}
            pobInput={ctl.pobInput}
            pobPreview={ctl.pobPreview}
            pobSelection={ctl.pobSelection}
            pobStoragePath={ctl.pobStoragePath}
            leagueStart={ctl.leagueStart}
            customRouteText={ctl.customRouteText}
            loading={ctl.compileLoading}
            error={ctl.compileError}
            onInspectBuild={ctl.inspectBuild}
            onOpenStorageFolder={ctl.openStorageFolder}
            onApplyBuild={ctl.applyBuild}
          />

          <div className="border-t border-hud-hairline pt-5">
            <CharacterSyncSettingsCard
              accountName={ctl.accountName}
              characterName={ctl.characterName}
              syncStatus={ctl.snapshot?.characterSyncStatus ?? "UNCONFIGURED"}
              syncMessage={ctl.syncMessage}
              onChangeAccount={ctl.setAccountName}
              onChangeCharacter={ctl.setCharacterName}
              onForceSync={ctl.forceSync}
            />
          </div>
        </div>
      )}

      {tab === "simulator" && (
        <ClientLogAndSimulatorCard
          clientLogPath={ctl.clientLogPath}
          clientLogFound={ctl.clientLogFound}
          autoClipboard={ctl.snapshot?.autoClipboardEnabled ?? true}
          poeRunning={ctl.snapshot?.poeRunning ?? false}
          inGameTreeOpen={ctl.snapshot?.inGameTreeOpen ?? false}
          passiveTreeHotkey={ctl.passiveTreeHotkey}
          simulatedOutage={ctl.simulatedOutage}
          activeVendorRegex={ctl.snapshot?.activeVendorRegex ?? ""}
          onSetLogPath={ctl.setLogPath}
          onAutoDetectPath={ctl.autoDetectPath}
          onToggleAutoClipboard={ctl.toggleAutoClipboard}
          onChangePassiveTreeHotkey={ctl.setPassiveTreeHotkey}
          onCopyRegexNow={ctl.copyRegexNow}
          onSimulateLogLines={ctl.simulateLogLines}
          onToggleSimPoeRunning={ctl.toggleSimPoeRunning}
          onToggleSimInGameTree={ctl.toggleSimInGameTree}
          onToggleSimulatedOutage={ctl.toggleSimulatedOutage}
        />
      )}

      <DesktopUpdateFooterBar />
    </div>
  );
}
