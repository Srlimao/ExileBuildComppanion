import type { HudSessionSnapshot } from "@exile-hud/core";
import { AlertCircle, Hammer, Shield } from "lucide-react";

function ResistanceRow({
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
    <div className="flex items-center justify-between gap-3 rounded-lg bg-black border border-neutral-800 px-3 py-2">
      <span className={`text-sm font-bold ${colorClass}`}>{label}</span>
      {isFallback ? (
        <span className="text-sm font-mono tabular-nums text-neutral-300">Target ≥ {target}%</span>
      ) : (
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className={`text-base font-bold ${ok ? "text-emerald-400" : "text-red-400"}`}>{actual}%</span>
          <span className="text-xs text-neutral-500">/ {target}%</span>
          {!ok ? (
            <span className="text-xs text-red-400">(-{deficit}%)</span>
          ) : actual > target ? (
            <span className="text-xs text-emerald-400/80">(+{actual - target}%)</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ResistanceCapWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const r = snapshot.resistances;
  const isFallback = r.source === "ACT_TARGET_FALLBACK";
  const resistanceSuggestions = (snapshot.benchCraftSuggestions ?? []).filter(
    (s) => s.id.startsWith("bench_res_") || /Resist/i.test(s.recipeId) || s.problemSummary.includes("Res"),
  );

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Resistances</h2>
        </div>
        <span className="text-xs font-mono text-neutral-400">
          {r.kitavaPenalty !== 0 ? `Kitava ${r.kitavaPenalty}%` : isFallback ? "Act Targets" : "Live Gear"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResistanceRow label="Fire" actual={r.fire.actual} target={r.fire.target} colorClass="text-[#EF4444]" isFallback={isFallback} />
        <ResistanceRow label="Cold" actual={r.cold.actual} target={r.cold.target} colorClass="text-[#3B82F6]" isFallback={isFallback} />
        <ResistanceRow label="Light" actual={r.lightning.actual} target={r.lightning.target} colorClass="text-[#EAB308]" isFallback={isFallback} />
        <ResistanceRow label="Chaos" actual={r.chaos.actual} target={r.chaos.target} colorClass="text-fuchsia-400" isFallback={isFallback} />
      </div>

      {!isFallback && resistanceSuggestions.length > 0 && (
        <div className="rounded-lg border border-indigo-500/30 bg-black px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            <Hammer className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span>Bench Craft Advice</span>
          </div>
          <div className="space-y-1">
            {resistanceSuggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs" title={s.prescription}>
                <span className="text-neutral-200 leading-snug">
                  <span className="text-neutral-400">{s.problemSummary} → </span>
                  <span className="font-medium text-white">
                    {s.prescription.replace(/\s*\([^)]+\)$/, "")}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                  {s.costLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.upcomingBossWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{r.upcomingBossWarning}</span>
        </div>
      )}
    </div>
  );
}
