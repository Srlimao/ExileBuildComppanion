import { useHudI18n } from "@exile-hud/hud-ui";
import {
  applyOverlayDockPresetIpc,
  type OverlayDockPreset,
  type SavedOverlayConfig,
} from "./overlay_types_and_ipc.js";

const DOCK_GRID_ORDER: ReadonlyArray<Exclude<OverlayDockPreset, "free">> = [
  "top-left",
  "top-right",
  "left-edge",
  "right-edge",
  "bottom-left",
  "bottom-right",
];

const DOCK_PREVIEW_POS: Record<OverlayDockPreset, string> = {
  "top-left": "top-1.5 left-1.5 w-[34%] h-[42%]",
  "top-right": "top-1.5 right-1.5 w-[34%] h-[42%]",
  "bottom-left": "bottom-1.5 left-1.5 w-[34%] h-[42%]",
  "bottom-right": "bottom-1.5 right-1.5 w-[34%] h-[42%]",
  "left-edge": "top-1.5 bottom-1.5 left-1.5 w-[24%]",
  "right-edge": "top-1.5 bottom-1.5 right-1.5 w-[24%]",
  free: "top-2 left-1/2 -translate-x-1/2 w-[38%] h-[44%]",
};

interface OverlayMonitorDockPickerProps {
  config: SavedOverlayConfig;
}

/** Visual mini-monitor preview and 6-zone snap dock picker for the local PC overlay. */
export function OverlayMonitorDockPicker({ config }: OverlayMonitorDockPickerProps) {
  const { appMsg } = useHudI18n();
  const backdropAlpha = (Math.max(35, Math.min(100, config.opacityPercent)) / 100).toFixed(2);

  return (
    <div className="space-y-2.5">
      <div className="relative h-28 rounded-xl bg-hud-bg border border-hud-hairline overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(var(--hud-muted) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-widest text-hud-dim">
            {appMsg.desktop.monitorWindowLabel}
          </span>
        </div>

        {config.enabled ? (
          <div
            className={`absolute ${DOCK_PREVIEW_POS[config.dockPreset]} rounded-lg border border-hud-accent p-1.5 flex flex-col justify-between transition-all duration-200`}
            style={{ backgroundColor: `rgba(var(--hud-bg-rgb), ${backdropAlpha})` }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-hud-ok shrink-0" />
              <span className="text-[8px] font-mono text-hud-text/90 truncate">
                {config.clickThroughLocked ? appMsg.desktop.lockedLabel : "HUD"}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="h-1 rounded bg-hud-text/30 w-4/5" />
              <div className="h-1 rounded bg-hud-text/15 w-3/5" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-hud-bg/55 flex items-center justify-center">
            <span className="text-[11px] font-mono text-hud-muted">
              {appMsg.desktop.hiddenBadge} ({config.toggleVisibilityHotkey})
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {DOCK_GRID_ORDER.map((dockId) => {
          const active = config.dockPreset === dockId;
          return (
            <button
              key={dockId}
              type="button"
              onClick={() => void applyOverlayDockPresetIpc(dockId)}
              className={`px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors border ${
                active
                  ? "bg-hud-accent text-hud-accent-fg border-transparent font-semibold"
                  : "bg-hud-subtle text-hud-muted hover:text-hud-text border-transparent hover:border-hud-hairline"
              }`}
            >
              {appMsg.desktop.dockLabels[dockId]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
