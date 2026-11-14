import { useState } from "react";
import { DesktopUpdateFooterBar } from "./features/auto_updater/desktop_update_footer_bar.js";
import { ClientLogAndSimulatorCard } from "./features/environment_panel/client_log_and_simulator_card.js";
import { CharacterSyncSettingsCard } from "./features/ggg_sync_panel/character_sync_settings_card.js";
import { useDesktopHostController } from "./features/host_coordinator/use_desktop_host_controller.js";
import { QrRoomPairingCard } from "./features/pairing_panel/qr_room_pairing_card.js";
import { CampaignProgressResetBar } from "./features/pob_profile_panel/campaign_progress_reset_bar.js";
import { PobBuildLoaderCard } from "./features/pob_profile_panel/pob_build_loader_card.js";

type TabKey = "pairing" | "build" | "simulator";

export function App() {
  const [tab, setTab] = useState<TabKey>("pairing");
  const ctl = useDesktopHostController();

  return (
    <div className="min-h-screen bg-black text-neutral-100 p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">Exile Control Center</h1>
          <p className="text-[11px] font-mono text-neutral-400">
            {ctl.snapshot ? `${ctl.snapshot.mode} · ${ctl.snapshot.currentAreaName}` : "Initializing..."}
          </p>
        </div>
        <div className="flex rounded-lg bg-neutral-950 border border-neutral-800 p-0.5 text-xs">
          {(["pairing", "build", "simulator"] as TabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-2.5 py-1 rounded-md capitalize cursor-pointer ${
                tab === key ? "bg-indigo-600 text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {key === "build" ? "PoB & API" : key === "simulator" ? "Log & Sim" : "Pair"}
            </button>
          ))}
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
