import {
  resolveSnapshotGameId,
  type DeviceFormFactor,
  type HudContextMode,
  type HudSessionSnapshot,
  type SupportedGameId,
} from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import { ExileRelayBrandIcon, useHudI18n } from "@exile-hud/hud-ui";
import { Pin, Settings, ShieldAlert, Unlock, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import type { ConnectionPhase } from "../pairing_and_connection/edge_websocket_room_client.js";
import { HudSettingsDrawer } from "./hud_settings_drawer.js";

interface HudTopTelemetryBarProps {
  snapshot: HudSessionSnapshot;
  activeDisplayMode: HudContextMode;
  previewModeOverride: HudContextMode | null;
  editLayoutMode: boolean;
  formFactor: DeviceFormFactor;
  connectionPhase: ConnectionPhase;
  wakeLocked: boolean;
  isDemo: boolean;
  onToggleEditLayout: () => void;
  onSelectPreviewMode: (mode: HudContextMode | null) => void;
  onTriggerManualSync: () => void;
  onResetProgress: () => void;
  onOpenPairingModal?: () => void;
  onReconnectNow?: () => void;
  onForceRefresh?: () => void;
  onSwitchDemoGame?: (gameId: SupportedGameId) => void;
}

function getXpRangeLabel(playerLvl: number, zoneLvl: number): { label: string; ok: boolean } {
  const safeDelta = 3 + Math.floor(playerLvl / 16);
  const diff = Math.abs(playerLvl - zoneLvl);
  return {
    label: `Z${zoneLvl} (${diff <= safeDelta ? "100% XP" : `Δ${diff}`})`,
    ok: diff <= safeDelta,
  };
}

export function HudTopTelemetryBar({
  snapshot,
  activeDisplayMode,
  previewModeOverride,
  editLayoutMode,
  formFactor,
  connectionPhase,
  wakeLocked,
  isDemo,
  onToggleEditLayout,
  onSelectPreviewMode,
  onTriggerManualSync,
  onResetProgress,
  onOpenPairingModal,
  onReconnectNow,
  onForceRefresh,
  onSwitchDemoGame,
}: HudTopTelemetryBarProps) {
  const { locale, msg, appMsg } = useHudI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const gameId = resolveSnapshotGameId(snapshot);
  const isPoe2 = gameId === "poe2";
  const adapter = getGameAdapter(gameId);
  const xp = getXpRangeLabel(snapshot.characterLevel, snapshot.currentAreaLevel);
  const modePills: HudContextMode[] = ["FIELD", "TOWN", "LAB", "TREE"];
  const showFinishLayoutPill = editLayoutMode && activeDisplayMode !== "TREE" && activeDisplayMode !== "STANDBY";

  return (
    <>
      <header className="sticky top-0 z-30 bg-hud-bg/92 backdrop-blur border-b border-hud-hairline pt-[max(0.5rem,env(safe-area-inset-top))] sm:pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onOpenPairingModal ? (
              <button
                type="button"
                onClick={onOpenPairingModal}
                title={appMsg.pwa.homeTooltip}
                aria-label={appMsg.pwa.homeTooltip}
                className="shrink-0 p-1 -m-1 rounded-lg hover:opacity-85 transition-opacity cursor-pointer"
              >
                <ExileRelayBrandIcon className="h-7 w-7" />
              </button>
            ) : (
              <ExileRelayBrandIcon className="h-7 w-7 shrink-0" />
            )}

            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-hud-text truncate">
                  {snapshot.currentAreaName}
                </h1>
                {isPoe2 && (
                  <span className="rounded-md bg-hud-subtle border border-hud-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-hud-accent shrink-0">
                    {appMsg.poe2.gameShortLabels.poe2}
                  </span>
                )}
                <span className={`text-xs font-mono tabular-nums ${xp.ok ? "text-hud-ok" : "text-hud-warn"}`}>
                  {xp.label}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-hud-muted mt-0.5 flex-wrap">
                <span>
                  {isPoe2
                    ? appMsg.poe2.stageSummary(
                        adapter.getActDisplayLabel(snapshot.currentAct, locale),
                        snapshot.characterLevel,
                        snapshot.characterClass,
                      )
                    : appMsg.pwa.actSummary(snapshot.currentAct, snapshot.characterLevel, snapshot.characterClass)}
                </span>
                {snapshot.characterName && <span className="text-hud-muted">({snapshot.characterName})</span>}
                {snapshot.isEndgameOnlyFallback && (
                  <span className="inline-flex items-center gap-1 text-hud-warn font-medium">
                    <ShieldAlert className="h-3 w-3" /> {appMsg.pwa.fallbackLeveling}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <nav className="flex items-center gap-1 sm:gap-2" aria-label={msg.a11y.hudModesNavLabel}>
              {modePills.map((m) => {
                const selected = activeDisplayMode === m;
                const isPinned = previewModeOverride === m;
                const treePulse = m === "TREE" && Boolean(snapshot.inGameTreeOpen);
                const modeLabel = msg.modes[m];
                return (
                  <button
                    key={m}
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    aria-pressed={isPinned}
                    title={appMsg.pwa.pinModeTitle(modeLabel, isPinned)}
                    onClick={() => onSelectPreviewMode(previewModeOverride === m ? null : m)}
                    className={`inline-flex items-center gap-1.5 px-2 py-2 -my-1 border-b-2 rounded-t-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                      selected
                        ? "border-hud-accent text-hud-accent"
                        : "border-transparent text-hud-muted hover:text-hud-text"
                    }`}
                  >
                    {treePulse && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-hud-ok motion-safe:animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                    <span>{modeLabel}</span>
                    {isPinned && (
                      <span
                        data-testid={`mode-pin-${m.toLowerCase()}`}
                        className="inline-flex items-center justify-center text-hud-danger"
                        aria-label={appMsg.pwa.pinnedModeAria}
                      >
                        <Pin className="h-3 w-3 rotate-45" />
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <span className="hidden sm:inline-block h-3.5 w-px bg-hud-hairline" aria-hidden="true" />

            <div className="flex items-center gap-2 text-xs">
              {isDemo && onSwitchDemoGame && (
                <div
                  role="group"
                  data-testid="demo-game-switcher"
                  aria-label={appMsg.poe2.demoGameToggleTitle}
                  className="inline-flex items-center gap-0.5 rounded-lg bg-hud-subtle border border-hud-hairline p-0.5"
                >
                  {(["poe1", "poe2"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={gameId === g}
                      onClick={() => onSwitchDemoGame(g)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                        gameId === g ? "bg-hud-accent text-hud-accent-fg" : "text-hud-muted hover:text-hud-text"
                      }`}
                    >
                      {appMsg.poe2.gameShortLabels[g]}
                    </button>
                  ))}
                </div>
              )}

              {showFinishLayoutPill && (
                <button
                  type="button"
                  data-testid="hud-finish-layout-btn"
                  onClick={onToggleEditLayout}
                  title={appMsg.pwa.finishLayoutTitle(formFactor)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-hud-accent text-hud-accent-fg text-xs font-semibold cursor-pointer"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>{appMsg.pwa.done}</span>
                </button>
              )}

              <div role="status" aria-live="polite" className="inline-flex items-center">
                {!isDemo && connectionPhase !== "connected" && onReconnectNow ? (
                  <button
                    type="button"
                    onClick={onReconnectNow}
                    title={appMsg.pwa.reconnectNowTitle}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-mono text-hud-warn hover:underline cursor-pointer"
                  >
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>{appMsg.pwa.connectionPhases[connectionPhase]}</span>
                    {wakeLocked && <span className="text-hud-ok">· {appMsg.pwa.awakeTag}</span>}
                  </button>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-mono ${
                      isDemo
                        ? "text-hud-accent"
                        : connectionPhase === "connected"
                          ? "text-hud-ok"
                          : "text-hud-warn"
                    }`}
                  >
                    {connectionPhase === "connected" || isDemo ? (
                      <Wifi className="h-3.5 w-3.5" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5" />
                    )}
                    <span>{isDemo ? appMsg.pwa.demoTag : appMsg.pwa.connectionPhases[connectionPhase]}</span>
                    {wakeLocked && <span className="text-hud-ok">· {appMsg.pwa.awakeTag}</span>}
                  </span>
                )}
              </div>

              <button
                type="button"
                data-testid="hud-settings-trigger"
                aria-label={appMsg.pwa.openSettings}
                aria-expanded={settingsOpen}
                title={appMsg.pwa.settingsTitle}
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 p-2 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle transition-colors cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: "var(--hud-accent)",
                    boxShadow: "0 0 0 1px var(--hud-hairline)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      <HudSettingsDrawer
        open={settingsOpen}
        snapshot={snapshot}
        activeDisplayMode={activeDisplayMode}
        editLayoutMode={editLayoutMode}
        formFactor={formFactor}
        connectionPhase={connectionPhase}
        wakeLocked={wakeLocked}
        isDemo={isDemo}
        onClose={() => setSettingsOpen(false)}
        onToggleEditLayout={onToggleEditLayout}
        onTriggerManualSync={onTriggerManualSync}
        onResetProgress={onResetProgress}
        onOpenPairingModal={onOpenPairingModal}
        onForceRefresh={onForceRefresh}
      />
    </>
  );
}
