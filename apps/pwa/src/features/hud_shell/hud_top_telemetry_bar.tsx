import type { DeviceFormFactor, HudContextMode, HudSessionSnapshot } from "@exile-hud/core";
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
}: HudTopTelemetryBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const xp = getXpRangeLabel(snapshot.characterLevel, snapshot.currentAreaLevel);
  const modePills: HudContextMode[] = ["FIELD", "TOWN", "LAB", "TREE"];
  const showFinishLayoutPill = editLayoutMode && activeDisplayMode !== "TREE" && activeDisplayMode !== "STANDBY";

  return (
    <>
      <header className="sticky top-0 z-30 bg-hud-bg/92 backdrop-blur border-b border-hud-hairline px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-hud-text truncate">
                {snapshot.currentAreaName}
              </h1>
              <span className={`text-xs font-mono tabular-nums ${xp.ok ? "text-hud-ok" : "text-hud-warn"}`}>
                {xp.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-hud-muted mt-0.5 flex-wrap">
              <span>
                Act {snapshot.currentAct} · Lv {snapshot.characterLevel} {snapshot.characterClass}
              </span>
              {snapshot.characterName && <span className="text-hud-dim">({snapshot.characterName})</span>}
              {snapshot.isEndgameOnlyFallback && (
                <span className="inline-flex items-center gap-1 text-hud-warn font-medium">
                  <ShieldAlert className="h-3 w-3" /> Fallback Leveling
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <nav className="flex items-center gap-3" aria-label="HUD context mode">
              {modePills.map((m) => {
                const selected = activeDisplayMode === m;
                const isPinned = previewModeOverride === m;
                const treePulse = m === "TREE" && Boolean(snapshot.inGameTreeOpen);
                return (
                  <button
                    key={m}
                    type="button"
                    title={isPinned ? `${m} pinned — auto-switch paused (click to unpin)` : `View ${m}`}
                    onClick={() => onSelectPreviewMode(previewModeOverride === m ? null : m)}
                    className={`inline-flex items-center gap-1.5 pb-0.5 border-b-2 text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                      selected
                        ? "border-hud-accent text-hud-accent"
                        : "border-transparent text-hud-muted hover:text-hud-text"
                    }`}
                  >
                    {treePulse && (
                      <span className="h-1.5 w-1.5 rounded-full bg-hud-ok animate-pulse" aria-hidden="true" />
                    )}
                    <span>{m}</span>
                    {isPinned && (
                      <span
                        data-testid={`mode-pin-${m.toLowerCase()}`}
                        className="inline-flex items-center justify-center text-hud-danger"
                        aria-label="Pinned mode"
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
              {showFinishLayoutPill && (
                <button
                  type="button"
                  data-testid="hud-finish-layout-btn"
                  onClick={onToggleEditLayout}
                  title={`Finish editing ${formFactor} layout`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-hud-accent text-hud-accent-fg text-xs font-semibold cursor-pointer"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Done</span>
                </button>
              )}

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
                <span>{isDemo ? "DEMO" : connectionPhase.toUpperCase()}</span>
                {wakeLocked && <span className="text-hud-ok">· AWAKE</span>}
              </span>

              <button
                type="button"
                data-testid="hud-settings-trigger"
                aria-label="Open settings"
                aria-expanded={settingsOpen}
                title="Settings"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle transition-colors cursor-pointer"
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
      />
    </>
  );
}
