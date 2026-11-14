import { Download, ExternalLink, Monitor } from "lucide-react";
import { useLatestDesktopReleaseInfo } from "./github_latest_release_client.js";

export function DesktopCompanionDownloadCard() {
  const release = useLatestDesktopReleaseInfo();

  return (
    <div className="space-y-2.5">
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
        Ready-to-run standalone app — auto-detects Path of Exile Client.txt and pairs instantly with this screen.
      </p>

      <a
        href={release.portableUrl}
        className="w-full rounded-md bg-hud-ok text-white hover:opacity-90 font-semibold py-2 px-3.5 text-sm transition-opacity flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Download Exile Relay (.exe — Ready to Run)</span>
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
