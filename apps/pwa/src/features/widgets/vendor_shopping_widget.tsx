import type { GemAcquisitionStep, HudSessionSnapshot } from "@exile-hud/core";
import { Check, Coins, ShoppingBag } from "lucide-react";
import { useState } from "react";

interface VendorShoppingWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleGem: (gemStepId: string) => void;
}

const ATTR_BADGE: Record<string, string> = {
  strength: "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/50",
  dexterity: "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50",
  intelligence: "bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50",
};

function isGemDone(g: GemAcquisitionStep): boolean {
  return g.verifiedByApi || g.manualCompleted || g.softAcquired;
}

export function VendorShoppingWidget({ snapshot, onToggleGem }: VendorShoppingWidgetProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const actGems = snapshot.gemSteps.filter((g) => g.act <= Math.max(snapshot.currentAct + 1, 2));
  const pendingGems = actGems.filter((g) => !isGemDone(g));
  const doneCount = actGems.length - pendingGems.length;
  const displayGems = (showCompleted ? actGems : pendingGems).slice(0, 10);
  const budget = snapshot.nextTownCurrencyBudget;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#EAB308]" />
          <h2 className="text-lg font-bold text-white">Vendor & Quest Gems</h2>
        </div>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <button
              type="button"
              data-testid="toggle-completed-gems"
              onClick={() => setShowCompleted((v) => !v)}
              className="rounded-lg border border-neutral-800 bg-black hover:border-neutral-700 px-2 py-1 text-[11px] font-mono text-neutral-300 cursor-pointer"
            >
              {showCompleted ? "Hide done" : `${doneCount} done`}
            </button>
          )}
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-neutral-300 bg-black border border-neutral-800 rounded-lg px-2.5 py-1">
            <Coins className="h-3.5 w-3.5 text-[#EAB308]" />
            <span>W:{budget.wisdom}</span>
            <span>T:{budget.transmutation}</span>
            <span>A:{budget.alteration}</span>
            {budget.chance > 0 && <span>C:{budget.chance}</span>}
            {budget.alchemy > 0 && <span>Alch:{budget.alchemy}</span>}
          </div>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {displayGems.map((g) => {
          const done = isGemDone(g);
          const badge = ATTR_BADGE[g.attribute] ?? "bg-neutral-800 text-neutral-200 border-neutral-600";
          const isQuest = g.acquisitionType === "FREE_QUEST_REWARD";

          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onToggleGem(g.id)}
              className={`w-full text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-3 cursor-pointer ${
                done ? "bg-black/40 border-neutral-800/60 opacity-60" : "bg-black border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                    g.verifiedByApi || g.manualCompleted
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : g.softAcquired
                        ? "border-dashed border-amber-400 text-amber-300"
                        : "border-neutral-700"
                  }`}
                >
                  {done && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={`px-2 py-0.5 rounded border text-xs font-bold shrink-0 ${badge}`}>
                  Lv{g.requiredLevel}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white truncate">{g.gemName}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    Act {g.act} • {g.npcName} ({g.questName})
                  </div>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 border ${
                  isQuest
                    ? "bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/40"
                    : "bg-neutral-900 text-neutral-200 border-neutral-700"
                }`}
              >
                {isQuest ? "FREE QUEST" : `${g.count}x ${g.currencyCost.toUpperCase()}`}
              </span>
            </button>
          );
        })}
        {displayGems.length === 0 && (
          <p
            className={`text-sm py-4 text-center ${
              actGems.length > 0 && pendingGems.length === 0 && !showCompleted
                ? "text-emerald-400 font-medium"
                : "text-neutral-500"
            }`}
          >
            {actGems.length > 0 && pendingGems.length === 0 && !showCompleted
              ? "All Act gems acquired!"
              : "No pending Act gems or build gems loaded."}
          </p>
        )}
      </div>
    </div>
  );
}
