import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe2GameAdapter, type Poe2PermanentBonusReward } from "@exile-hud/game-data";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import type { AppMessagesBundle, HudMessagesBundle } from "../i18n/hud_i18n_provider.js";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import type { HudLocale } from "../i18n/locale_storage_and_types.js";

const REWARD_BY_ID = new Map<string, Poe2PermanentBonusReward>(
  poe2GameAdapter.getPermanentCampaignBonuses().map((b) => [b.id, b]),
);

/** Resolves the checklist widget header using Interlude 1-3 labels for PoE 2 stages 5-7. */
export function resolveChecklistHeaderTitle(
  snapshot: HudSessionSnapshot,
  locale: HudLocale,
  msg: HudMessagesBundle,
  appMsg: AppMessagesBundle,
): string {
  if (snapshot.gameId !== "poe2") return msg.widgets.actStepsTitle(snapshot.currentAct);
  return appMsg.poe2.stageStepsTitle(poe2GameAdapter.getActDisplayLabel(snapshot.currentAct, locale));
}

/** Resolves the checklist completion notice using localized PoE 2 stage labels. */
export function resolveChecklistCompleteLabel(
  snapshot: HudSessionSnapshot,
  locale: HudLocale,
  msg: HudMessagesBundle,
  appMsg: AppMessagesBundle,
): string {
  if (snapshot.gameId !== "poe2") return msg.widgets.allActStepsComplete(snapshot.currentAct);
  return appMsg.poe2.allStageStepsComplete(poe2GameAdapter.getActDisplayLabel(snapshot.currentAct, locale));
}

/** Compact inline strip showing PoE 2 permanent boss/quest campaign bonuses and Spirit unlocks. */
export function Poe2PermanentBonusBadges({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, appMsg } = useHudI18n();
  const [showAll, setShowAll] = useState(false);

  const bonuses = snapshot.permanentBonuses ?? [];
  if (bonuses.length === 0) return null;

  const currentStageBonuses = bonuses.filter((b) => b.act === snapshot.currentAct);
  const display = showAll || currentStageBonuses.length === 0 ? bonuses : currentStageBonuses;
  const doneCount = bonuses.filter((b) => b.completed).length;

  return (
    <div
      data-testid="poe2-permanent-bonuses"
      className="rounded-lg bg-hud-subtle/70 border border-hud-hairline px-2.5 py-2 space-y-1.5 shrink-0"
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold uppercase tracking-[0.1em] text-hud-muted">
          {appMsg.poe2.permanentBonusesTitle}{" "}
          <span className="font-mono text-hud-text">
            {appMsg.poe2.permanentBonusesCount(doneCount, bonuses.length)}
          </span>
        </span>
        {currentStageBonuses.length > 0 && currentStageBonuses.length < bonuses.length && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-hud-accent hover:underline font-medium cursor-pointer"
          >
            {showAll ? appMsg.poe2.stageBonusesOnly : appMsg.poe2.showAllBonuses}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
        {display.map((b) => {
          const meta = REWARD_BY_ID.get(b.id);
          const tooltip = meta
            ? `${b.bossOrQuestName}: ${locale === "pt-BR" ? meta.rewardLabelPtBr : meta.rewardLabelEn}`
            : `${b.bossOrQuestName}: ${b.rewardLabel}`;
          return (
            <span
              key={b.id}
              title={tooltip}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border ${
                b.completed
                  ? "border-hud-ok/40 bg-hud-ok/10 text-hud-ok line-through opacity-80"
                  : "border-hud-hairline bg-hud-bg/60 text-hud-text/90"
              }`}
            >
              {b.completed ? <Check className="h-3 w-3 shrink-0" /> : <Sparkles className="h-3 w-3 text-hud-quest shrink-0" />}
              <span className="font-medium truncate max-w-[130px]">{b.bossOrQuestName}</span>
              <span className="font-mono text-[10px] text-hud-muted">{b.valueSummary}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
