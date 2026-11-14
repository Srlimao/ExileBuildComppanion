import type { HudSessionSnapshot } from "@exile-hud/core";
import { AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

const SOCKET_COLOR_CLASS: Record<"R" | "G" | "B" | "W", string> = {
  R: "bg-[#EF4444] text-black border-[#EF4444]",
  G: "bg-[#22C55E] text-black border-[#22C55E]",
  B: "bg-[#3B82F6] text-white border-[#3B82F6]",
  W: "bg-[#FAFAFA] text-black border-[#FAFAFA]",
};

export function SocketLinksWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Target Socket Links</h2>
        </div>
        <span className="text-xs font-mono text-neutral-400">{snapshot.linkGroups.length} groups</span>
      </div>

      <div className="space-y-2.5 overflow-y-auto pr-1">
        {snapshot.linkGroups.map((group) => (
          <div key={group.title} className="rounded-lg bg-black border border-neutral-800 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white">{group.title}</span>
              {group.missingAuraWarning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Missing Aura
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {group.gems.map((gem, idx) => (
                <div key={`${gem.gemId}-${idx}`} className="inline-flex items-center gap-1.5">
                  {idx > 0 && <span className="text-neutral-600 font-bold">-</span>}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${
                      gem.unlinkedWarning
                        ? "border-red-500 bg-red-500/15 text-red-200"
                        : "border-neutral-800 bg-neutral-950 text-neutral-200"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${
                        SOCKET_COLOR_CLASS[gem.color]
                      }`}
                    >
                      {gem.color}
                    </span>
                    <span>{gem.name}</span>
                    {gem.verifiedSocketed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {!gem.verifiedSocketed && gem.reserveLocation && (
                      <span className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                        {gem.reserveLocation === "backpack" ? "BAG" : "SWAP"}
                      </span>
                    )}
                    {gem.unlinkedWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
