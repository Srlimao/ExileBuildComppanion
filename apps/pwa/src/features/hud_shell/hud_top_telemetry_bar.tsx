import type { DeviceFormFactor, HudContextMode, HudSessionSnapshot } from "@exile-hud/core";
import { Download, LayoutGrid, Lock, RefreshCw, ShieldAlert, Unlock, Wifi, WifiOff } from "lucide-react";
import { LATEST_PORTABLE_EXE_URL } from "../desktop_download/github_latest_release_client.js";
import type { ConnectionPhase } from "../pairing_and_connection/edge_websocket_room_client.js";

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
  onOpenPairingModal?: () => void;
}

function getXpRangeLabel(playerLvl: number, zoneLvl: number): { label: string; ok: boolean } {
  const safeDelta = 3 + Math.floor(playerLvl / 16);
  const diff = Math.abs(playerLvl - zoneLvl);
  return {
    label: `Zone ${zoneLvl} (${diff <= safeDelta ? "100% XP" : `Δ${diff}`})`,
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
  onOpenPairingModal,
}: HudTopTelemetryBarProps) {
  const xp = getXpRangeLabel(snapshot.characterLevel, snapshot.currentAreaLevel);
  const modePills: HudContextMode[] = ["FIELD", "TOWN", "LAB", "TREE"];

  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur border-b border-neutral-800 px-3 sm:px-5 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              {snapshot.currentAreaName}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-mono tabular-nums border ${
                xp.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              {xp.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-400 mt-0.5 flex-wrap">
            <span className="font-medium text-neutral-200">
              Act {snapshot.currentAct} • Lv {snapshot.characterLevel} {snapshot.characterClass}
            </span>
            {snapshot.characterName && <span className="text-neutral-500">({snapshot.characterName})</span>}
            {snapshot.isEndgameOnlyFallback && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs">
                <ShieldAlert className="h-3.5 w-3.5" /> Fallback Leveling
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg bg-neutral-950 border border-neutral-800 p-0.5">
            {modePills.map((m) => {
              const selected = activeDisplayMode === m;
              const isPinned = previewModeOverride === m;
              const treePulse = m === "TREE" && Boolean(snapshot.inGameTreeOpen);
              return (
                <button
                  key={m}
                  type="button"
                  title={isPinned ? `${m} pinned (click to return to auto)` : `View ${m}`}
                  onClick={() => onSelectPreviewMode(previewModeOverride === m ? null : m)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                    selected
                      ? "bg-indigo-600 text-white"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {treePulse && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  )}
                  <span>{m}</span>
                  {isPinned && <span className="text-[9px] text-indigo-200">PIN</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onTriggerManualSync}
            title="Sync Character Gear Now"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
              snapshot.characterSyncStatus === "OFFLINE_FALLBACK"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {snapshot.characterSyncStatus === "OFFLINE_FALLBACK" ? "API Fallback" : "Sync"}
          </button>

          {activeDisplayMode !== "TREE" && activeDisplayMode !== "STANDBY" && (
            <button
              type="button"
              onClick={onToggleEditLayout}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                editLayoutMode
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {editLayoutMode ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              <LayoutGrid className="h-3.5 w-3.5" />
              {editLayoutMode ? `Editing (${formFactor})` : "Layout"}
            </button>
          )}

          <a
            href={LATEST_PORTABLE_EXE_URL}
            title="Download Ready-to-Run Windows PC Companion (.exe)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PC App</span>
          </a>

          {isDemo && onOpenPairingModal && (
            <button
              type="button"
              onClick={onOpenPairingModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold cursor-pointer"
            >
              Pair PC
            </button>
          )}

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
              isDemo
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                : connectionPhase === "connected"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            {connectionPhase === "connected" || isDemo ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span>{isDemo ? "DEMO" : connectionPhase.toUpperCase()}</span>
            {wakeLocked && <span className="text-emerald-400">• AWAKE</span>}
          </div>
        </div>
      </div>
    </header>
  );
}
