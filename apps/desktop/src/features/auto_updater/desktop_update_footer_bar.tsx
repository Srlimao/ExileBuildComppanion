import { useHudI18n } from "@exile-hud/hud-ui";
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { useDesktopAutoUpdater } from "./use_desktop_auto_updater.js";

function formatMegabytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pinned slim footer showing version/update status or an expanded accent CTA when an update is ready. */
export function DesktopUpdateFooterBar() {
  const { appMsg } = useHudI18n();
  const { state, checkNow, installNow } = useDesktopAutoUpdater();
  const variantLabel =
    state.installVariant === "nsisSetup"
      ? appMsg.desktop.installerVariant
      : appMsg.desktop.standaloneVariant;
  const sizeLabel = formatMegabytes(state.assetSizeBytes);
  const isChecking = state.phase === "checking";
  const isDownloading = state.phase === "downloading";
  const isInstalling = state.phase === "installing";
  const isBusy = isDownloading || isInstalling;
  const pct = state.progressPercent ?? 0;

  if (state.updateAvailable) {
    const versionTag = state.latestVersion ?? appMsg.desktop.newRelease;
    return (
      <footer className="shrink-0 border-t border-hud-hairline bg-hud-surface">
        {state.error && (
          <div className="px-4 pt-2 flex items-start gap-1.5 text-[11px] text-hud-warn">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-snug">{state.error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => void installNow()}
          className="w-full relative overflow-hidden bg-hud-accent text-hud-accent-fg hover:opacity-95 disabled:opacity-60 px-4 py-2.5 text-xs font-semibold transition-opacity cursor-pointer disabled:cursor-wait flex items-center justify-between gap-2"
        >
          {isBusy && (
            <span
              className="absolute inset-y-0 left-0 bg-black/15 transition-all duration-150"
              style={{ width: `${isInstalling ? 100 : pct}%` }}
            />
          )}

          <span className="relative z-10 inline-flex items-center gap-2 min-w-0 truncate">
            <Download className={`h-3.5 w-3.5 shrink-0 ${isBusy ? "animate-pulse" : ""}`} />
            {isInstalling ? (
              <span>{appMsg.desktop.verifyingRestarting}</span>
            ) : isDownloading ? (
              <span>{appMsg.desktop.downloadingTag(versionTag, pct)}</span>
            ) : (
              <span className="truncate">{appMsg.desktop.updateRestartTag(versionTag)}</span>
            )}
          </span>

          <span className="relative z-10 shrink-0 text-[10px] font-mono tabular-nums opacity-80">
            {variantLabel}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </span>
        </button>
      </footer>
    );
  }

  return (
    <footer className="shrink-0 border-t border-hud-hairline bg-hud-surface">
      {state.error && (
        <div className="px-4 pt-2 flex items-start gap-1.5 text-[11px] text-hud-warn">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-snug">{state.error}</span>
        </div>
      )}

      <div className="px-4 py-2 flex items-center justify-between gap-2 text-[10px] font-mono text-hud-muted">
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          <CheckCircle2 className="h-3 w-3 text-hud-ok shrink-0" />
          <span className="tabular-nums text-hud-text">v{state.currentVersion}</span>
          <span>· {variantLabel} ·</span>
          <span className="truncate">
            {isChecking ? appMsg.desktop.checkingUpdates : appMsg.desktop.upToDate}
          </span>
        </span>

        <button
          type="button"
          disabled={isChecking}
          onClick={() => void checkNow()}
          className="inline-flex items-center gap-1 rounded-md hover:bg-hud-subtle hover:text-hud-text px-2 py-0.5 text-[10px] font-sans text-hud-muted cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`} />
          <span>{appMsg.desktop.checkUpdatesBtn}</span>
        </button>
      </div>
    </footer>
  );
}
