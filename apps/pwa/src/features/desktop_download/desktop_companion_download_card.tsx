import { Download, ExternalLink, Monitor } from "lucide-react";
import { useLatestDesktopReleaseInfo } from "./github_latest_release_client.js";

/** Windows PC host download card wired to the latest GitHub release assets. */
export function DesktopCompanionDownloadCard() {
  const release = useLatestDesktopReleaseInfo();

  return (
    <div className="rounded-lg bg-hud-subtle border border-hud-hairline p-3.5 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-4 w-4 text-hud-ok shrink-0" />
          <span className="text-sm font-semibold text-hud-text truncate">
            Exile Relay PC Host (Windows x64)
          </span>
        </div>
        <span className="shrink-0 text-xs font-mono tabular-nums text-hud-ok">
          {release.tagName ?? "Latest"}
          {release.portableSizeLabel ? ` · ${release.portableSizeLabel}` : ""}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-hud-muted">
        Lightweight System Tray app — auto-detects Path of Exile <code className="text-hud-text">Client.txt</code>, decodes PoB offline, and drives both your <kbd className="font-mono text-hud-text">F7</kbd> PC overlay and phone HUD.
      </p>

      <a
        href={release.portableUrl}
        className="w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-semibold py-2.5 px-3.5 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Download ExileRelay.exe (Portable)</span>
      </a>

      <div className="flex items-center justify-between text-xs text-hud-muted pt-0.5">
        <a href={release.setupUrl} className="hover:text-hud-text underline underline-offset-4">
          Windows Installer (Setup.exe)
        </a>
        <a
          href={release.releasePageUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-hud-text inline-flex items-center gap-1"
        >
          <span>Release Notes</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
