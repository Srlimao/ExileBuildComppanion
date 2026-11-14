import { AlertTriangle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { useDesktopAutoUpdater } from "./use_desktop_auto_updater.js";

function formatMegabytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DesktopUpdateFooterBar() {
  const { state, checkNow, installNow } = useDesktopAutoUpdater();
  const variantLabel = state.installVariant === "nsisSetup" ? "Installer" : "Standalone";
  const sizeLabel = formatMegabytes(state.assetSizeBytes);
  const isChecking = state.phase === "checking";
  const isDownloading = state.phase === "downloading";
  const isInstalling = state.phase === "installing";
  const isBusy = isDownloading || isInstalling;
  const pct = state.progressPercent ?? 0;

  if (state.updateAvailable) {
    const versionTag = state.latestVersion ?? "New Release";
    return (
      <footer className="mt-auto pt-3 border-t border-hud-hairline space-y-2">
        {state.error && (
          <div className="flex items-start gap-1.5 border-l-2 border-hud-warn pl-2.5 py-0.5 text-[11px] text-hud-warn">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-snug">{state.error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => void installNow()}
          className="w-full relative overflow-hidden rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-60 px-3.5 py-2.5 text-xs font-semibold transition-opacity cursor-pointer disabled:cursor-wait flex items-center justify-between gap-2"
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
              <span>Verifying SHA-256 &amp; Restarting…</span>
            ) : isDownloading ? (
              <span>
                Downloading {versionTag} (<span className="font-mono tabular-nums">{pct}%</span>)…
              </span>
            ) : (
              <span className="truncate">Update to {versionTag} &amp; Restart</span>
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
    <footer className="mt-auto pt-2.5 border-t border-hud-hairline space-y-1.5">
      {state.error && (
        <div className="flex items-start gap-1.5 border-l-2 border-hud-warn pl-2.5 py-0.5 text-[11px] text-hud-warn">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-snug">{state.error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-hud-muted">
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          <CheckCircle2 className="h-3.5 w-3.5 text-hud-ok shrink-0" />
          <span className="font-mono tabular-nums text-hud-text">v{state.currentVersion}</span>
          <span>· {variantLabel} ·</span>
          <span>{isChecking ? "Checking…" : "Up to date"}</span>
        </span>

        <button
          type="button"
          disabled={isChecking}
          onClick={() => void checkNow()}
          className="inline-flex items-center gap-1 rounded-md hover:bg-hud-subtle hover:text-hud-text px-2 py-1 text-[11px] text-hud-muted cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`} />
          <span>Check</span>
        </button>
      </div>
    </footer>
  );
}
