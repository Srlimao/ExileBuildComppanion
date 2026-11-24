import type { GemAcquisitionStep, HudSessionSnapshot } from "@exile-hud/core";
import { poe2GameAdapter, type Poe2GemKind } from "@exile-hud/game-data";
import { useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

const ATTR_HEX: Record<string, string> = {
  strength: "#ef4444",
  dexterity: "#22c55e",
  intelligence: "#3b82f6",
};

function isGemDone(g: GemAcquisitionStep): boolean {
  return g.verifiedByApi || g.manualCompleted || g.softAcquired;
}

function resolveGemKind(g: GemAcquisitionStep): Poe2GemKind {
  if (g.gemKind) return g.gemKind;
  if ((g.spiritCost ?? 0) > 0) return "spirit";
  return g.isSupport ? "support" : "skill";
}

/** Displays tier-ordered PoE 2 Uncut Skill/Spirit/Support gems and live Spirit budget. */
export function Poe2UncutGemsPanel({
  snapshot,
  onToggleGem,
}: {
  snapshot: HudSessionSnapshot;
  onToggleGem: (gemStepId: string) => void;
}) {
  const { locale, msg, appMsg } = useHudI18n();
  const [showCompleted, setShowCompleted] = useState(false);

  const stageGems = snapshot.gemSteps.filter((g) => g.act <= Math.max(snapshot.currentAct + 1, 2));
  const pendingGems = stageGems.filter((g) => !isGemDone(g));
  const doneCount = stageGems.length - pendingGems.length;
  const displayGems = (showCompleted ? stageGems : pendingGems).slice(0, 12);

  const spirit = snapshot.poe2SpiritSummary;
  const spiritReq = spirit?.requiredSpirit ?? 0;
  const spiritUnlocked = spirit?.unlockedSpirit ?? 0;
  const spiritShortfall = Math.max(0, spiritReq - spiritUnlocked);
  const spiritPct = spiritReq > 0 ? Math.min(100, Math.round((spiritUnlocked / spiritReq) * 100)) : 100;

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.poe2.uncutGemsTitle}
        </h2>
        {doneCount > 0 && (
          <button
            type="button"
            aria-pressed={showCompleted}
            data-testid="toggle-completed-gems"
            onClick={() => setShowCompleted((v) => !v)}
            className="px-2 py-1 rounded-lg text-xs text-hud-muted hover:text-hud-text hover:bg-hud-subtle transition-colors cursor-pointer"
          >
            {showCompleted ? msg.widgets.hideDone : msg.widgets.doneCount(doneCount)}
          </button>
        )}
      </div>

      {spirit && (
        <div
          data-testid="poe2-spirit-budget"
          className="rounded-lg bg-hud-subtle/80 border border-hud-hairline px-2.5 py-2 space-y-1.5"
        >
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-hud-text font-mono tabular-nums">
              {appMsg.poe2.spiritBudgetLabel(spiritUnlocked, spiritReq, spirit.campaignGuaranteedSpirit)}
            </span>
            {spiritShortfall > 0 && (
              <span className="text-[11px] font-mono text-hud-warn shrink-0">-{spiritShortfall}</span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-hud-bg overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${spiritShortfall > 0 ? "bg-hud-warn" : "bg-hud-ok"}`}
              style={{ width: `${spiritPct}%` }}
            />
          </div>
          <p className={`text-[11px] leading-snug ${spiritShortfall > 0 ? "text-hud-warn" : "text-hud-ok"}`}>
            {spiritShortfall > 0 ? appMsg.poe2.spiritDeficitHint(spiritShortfall) : appMsg.poe2.spiritReadyHint}
          </p>
        </div>
      )}

      <div className="space-y-0.5 overflow-y-auto pr-1">
        {displayGems.map((g) => {
          const done = isGemDone(g);
          const dotColor = ATTR_HEX[g.attribute] ?? "var(--hud-muted)";
          const kind = resolveGemKind(g);
          const tier = g.uncutTier ?? 1;
          const stageLabel = poe2GameAdapter.getActDisplayLabel(g.act, locale);

          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={done}
              onClick={() => onToggleGem(g.id)}
              className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-hud-subtle flex items-baseline justify-between gap-2.5 cursor-pointer ${
                done ? "opacity-45 line-through" : ""
              }`}
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0 self-center" style={{ backgroundColor: dotColor }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-hud-text truncate">
                    {g.gemName}
                    <span className="text-xs font-mono text-hud-muted ml-1.5">Lv{g.requiredLevel}</span>
                  </div>
                  <div className="text-xs text-hud-muted truncate">
                    {stageLabel} · {appMsg.poe2.gemKindLabels[kind]}
                    {g.spiritCost ? ` · ${appMsg.poe2.spiritCostBadge(g.spiritCost)}` : ""}
                  </div>
                </div>
              </div>

              <span className="text-xs font-mono shrink-0 text-hud-accent">
                {appMsg.poe2.uncutTierBadge(tier)}
              </span>
            </button>
          );
        })}

        {displayGems.length === 0 && (
          <p
            className={`text-sm py-3 ${
              stageGems.length > 0 && pendingGems.length === 0 && !showCompleted
                ? "text-hud-ok font-medium"
                : "text-hud-muted"
            }`}
          >
            {stageGems.length > 0 && pendingGems.length === 0 && !showCompleted
              ? appMsg.poe2.noPendingUncutGems
              : msg.widgets.noPendingGems}
          </p>
        )}
      </div>
    </div>
  );
}
