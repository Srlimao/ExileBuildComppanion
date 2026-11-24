import type { BuildCatalogEntry } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { ExternalLink, Sparkles } from "lucide-react";

interface BuildFinderResultCardProps {
  entry: BuildCatalogEntry;
  latestPatch: string;
  importing: boolean;
  onImportBuild: (entry: BuildCatalogEntry) => void;
  onOpenGuide: (url: string) => void;
}

/** Compact OLED card rendering a single build catalog entry with 1-click PoB or guide actions. */
export function BuildFinderResultCard({
  entry,
  latestPatch,
  importing,
  onImportBuild,
  onOpenGuide,
}: BuildFinderResultCardProps) {
  const { appMsg } = useHudI18n();
  const msg = appMsg.buildFinder;
  const isStalePatch =
    Boolean(latestPatch) && Boolean(entry.patchVersion) && entry.patchVersion !== latestPatch;

  return (
    <article className="rounded-xl bg-hud-surface border border-hud-hairline hover:border-hud-accent/50 p-3 flex flex-col justify-between gap-2.5 transition-colors">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-semibold text-hud-text leading-snug line-clamp-2">
            {entry.title}
          </h3>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
              entry.hasPobImport
                ? "bg-hud-accent/15 border-hud-accent/40 text-hud-accent"
                : "bg-hud-subtle border-hud-hairline text-hud-muted"
            }`}
          >
            {entry.hasPobImport ? msg.pobReadyBadge : msg.guideOnlyBadge}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-md bg-hud-subtle px-1.5 py-0.5 text-hud-text font-medium">
            {entry.ascendancy || entry.baseClass}
          </span>
          {entry.patchVersion && (
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                isStalePatch ? "bg-hud-warn/15 text-hud-warn" : "bg-hud-subtle text-hud-muted"
              }`}
            >
              {entry.patchVersion}
            </span>
          )}
          <span className="text-hud-muted">{msg.sourceLabels[entry.source]}</span>
          {entry.author && <span className="text-hud-muted truncate">· {entry.author}</span>}
        </div>

        {entry.excerpt && (
          <p className="text-[11px] text-hud-muted line-clamp-2">{entry.excerpt}</p>
        )}

        {(entry.playstyleTags.length > 0 || entry.goalTags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {entry.playstyleTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-hud-subtle/80 px-1.5 py-0.5 text-[10px] text-hud-muted"
              >
                {msg.playstyleLabels[tag]}
              </span>
            ))}
            {entry.goalTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-hud-subtle/80 px-1.5 py-0.5 text-[10px] text-hud-muted"
              >
                {msg.goalLabels[tag]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline/70">
        <button
          type="button"
          onClick={() => onOpenGuide(entry.guideUrl)}
          title={msg.openGuideBtn}
          className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/60 px-2.5 py-1.5 text-[11px] text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
        >
          <ExternalLink className="h-3 w-3" />
          {msg.openGuideBtn}
        </button>

        {entry.hasPobImport && (
          <button
            type="button"
            disabled={importing}
            onClick={() => onImportBuild(entry)}
            className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-50 px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            {importing ? msg.importingBuildBtn : msg.importBuildBtn}
          </button>
        )}
      </div>
    </article>
  );
}
