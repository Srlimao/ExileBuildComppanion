import { Eye, EyeOff, Lock, Monitor, Pin, RotateCcw, Unlock } from "lucide-react";
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
    <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Local PC Game Overlay</h2>
            <p className="text-[11px] text-neutral-400">
              Floating HUD over Path of Exile — saved locally on PC, zero Cloudflare sync.
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
            config.enabled
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-neutral-900 border-neutral-800 text-neutral-400"
          }`}
        >
          {config.enabled ? "ACTIVE" : "HIDDEN"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleVisibility}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            config.enabled
              ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white"
              : "bg-black hover:bg-neutral-900 border-neutral-700 text-neutral-200"
          }`}
        >
          {config.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {config.enabled ? "Hide Overlay" : "Open Overlay"}
        </button>

        <button
          type="button"
          onClick={onToggleLock}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            config.clickThroughLocked
              ? "bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
              : "bg-black border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          {config.clickThroughLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {config.clickThroughLocked ? "Click-Through Locked" : "Interactive Unlocked"}
        </button>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg bg-black border border-neutral-800 px-3 py-2 cursor-pointer">
        <span className="flex items-center gap-2 text-xs text-neutral-200">
          <Pin className="h-3.5 w-3.5 text-emerald-400" />
          Pin Always Visible on Desktop
          <span className="text-[11px] text-neutral-500">(off = auto-hide on Alt-Tab)</span>
        </span>
        <input
          type="checkbox"
          checked={config.pinOnDesktop}
          onChange={(e) => onUpdateConfig({ ...config, pinOnDesktop: e.target.checked })}
          className="accent-indigo-500 cursor-pointer"
        />
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Snap Dock Position</span>
          <span className="font-mono text-[11px] text-neutral-500">
            {config.dockPreset === "free" ? "Free Floating" : `Docked: ${config.dockPreset}`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DOCK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => void applyOverlayDockPresetIpc(opt.id)}
              className={`px-2 py-1.5 rounded-lg text-xs border cursor-pointer ${
                config.dockPreset === opt.id
                  ? "bg-indigo-600/25 border-indigo-500/60 text-indigo-200 font-semibold"
                  : "bg-black border-neutral-800 text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Backdrop Opacity</span>
          <span className="font-mono text-neutral-200">{config.opacityPercent}%</span>
        </div>
        <input
          type="range"
          min={35}
          max={100}
          value={config.opacityPercent}
          onChange={(e) => onUpdateConfig({ ...config, opacityPercent: Number(e.target.value) })}
          className="w-full accent-indigo-500 cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Toggle Overlay Key</span>
          <input
            type="text"
            value={config.toggleVisibilityHotkey}
            onChange={(e) =>
              onUpdateConfig({ ...config, toggleVisibilityHotkey: e.target.value.toUpperCase() })
            }
            placeholder="F7"
            className="w-full rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-white"
          />
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Click-Through Lock Key</span>
          <input
            type="text"
            value={config.toggleLockHotkey}
            onChange={(e) =>
              onUpdateConfig({ ...config, toggleLockHotkey: e.target.value.toUpperCase() })
            }
            placeholder="F8"
            className="w-full rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-white"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
        <p className="text-[11px] text-neutral-500">
          Requires Path of Exile in Windowed Fullscreen or Windowed mode.
        </p>
        <button
          type="button"
          onClick={onResetOverlayLayouts}
          className="px-2.5 py-1 rounded-lg border border-neutral-800 bg-black text-[11px] text-neutral-300 hover:border-neutral-600 inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" /> Reset Layouts
        </button>
      </div>
    </div>
  );
}
