import { Eye, EyeOff, Lock, Pin, RotateCcw, Unlock } from "lucide-react";
import {
  applyOverlayDockPresetIpc,
  type OverlayDockPreset,
  type SavedOverlayConfig,
} from "./overlay_types_and_ipc.js";

const DOCK_OPTIONS: Array<{ id: Exclude<OverlayDockPreset, "free">; label: string }> = [
  { id: "top-left", label: "Top-Left" },
  { id: "top-right", label: "Top-Right" },
  { id: "bottom-left", label: "Bottom-Left" },
  { id: "bottom-right", label: "Bottom-Right" },
  { id: "left-edge", label: "Left Strip" },
  { id: "right-edge", label: "Right Strip" },
];

interface OverlayControlCenterCardProps {
  config: SavedOverlayConfig;
  onUpdateConfig: (next: SavedOverlayConfig) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onResetOverlayLayouts: () => void;
}

/** Desktop Control Center panel for managing the isolated local PC game overlay. */
export function OverlayControlCenterCard({
  config,
  onUpdateConfig,
  onToggleVisibility,
  onToggleLock,
  onResetOverlayLayouts,
}: OverlayControlCenterCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Local PC Game Overlay
          </h2>
          <p className="text-xs text-hud-muted mt-0.5">
            Floating HUD over Path of Exile — saved locally on PC, zero Cloudflare sync.
          </p>
        </div>
        <span className={`text-xs font-mono shrink-0 ${config.enabled ? "text-hud-ok" : "text-hud-muted"}`}>
          {config.enabled ? "ACTIVE" : "HIDDEN"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleVisibility}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            config.enabled
              ? "bg-hud-accent text-hud-accent-fg hover:opacity-90"
              : "bg-hud-subtle text-hud-text hover:opacity-90"
          }`}
        >
          {config.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {config.enabled ? "Hide Overlay" : "Open Overlay"}
        </button>

        <button
          type="button"
          onClick={onToggleLock}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            config.clickThroughLocked
              ? "bg-hud-subtle text-hud-warn"
              : "text-hud-text hover:bg-hud-subtle"
          }`}
        >
          {config.clickThroughLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {config.clickThroughLocked ? "Click-Through Locked" : "Interactive Unlocked"}
        </button>
      </div>

      <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
        <span className="flex items-center gap-2 text-xs text-hud-text">
          <Pin className="h-3.5 w-3.5 text-hud-ok" />
          Pin Always Visible on Desktop
          <span className="text-[11px] text-hud-muted">(off = auto-hide on Alt-Tab)</span>
        </span>
        <input
          type="checkbox"
          checked={config.pinOnDesktop}
          onChange={(e) => onUpdateConfig({ ...config, pinOnDesktop: e.target.checked })}
          className="cursor-pointer"
          style={{ accentColor: "var(--hud-accent)" }}
        />
      </label>

      <div className="space-y-1.5 pt-2 border-t border-hud-hairline">
        <div className="flex items-center justify-between text-xs text-hud-muted">
          <span>Snap Dock Position</span>
          <span className="font-mono text-[11px]">
            {config.dockPreset === "free" ? "Free Floating" : `Docked: ${config.dockPreset}`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DOCK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => void applyOverlayDockPresetIpc(opt.id)}
              className={`px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                config.dockPreset === opt.id
                  ? "bg-hud-accent text-hud-accent-fg font-semibold"
                  : "bg-hud-subtle text-hud-muted hover:text-hud-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-hud-muted">
          <span>Backdrop Opacity</span>
          <span className="font-mono text-hud-text">{config.opacityPercent}%</span>
        </div>
        <input
          type="range"
          min={35}
          max={100}
          value={config.opacityPercent}
          onChange={(e) => onUpdateConfig({ ...config, opacityPercent: Number(e.target.value) })}
          className="w-full cursor-pointer"
          style={{ accentColor: "var(--hud-accent)" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-hud-muted">
          <span>Toggle Overlay Key</span>
          <input
            type="text"
            value={config.toggleVisibilityHotkey}
            onChange={(e) =>
              onUpdateConfig({ ...config, toggleVisibilityHotkey: e.target.value.toUpperCase() })
            }
            placeholder="F7"
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1 text-xs text-hud-muted">
          <span>Click-Through Lock Key</span>
          <input
            type="text"
            value={config.toggleLockHotkey}
            onChange={(e) =>
              onUpdateConfig({ ...config, toggleLockHotkey: e.target.value.toUpperCase() })
            }
            placeholder="F8"
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline">
        <p className="text-[11px] text-hud-muted">
          Requires Path of Exile in Windowed Fullscreen or Windowed mode.
        </p>
        <button
          type="button"
          onClick={onResetOverlayLayouts}
          className="px-2 py-1 rounded-md text-[11px] text-hud-muted hover:text-hud-text hover:bg-hud-subtle inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" /> Reset Layouts
        </button>
      </div>
    </div>
  );
}
