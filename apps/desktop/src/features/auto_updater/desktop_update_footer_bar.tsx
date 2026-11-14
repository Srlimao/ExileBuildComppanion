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
      <footer className="mt-auto pt-2 space-y-1.5">
        {state.error && (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-snug">{state.error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => void installNow()}
          className="w-full relative overflow-hidden rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-900/70 border border-blue-400/30 text-white px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-wait flex items-center justify-between gap-2"
        >
          {isBusy && (
            <span
              className="absolute inset-y-0 left-0 bg-blue-400/25 transition-all duration-150"
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

          <span className="relative z-10 shrink-0 rounded-md bg-black/25 border border-white/15 px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-blue-100">
            {variantLabel}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </span>
        </button>
      </footer>
    );
  }

  return (
    <footer className="mt-auto pt-2 border-t border-neutral-800/80 space-y-1.5">
      {state.error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-snug">{state.error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80 shrink-0" />
          <span className="font-mono tabular-nums text-neutral-300">v{state.currentVersion}</span>
          <span>· {variantLabel} ·</span>
          <span>{isChecking ? "Checking…" : "Up to date"}</span>
        </span>

        <button
          type="button"
          disabled={isChecking}
          onClick={() => void checkNow()}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 hover:text-neutral-200 px-2 py-1 text-[11px] text-neutral-300 cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`} />
          <span>Check</span>
        </button>
      </div>
    </footer>
  );
}
