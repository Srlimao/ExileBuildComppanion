import type { HudSessionSnapshot, TargetItemSetSummary, TargetItemSlotSummary } from "@exile-hud/core";
import { AlertTriangle, CheckCircle2, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

const RARITY_COLOR_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "text-amber-400",
  rare: "text-yellow-300",
  magic: "text-indigo-300",
  normal: "text-neutral-200",
  unknown: "text-neutral-200",
};

function selectDefaultItemSet(itemSets: TargetItemSetSummary[], characterLevel: number): TargetItemSetSummary | null {
  if (itemSets.length === 0) return null;
  let active = itemSets[0]!;
  for (const set of itemSets) {
    if (set.minLevel <= characterLevel) active = set;
  }
  return active;
}

/** Displays gear/flask hygiene alerts alongside imported PoB Item Sets and target slots. */
export function GearHygieneWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const issues = snapshot.gearHygiene;
  const itemSets = snapshot.itemSets ?? [];
  const defaultSet = selectDefaultItemSet(itemSets, snapshot.characterLevel);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(defaultSet?.id ?? null);

  useEffect(() => {
    const stillValid = itemSets.some((s) => s.id === selectedSetId);
    if (!stillValid) {
      setSelectedSetId(defaultSet?.id ?? null);
    }
  }, [defaultSet?.id, itemSets, selectedSetId]);

  const activeSet = itemSets.find((s) => s.id === selectedSetId) ?? defaultSet;

  return (
    <div className="flex flex-col h-full gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Gear & Flasks</h2>
        </div>
        <span className="text-xs font-mono text-neutral-400">
          {activeSet ? `${activeSet.slots.length} slots · ` : ""}
          {issues.length} alerts
        </span>
      </div>

      <div className="space-y-1.5 shrink-0">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`rounded-lg border px-2.5 py-2 text-xs flex items-start gap-2 ${
              issue.severity === "warn"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-neutral-800 bg-black text-neutral-200"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{issue.message}</span>
          </div>
        ))}

        {issues.length === 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Boots, flasks, and weapon tiers look good.</span>
          </div>
        )}
      </div>

      {itemSets.length > 0 && activeSet && (
        <div className="flex flex-col gap-2 min-h-0 flex-1 border-t border-neutral-800 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
            {itemSets.map((set) => {
              const isSelected = set.id === activeSet.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setSelectedSetId(set.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-black border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {set.title} · Lv {set.minLevel}+
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1">
            {activeSet.slots.length === 0 ? (
              <div className="text-xs text-neutral-500 py-2">No item slots populated in this set.</div>
            ) : (
              activeSet.slots.map((slot) => (
                <div
                  key={`${slot.slotName}:${slot.itemId}`}
                  className="rounded-lg bg-black border border-neutral-800 px-2.5 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="uppercase tracking-wide font-semibold text-neutral-400">{slot.slotName}</span>
                    <div className="flex items-center gap-1.5">
                      {slot.verifiedEquipped && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 font-medium">
                          <ShieldCheck className="h-3 w-3" />
                          Equipped
                        </span>
                      )}
                      {slot.sockets && (
                        <span className="font-mono rounded bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-neutral-300">
                          {slot.sockets}
                        </span>
                      )}
                      <span className="font-mono text-neutral-500">Lv {slot.levelReq}</span>
                    </div>
                  </div>

                  <div className={`text-xs font-semibold leading-tight ${RARITY_COLOR_CLASS[slot.rarity]}`}>
                    {slot.itemName}
                    {slot.baseType !== slot.itemName && (
                      <span className="text-[11px] font-normal text-neutral-400"> · {slot.baseType}</span>
                    )}
                  </div>

                  {slot.mods.length > 0 && (
                    <ul className="space-y-0.5 pt-0.5">
                      {slot.mods.slice(0, 4).map((mod, idx) => (
                        <li key={idx} className="text-[11px] text-neutral-300 leading-snug">
                          {mod}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
