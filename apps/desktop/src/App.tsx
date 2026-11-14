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
    <div className="min-h-screen bg-black text-neutral-100 p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-2">
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight text-white truncate">Exile Control Center</h1>
          <p className="text-[11px] font-mono text-neutral-400 truncate">
            {ctl.snapshot ? `${ctl.snapshot.mode} · ${ctl.snapshot.currentAreaName}` : "Initializing..."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void toggleOverlayVisibilityIpc()}
            title={`Toggle local PC overlay (${overlayConfig.toggleVisibilityHotkey})`}
            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
              overlayConfig.enabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {overlayConfig.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            HUD
          </button>
          <div className="flex rounded-lg bg-neutral-950 border border-neutral-800 p-0.5 text-[11px]">
            {(["pairing", "overlay", "build", "simulator"] as TabKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-2 py-1 rounded-md capitalize cursor-pointer ${
                  tab === key ? "bg-indigo-600 text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {key === "build" ? "PoB" : key === "simulator" ? "Sim" : key === "overlay" ? "Overlay" : "Pair"}
              </button>
            ))}
          </div>
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
        <div className="space-y-3">
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

          <CharacterSyncSettingsCard
            accountName={ctl.accountName}
            characterName={ctl.characterName}
            syncStatus={ctl.snapshot?.characterSyncStatus ?? "UNCONFIGURED"}
            hasStoredSession={ctl.hasStoredSession}
            syncMessage={ctl.syncMessage}
            onChangeAccount={ctl.setAccountName}
            onChangeCharacter={ctl.setCharacterName}
            onSavePoesessid={ctl.savePoesessid}
            onClearPoesessid={ctl.clearPoesessid}
            onForceSync={ctl.forceSync}
          />
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
