import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import {
  localizeBenchPrescription,
  localizeBenchProblemSummary,
  localizeBossWarning,
} from "../i18n/telemetry_advisor_localizer.js";

function ResistanceColumn({
  label,
  actual,
  target,
  colorClass,
  isFallback,
}: {
  label: string;
  actual: number;
  target: number;
  colorClass: string;
  isFallback: boolean;
}) {
  const deficit = target - actual;
  const ok = actual >= target;

  return (
    <div className="min-w-0 space-y-0.5">
      <div className={`text-xs font-medium ${colorClass}`}>{label}</div>
      {isFallback ? (
        <div className="text-sm font-mono tabular-nums text-hud-text font-semibold">≥{target}%</div>
      ) : (
        <div className="flex items-baseline gap-1 font-mono tabular-nums flex-wrap">
          <span className={`text-base font-semibold ${ok ? "text-hud-text" : "text-hud-danger"}`}>
            {actual}%
          </span>
          {!ok && <span className="text-xs text-hud-danger">(-{deficit})</span>}
        </div>
      )}
    </div>
  );
}

export function ResistanceCapWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, msg } = useHudI18n();
  const r = snapshot.resistances;
  const isFallback = r.source === "ACT_TARGET_FALLBACK";
  const resistanceSuggestions = (snapshot.benchCraftSuggestions ?? []).filter(
    (s) => s.id.startsWith("bench_res_") || /Resist/i.test(s.recipeId) || s.problemSummary.includes("Res"),
  );
  const bossWarning = localizeBossWarning(r.upcomingBossWarning, locale);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.resistances}
        </h2>
        <span className="text-xs font-mono text-hud-muted">
          {r.kitavaPenalty !== 0 ? `Kitava ${r.kitavaPenalty}%` : isFallback ? msg.widgets.actTargets : msg.widgets.liveGear}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <ResistanceColumn label={msg.widgets.fire} actual={r.fire.actual} target={r.fire.target} colorClass="text-hud-fire" isFallback={isFallback} />
        <ResistanceColumn label={msg.widgets.cold} actual={r.cold.actual} target={r.cold.target} colorClass="text-hud-cold" isFallback={isFallback} />
        <ResistanceColumn label={msg.widgets.light} actual={r.lightning.actual} target={r.lightning.target} colorClass="text-hud-lightning" isFallback={isFallback} />
        <ResistanceColumn label={msg.widgets.chaos} actual={r.chaos.actual} target={r.chaos.target} colorClass="text-hud-chaos" isFallback={isFallback} />
      </div>

      {!isFallback && resistanceSuggestions.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
            {msg.widgets.benchCraft}
          </div>
          {resistanceSuggestions.map((s) => {
            const prescription = localizeBenchPrescription(s.prescription, locale);
            return (
              <div key={s.id} className="flex items-baseline justify-between gap-2 text-xs" title={prescription}>
                <span className="text-hud-text/90 leading-snug">
                  <span className="text-hud-muted">{localizeBenchProblemSummary(s.problemSummary, locale)} → </span>
                  <span className="font-medium text-hud-text">
                    {prescription.replace(/\s*\([^)]+\)$/, "")}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-hud-quest">{s.costLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      {bossWarning && <p className="text-xs text-hud-warn leading-snug">{bossWarning}</p>}
    </div>
  );
}
