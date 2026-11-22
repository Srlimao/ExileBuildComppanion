import { useHudI18n } from "@exile-hud/hud-ui";
import { Eye, EyeOff, Lock, Pin, RotateCcw, Unlock } from "lucide-react";
import { OverlayMonitorDockPicker } from "./overlay_monitor_dock_picker.js";
import type { SavedOverlayConfig } from "./overlay_types_and_ipc.js";

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
  const { appMsg } = useHudI18n();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleVisibility}
          className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            config.enabled
              ? "bg-hud-accent text-hud-accent-fg hover:opacity-90"
              : "bg-hud-surface border border-hud-hairline text-hud-text hover:bg-hud-subtle"
          }`}
        >
          {config.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="truncate">
            {config.enabled ? appMsg.desktop.hideOverlay : appMsg.desktop.openOverlay} (
            {config.toggleVisibilityHotkey})
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleLock}
          className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
            config.clickThroughLocked
              ? "bg-hud-subtle border-hud-hairline text-hud-warn"
              : "bg-hud-surface border-hud-hairline text-hud-text hover:bg-hud-subtle"
          }`}
        >
          {config.clickThroughLocked ? (
            <Lock className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Unlock className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {config.clickThroughLocked
              ? appMsg.desktop.clickThroughLocked
              : appMsg.desktop.interactiveUnlocked}{" "}
            ({config.toggleLockHotkey})
          </span>
        </button>
      </div>

      <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-hud-text">{appMsg.desktop.snapDockPosition}</span>
          <span className="font-mono text-[11px] text-hud-muted truncate">
            {config.dockPreset === "free"
              ? appMsg.desktop.freeFloating
              : appMsg.desktop.dockLabels[config.dockPreset]}
          </span>
        </div>
        <OverlayMonitorDockPicker config={config} />
      </section>

      <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3.5 space-y-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-hud-muted">{appMsg.desktop.backdropOpacity}</span>
            <span className="font-mono font-semibold text-hud-text">{config.opacityPercent}%</span>
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

        <label className="flex items-center justify-between gap-3 pt-2.5 border-t border-hud-hairline cursor-pointer">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-hud-text">
              <Pin className="h-3.5 w-3.5 text-hud-ok shrink-0" />
              {appMsg.desktop.pinOnDesktop}
            </span>
            <span className="text-[11px] text-hud-muted block pl-5">
              {appMsg.desktop.pinOnDesktopHint}
            </span>
          </div>
          <input
            type="checkbox"
            checked={config.pinOnDesktop}
            onChange={(e) => onUpdateConfig({ ...config, pinOnDesktop: e.target.checked })}
            className="cursor-pointer shrink-0"
            style={{ accentColor: "var(--hud-accent)" }}
          />
        </label>
      </section>

      <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-hud-muted">
            <span className="block truncate">{appMsg.desktop.toggleOverlayKey}</span>
            <input
              type="text"
              value={config.toggleVisibilityHotkey}
              onChange={(e) =>
                onUpdateConfig({ ...config, toggleVisibilityHotkey: e.target.value.toUpperCase() })
              }
              placeholder="F7"
              className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
            />
          </label>
          <label className="space-y-1 text-xs text-hud-muted">
            <span className="block truncate">{appMsg.desktop.clickThroughLockKey}</span>
            <input
              type="text"
              value={config.toggleLockHotkey}
              onChange={(e) =>
                onUpdateConfig({ ...config, toggleLockHotkey: e.target.value.toUpperCase() })
              }
              placeholder="F8"
              className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline">
          <p className="text-[11px] text-hud-muted">{appMsg.desktop.windowedNote}</p>
          <button
            type="button"
            onClick={onResetOverlayLayouts}
            className="px-2 py-1 rounded-lg text-[11px] text-hud-muted hover:text-hud-text hover:bg-hud-subtle inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> {appMsg.desktop.resetLayouts}
          </button>
        </div>
      </section>
    </div>
  );
}
