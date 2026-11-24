import type {
  BuildCatalogFacetsResponse,
  BuildGoalTag,
  BuildPlaystyleTag,
} from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const PLAYSTYLE_ORDER: readonly BuildPlaystyleTag[] = [
  "melee",
  "caster",
  "ranged",
  "minion",
  "totem_brand",
  "trap_mine",
  "dot_rf",
  "trigger",
];

const GOAL_ORDER: readonly BuildGoalTag[] = [
  "league_starter",
  "endgame",
  "bosser",
  "mapper",
  "ssf_friendly",
  "hc_friendly",
  "budget",
];

interface BuildFinderTagsStepProps {
  facets: BuildCatalogFacetsResponse | null;
  playstyleTags: BuildPlaystyleTag[];
  goalTags: BuildGoalTag[];
  pobOnly: boolean;
  matchingCount: number;
  onTogglePlaystyle: (tag: BuildPlaystyleTag) => void;
  onToggleGoal: (tag: BuildGoalTag) => void;
  onTogglePobOnly: (next: boolean) => void;
  onBack: () => void;
  onShowResults: () => void;
}

/** Step 2 of the Build Finder wizard: Playstyle, Goal tags, and PoB-Ready Only toggle. */
export function BuildFinderTagsStep({
  facets,
  playstyleTags,
  goalTags,
  pobOnly,
  matchingCount,
  onTogglePlaystyle,
  onToggleGoal,
  onTogglePobOnly,
  onBack,
  onShowResults,
}: BuildFinderTagsStepProps) {
  const { appMsg } = useHudI18n();
  const msg = appMsg.buildFinder;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-hud-text">{msg.tagsStepTitle}</h2>
        <p className="text-xs text-hud-muted mt-0.5">{msg.tagsStepSubtitle}</p>
      </div>

      <div className="rounded-xl bg-hud-surface border border-hud-hairline p-4 space-y-2.5">
        <div className="text-xs font-semibold text-hud-text">{msg.playstyleSectionTitle}</div>
        <div className="flex flex-wrap gap-2">
          {PLAYSTYLE_ORDER.map((tag) => {
            const active = playstyleTags.includes(tag);
            const count = facets?.playstyleTags[tag];
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTogglePlaystyle(tag)}
                className={`rounded-lg border px-3 py-1.5 text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? "bg-hud-accent text-hud-accent-fg border-hud-accent font-semibold"
                    : "bg-hud-subtle border-hud-hairline text-hud-text hover:border-hud-accent/50"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                <span>{msg.playstyleLabels[tag]}</span>
                {typeof count === "number" && (
                  <span className={`text-[10px] font-mono ${active ? "opacity-80" : "text-hud-muted"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-hud-surface border border-hud-hairline p-4 space-y-2.5">
        <div className="text-xs font-semibold text-hud-text">{msg.goalSectionTitle}</div>
        <div className="flex flex-wrap gap-2">
          {GOAL_ORDER.map((tag) => {
            const active = goalTags.includes(tag);
            const count = facets?.goalTags[tag];
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleGoal(tag)}
                className={`rounded-lg border px-3 py-1.5 text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? "bg-hud-accent text-hud-accent-fg border-hud-accent font-semibold"
                    : "bg-hud-subtle border-hud-hairline text-hud-text hover:border-hud-accent/50"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                <span>{msg.goalLabels[tag]}</span>
                {typeof count === "number" && (
                  <span className={`text-[10px] font-mono ${active ? "opacity-80" : "text-hud-muted"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-hud-surface border border-hud-hairline px-4 py-3 cursor-pointer">
        <div>
          <div className="text-xs font-semibold text-hud-text">{msg.pobReadyOnlyLabel}</div>
          <div className="text-[11px] text-hud-muted">{msg.pobReadyOnlyHint}</div>
        </div>
        <input
          type="checkbox"
          checked={pobOnly}
          onChange={(e) => onTogglePobOnly(e.target.checked)}
          className="h-4 w-4 accent-[var(--hud-accent)] cursor-pointer"
        />
      </label>

      <div className="flex items-center justify-between pt-2 border-t border-hud-hairline">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-3 py-2 text-xs text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {msg.backBtn}
        </button>
        <button
          type="button"
          onClick={onShowResults}
          className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {msg.showMatchingBuildsBtn(matchingCount)}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
