import type { HudContextMode, HudSessionSnapshot } from "@exile-hud/core";
import { ThemeSelectorPopover } from "@exile-hud/hud-ui";
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

/** Compact overlay header: slim status strip when click-through locked; full dock/drag controls when unlocked. */
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
      <div className="px-3 py-1.5 border-b border-hud-hairline flex items-center justify-between gap-2 text-[11px] select-none pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-hud-accent font-semibold tracking-wide">{activeDisplayMode}</span>
          <span className="text-hud-text/90 truncate font-medium">
            {snapshot ? `${snapshot.currentAreaName} (Lv ${snapshot.currentAreaLevel})` : "Waiting for PC host..."}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-hud-muted font-mono shrink-0">
          <Lock className="h-3 w-3 text-hud-warn" />
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
    <div className="border-b border-hud-hairline select-none">
      <div className="px-2.5 py-1.5 flex items-center justify-between gap-1.5 flex-wrap">
        <button
          type="button"
          onMouseDown={handleDragStart}
          title="Drag overlay window"
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-hud-subtle text-[11px] text-hud-muted hover:text-hud-text cursor-move shrink-0"
        >
          <GripHorizontal className="h-3.5 w-3.5 text-hud-accent" />
          <span className="font-semibold text-hud-text">{activeDisplayMode}</span>
        </button>

        <div className="flex items-center gap-2 text-[11px]">
          {(["AUTO", "FIELD", "TOWN", "LAB", "TREE"] as const).map((m) => {
            const active = m === "AUTO" ? previewModeOverride === null : previewModeOverride === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSelectPreviewMode(m === "AUTO" ? null : m)}
                className={`pb-0.5 border-b-2 cursor-pointer transition-colors ${
                  active
                    ? "border-hud-accent text-hud-accent font-semibold"
                    : "border-transparent text-hud-muted hover:text-hud-text"
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                fullTreeExpanded
                  ? "text-hud-ok bg-hud-subtle"
                  : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
              }`}
            >
              {fullTreeExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {fullTreeExpanded ? "Compact" : "Expand"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPositionMenu((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
              showPositionMenu
                ? "text-hud-accent bg-hud-subtle font-semibold"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            Dock
          </button>

          <button
            type="button"
            onClick={onToggleEditMode}
            title="Edit overlay widgets"
            className={`p-1 rounded cursor-pointer ${
              editMode
                ? "bg-hud-accent text-hud-accent-fg"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            <Pencil className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateConfig({ ...config, pinOnDesktop: !config.pinOnDesktop })}
            title={config.pinOnDesktop ? "Pinned across Alt-Tab" : "Auto-hides on Alt-Tab"}
            className={`p-1 rounded cursor-pointer ${
              config.pinOnDesktop ? "text-hud-ok bg-hud-subtle" : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            <Pin className="h-3 w-3" />
          </button>

          <ThemeSelectorPopover compact />

          <button
            type="button"
            onClick={() => onUpdateConfig({ ...config, clickThroughLocked: true })}
            title={`Lock click-through (${config.toggleLockHotkey})`}
            className="px-1.5 py-0.5 rounded text-hud-warn hover:bg-hud-subtle text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Unlock className="h-3 w-3" /> Lock
          </button>

          <button
            type="button"
            onClick={onHideOverlay}
            title={`Hide overlay (${config.toggleVisibilityHotkey})`}
            className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showPositionMenu && (
        <div className="px-2.5 py-1.5 border-t border-hud-hairline flex items-center justify-between gap-2 flex-wrap text-[11px]">
          <div className="flex items-center gap-1">
            {DOCK_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => void applyOverlayDockPresetIpc(pill.id)}
                className={`px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                  config.dockPreset === pill.id
                    ? "bg-hud-accent text-hud-accent-fg font-semibold"
                    : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-hud-muted font-mono">
            <span>{config.opacityPercent}%</span>
            <input
              type="range"
              min={35}
              max={100}
              value={config.opacityPercent}
              onChange={(e) => onUpdateConfig({ ...config, opacityPercent: Number(e.target.value) })}
              className="w-20 cursor-pointer"
              style={{ accentColor: "var(--hud-accent)" }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
