import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe2GameAdapter } from "@exile-hud/game-data";
import { Check, Shield } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

/** Displays PoE 2 Trial of the Sekhemas & Trial of Chaos progression instead of PoE 1 Lab/Izaro. */
export function Poe2AscendancyTrialsPanel({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, appMsg } = useHudI18n();
  const trials = poe2GameAdapter.getLabTrials();
  const completedIds = snapshot.lab.completedTrialAreaIds;
  const doneCount = trials.filter((t) => completedIds.includes(t.areaId)).length;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.poe2.ascendancyTrialsTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-hud-ok">
          {doneCount}/{trials.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-hud-subtle/80 border border-hud-hairline p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-hud-quest">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span>{appMsg.poe2.sekhemasTitle}</span>
          </div>
          <p className="text-xs text-hud-muted leading-snug">{appMsg.poe2.sekhemasTip}</p>
        </div>

        <div className="rounded-lg bg-hud-subtle/80 border border-hud-hairline p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-hud-accent">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span>{appMsg.poe2.chaosTitle}</span>
          </div>
          <p className="text-xs text-hud-muted leading-snug">{appMsg.poe2.chaosTip}</p>
        </div>
      </div>

      <div className="space-y-1.5 overflow-y-auto pt-1 border-t border-hud-hairline flex-1 pr-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.poe2.trialMilestonesHeading}
        </div>
        {trials.map((trial) => {
          const done = completedIds.includes(trial.areaId);
          const stageLabel = poe2GameAdapter.getActDisplayLabel(trial.act, locale);
          return (
            <div
              key={trial.areaId}
              className={`rounded-lg px-2 py-1.5 text-xs flex items-start justify-between gap-2 ${
                done ? "bg-hud-ok/10 text-hud-dim line-through" : "bg-hud-subtle/50 text-hud-text/90"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-1.5">
                  {done && <Check className="h-3.5 w-3.5 text-hud-ok shrink-0" />}
                  <span className="truncate">{trial.areaName}</span>
                </div>
                <div className="text-[11px] text-hud-muted mt-0.5">{trial.hint}</div>
              </div>
              <span className="font-mono text-[11px] text-hud-muted shrink-0">{stageLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
