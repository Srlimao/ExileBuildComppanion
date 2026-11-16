import { useHudI18n } from "@exile-hud/hud-ui";
import { Download, ExternalLink, Monitor } from "lucide-react";
import { useLatestDesktopReleaseInfo } from "./github_latest_release_client.js";

/** Windows PC host download card wired to the latest GitHub release assets. */
export function DesktopCompanionDownloadCard() {
  const { appMsg } = useHudI18n();
  const release = useLatestDesktopReleaseInfo();

  return (
    <div className="rounded-lg bg-hud-subtle border border-hud-hairline p-3.5 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-4 w-4 text-hud-ok shrink-0" />
          <span className="text-sm font-semibold text-hud-text truncate">
            {appMsg.pwa.pcHostCardTitle}
          </span>
        </div>
        <span className="shrink-0 text-xs font-mono tabular-nums text-hud-ok">
          {release.tagName ?? appMsg.pwa.latestTag}
          {release.portableSizeLabel ? ` · ${release.portableSizeLabel}` : ""}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-hud-muted">
        {appMsg.pwa.pcHostCardDescPrefix} <code className="text-hud-text">Client.txt</code>
        {appMsg.pwa.pcHostCardDescMid} <kbd className="font-mono text-hud-text">F7</kbd>{" "}
        {appMsg.pwa.pcHostCardDescSuffix}
      </p>

      <a
        href={release.portableUrl}
        className="w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-semibold py-2.5 px-3.5 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{appMsg.pwa.downloadPortable}</span>
      </a>

      <div className="flex items-center justify-between text-xs text-hud-muted pt-0.5">
        <a href={release.setupUrl} className="hover:text-hud-text underline underline-offset-4">
          {appMsg.pwa.windowsInstaller}
        </a>
        <a
          href={release.releasePageUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-hud-text inline-flex items-center gap-1"
        >
          <span>{appMsg.pwa.releaseNotes}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
