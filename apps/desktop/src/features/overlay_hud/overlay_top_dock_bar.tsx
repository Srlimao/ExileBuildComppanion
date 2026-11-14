import type { HudContextMode, HudSessionSnapshot } from "@exile-hud/core";
import { GripHorizontal, Lock, Maximize2, Minimize2, Pencil, Pin, Unlock, X } from "lucide-react";
import { useState } from "react";
import {
  applyOverlayDockPresetIpc,
  saveOverlayFreeBoundsIpc,
  startOverlayWindowDrag,
  type OverlayDockPreset,
  type SavedOverlayConfig,
} from "./overlay_types_and_ipc.js";

const DOCK_PILLS: Array<{ id: Exclude<OverlayDockPreset, "free">; label: string }> = [
  { id: "top-left", label: "TL" },
  { id: "top-right", label: "TR" },
  { id: "bottom-left", label: "BL" },
  { id: "bottom-right", label: "BR" },
  { id: "left-edge", label: "L" },
  { id: "right-edge", label: "R" },
];

interface OverlayTopDockBarProps {
  snapshot: HudSessionSnapshot | null;
  config: SavedOverlayConfig;
  activeDisplayMode: HudContextMode;
  previewModeOverride: HudContextMode | null;
  fullTreeExpanded: boolean;
  editMode: boolean;
  onSelectPreviewMode: (mode: HudContextMode | null) => void;
  onToggleFullTree: () => void;
  onToggleEditMode: () => void;
  onUpdateConfig: (next: SavedOverlayConfig) => void;
  onHideOverlay: () => void;
}

/** Compact overlay header: slim status pill when click-through locked; full dock/drag controls when unlocked. */
export function OverlayTopDockBar({
  snapshot,
  config,
  activeDisplayMode,
  previewModeOverride,
  fullTreeExpanded,
  editMode,
  onSelectPreviewMode,
  onToggleFullTree,
  onToggleEditMode,
  onUpdateConfig,
  onHideOverlay,
}: OverlayTopDockBarProps) {
  const [showPositionMenu, setShowPositionMenu] = useState(false);

  if (config.clickThroughLocked) {
    return (
      <div className="px-2.5 py-1 border-b border-neutral-800/80 bg-black/75 flex items-center justify-between gap-2 text-[11px] select-none pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 font-semibold">
            {activeDisplayMode}
          </span>
          <span className="text-neutral-300 truncate font-medium">
            {snapshot ? `${snapshot.currentAreaName} (Lv ${snapshot.currentAreaLevel})` : "Waiting for PC host..."}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-neutral-400 font-mono shrink-0">
          <Lock className="h-3 w-3 text-amber-400" />
          {config.toggleLockHotkey !== "OFF" ? `${config.toggleLockHotkey} unlock` : "Locked"}
        </span>
      </div>
    );
  }

  const handleDragStart = () => {
    void startOverlayWindowDrag();
    window.setTimeout(() => {
      void saveOverlayFreeBoundsIpc();
    }, 350);
  };

  return (
    <div className="border-b border-neutral-800 bg-black/90 select-none">
      <div className="px-2 py-1.5 flex items-center justify-between gap-1.5 flex-wrap">
        <button
          type="button"
          onMouseDown={handleDragStart}
          title="Drag overlay window"
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white cursor-move shrink-0"
        >
          <GripHorizontal className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-semibold text-white">{activeDisplayMode}</span>
        </button>

        <div className="flex items-center gap-0.5 bg-neutral-950 border border-neutral-800 rounded-md p-0.5 text-[10px]">
          {(["AUTO", "FIELD", "TOWN", "LAB", "TREE"] as const).map((m) => {
            const active = m === "AUTO" ? previewModeOverride === null : previewModeOverride === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSelectPreviewMode(m === "AUTO" ? null : m)}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  active ? "bg-indigo-600 text-white font-semibold" : "text-neutral-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {activeDisplayMode === "TREE" && (
            <button
              type="button"
              onClick={onToggleFullTree}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
                fullTreeExpanded
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                  : "bg-neutral-900 border-neutral-700 text-neutral-200 hover:border-neutral-500"
              }`}
            >
              {fullTreeExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {fullTreeExpanded ? "Compact" : "Expand Tree"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPositionMenu((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
              showPositionMenu
                ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            Dock
          </button>

          <button
            type="button"
            onClick={onToggleEditMode}
            title="Edit overlay widgets"
            className={`p-1 rounded border cursor-pointer ${
              editMode
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            <Pencil className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateConfig({ ...config, pinOnDesktop: !config.pinOnDesktop })}
            title={config.pinOnDesktop ? "Pinned across Alt-Tab" : "Auto-hides on Alt-Tab"}
            className={`p-1 rounded border cursor-pointer ${
              config.pinOnDesktop
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <Pin className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateConfig({ ...config, clickThroughLocked: true })}
            title={`Lock click-through (${config.toggleLockHotkey})`}
            className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Unlock className="h-3 w-3" /> Lock
          </button>

          <button
            type="button"
            onClick={onHideOverlay}
            title={`Hide overlay (${config.toggleVisibilityHotkey})`}
            className="p-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showPositionMenu && (
        <div className="px-2 py-1.5 border-t border-neutral-800/80 bg-neutral-950/90 flex items-center justify-between gap-2 flex-wrap text-[11px]">
          <div className="flex items-center gap-1">
            {DOCK_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => void applyOverlayDockPresetIpc(pill.id)}
                className={`px-1.5 py-0.5 rounded font-mono border cursor-pointer ${
                  config.dockPreset === pill.id
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-black border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-neutral-400 font-mono">
            <span>{config.opacityPercent}%</span>
            <input
              type="range"
              min={35}
              max={100}
              value={config.opacityPercent}
              onChange={(e) => onUpdateConfig({ ...config, opacityPercent: Number(e.target.value) })}
              className="w-20 accent-indigo-500 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
