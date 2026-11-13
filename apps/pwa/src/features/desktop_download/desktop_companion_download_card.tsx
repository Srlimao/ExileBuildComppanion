import { Download, ExternalLink, Monitor } from "lucide-react";
import { useLatestDesktopReleaseInfo } from "./github_latest_release_client.js";

export function DesktopCompanionDownloadCard() {
  const release = useLatestDesktopReleaseInfo();

  return (
    <div className="rounded-xl border border-neutral-800 bg-black/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-white truncate">PC Companion Host (Windows x64)</span>
        </div>
        <span className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-mono tabular-nums text-emerald-400">
          {release.tagName ?? "Latest"}
          {release.portableSizeLabel ? ` • ${release.portableSizeLabel}` : ""}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-neutral-400">
        Ready-to-run standalone app — auto-detects Path of Exile Client.txt and pairs instantly with this screen.
      </p>

      <a
        href={release.portableUrl}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-2.5 px-3.5 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Download Companion (.exe — Ready to Run)</span>
      </a>

      <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
        <a href={release.setupUrl} className="hover:text-neutral-200 underline underline-offset-4">
          Windows Installer (Setup.exe)
        </a>
        <a
          href={release.releasePageUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-neutral-200 inline-flex items-center gap-1"
        >
          <span>Release Notes</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
