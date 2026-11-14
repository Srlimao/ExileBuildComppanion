import type { GemAcquisitionStep, HudSessionSnapshot } from "@exile-hud/core";
import { useState } from "react";

interface VendorShoppingWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleGem: (gemStepId: string) => void;
}

const ATTR_HEX: Record<string, string> = {
  strength: "#ef4444",
  dexterity: "#22c55e",
  intelligence: "#3b82f6",
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
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          Town Pickup · Gems
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {doneCount > 0 && (
            <button
              type="button"
              data-testid="toggle-completed-gems"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-hud-muted hover:text-hud-text transition-colors cursor-pointer"
            >
              {showCompleted ? "Hide done" : `${doneCount} done`}
            </button>
          )}
          <span className="font-mono tabular-nums text-hud-muted">
            W:{budget.wisdom} T:{budget.transmutation} A:{budget.alteration}
            {budget.chance > 0 ? ` C:${budget.chance}` : ""}
            {budget.alchemy > 0 ? ` Alch:${budget.alchemy}` : ""}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 overflow-y-auto pr-1">
        {displayGems.map((g) => {
          const done = isGemDone(g);
          const dotColor = ATTR_HEX[g.attribute] ?? "var(--hud-muted)";
          const isQuest = g.acquisitionType === "FREE_QUEST_REWARD";

          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onToggleGem(g.id)}
              className={`w-full text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-hud-subtle flex items-baseline justify-between gap-3 cursor-pointer ${
                done ? "opacity-45 line-through" : ""
              }`}
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0 self-center"
                  style={{ backgroundColor: dotColor }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-hud-text truncate">
                    {g.gemName}
                    <span className="text-xs font-mono text-hud-muted ml-1.5">Lv{g.requiredLevel}</span>
                  </div>
                  <div className="text-xs text-hud-muted truncate">
                    Act {g.act} · {g.npcName} ({g.questName})
                    {g.acquiredLocation === "backpack" && " · Bag"}
                    {g.acquiredLocation === "weapon_swap" && " · Swap"}
                  </div>
                </div>
              </div>

              <span
                className={`text-xs font-mono shrink-0 ${
                  isQuest ? "text-hud-quest font-semibold" : "text-hud-muted"
                }`}
              >
                {isQuest ? "free quest" : `${g.count}x ${g.currencyCost.toLowerCase()}`}
              </span>
            </button>
          );
        })}

        {displayGems.length === 0 && (
          <p
            className={`text-sm py-3 ${
              actGems.length > 0 && pendingGems.length === 0 && !showCompleted
                ? "text-hud-ok font-medium"
                : "text-hud-muted"
            }`}
          >
            {actGems.length > 0 && pendingGems.length === 0 && !showCompleted
              ? "All Act gems acquired"
              : "No pending Act gems or build gems loaded."}
          </p>
        )}
      </div>
    </div>
  );
}
