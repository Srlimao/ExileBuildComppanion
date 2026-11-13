import type { HudSessionSnapshot } from "@exile-hud/core";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";

export function GearHygieneWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const issues = snapshot.gearHygiene;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Gear & Flask Hygiene</h2>
        </div>
        <span className="text-xs font-mono text-neutral-400">{issues.length} alerts</span>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2.5 ${
              issue.severity === "warn"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-neutral-800 bg-black text-neutral-200"
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{issue.message}</span>
          </div>
        ))}

        {issues.length === 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Boots, flasks, and weapon tiers look good.</span>
          </div>
        )}
      </div>
    </div>
  );
}
