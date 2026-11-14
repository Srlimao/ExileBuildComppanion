import type { HudSessionSnapshot, TargetItemSetSummary, TargetItemSlotSummary } from "@exile-hud/core";
import { useEffect, useState } from "react";

const RARITY_COLOR_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "text-hud-warn",
  rare: "text-hud-quest",
  magic: "text-hud-cold",
  normal: "text-hud-text",
  unknown: "text-hud-text",
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
  const craftSuggestions = (snapshot.benchCraftSuggestions ?? []).filter(
    (s) => !(s.id === "bench_boots_ms" && issues.some((i) => i.id === "boots_0ms")),
  );
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
      <div className="flex items-baseline justify-between gap-2 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Gear &amp; Flasks</h2>
        <span className="text-xs font-mono text-hud-muted tabular-nums">
          {activeSet ? `${activeSet.slots.length} slots · ` : ""}
          {issues.length + craftSuggestions.length} alerts
        </span>
      </div>

      <div className="space-y-1 shrink-0">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`text-xs flex items-baseline gap-2 ${
              issue.severity === "warn" ? "text-hud-warn" : "text-hud-text/85"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0 self-center" />
            <span>{issue.message}</span>
          </div>
        ))}

        {craftSuggestions.map((s) => (
          <div key={s.id} className="text-xs flex items-baseline justify-between gap-2">
            <span className="text-hud-text/90">
              <span className="text-hud-accent font-medium">Bench:</span> {s.problemSummary} → {s.prescription}
            </span>
            <span className="shrink-0 font-mono text-hud-quest">{s.costLabel}</span>
          </div>
        ))}

        {issues.length === 0 && craftSuggestions.length === 0 && (
          <p className="text-xs text-hud-ok">Boots, flasks, and weapon tiers look good.</p>
        )}
      </div>

      {itemSets.length > 0 && activeSet && (
        <div className="flex flex-col gap-2 min-h-0 flex-1 border-t border-hud-hairline pt-2.5">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 shrink-0">
            {itemSets.map((set) => {
              const isSelected = set.id === activeSet.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setSelectedSetId(set.id)}
                  className={`pb-0.5 text-xs whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-hud-accent text-hud-text font-semibold"
                      : "border-transparent text-hud-muted hover:text-hud-text"
                  }`}
                >
                  {set.title} · Lv {set.minLevel}+
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-hud-hairline overflow-y-auto pr-0.5 flex-1">
            {activeSet.slots.length === 0 ? (
              <div className="text-xs text-hud-muted py-2">No item slots populated in this set.</div>
            ) : (
              activeSet.slots.map((slot) => (
                <div key={`${slot.slotName}:${slot.itemId}`} className="py-2 first:pt-0 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="uppercase tracking-wider font-semibold text-hud-muted">{slot.slotName}</span>
                    <div className="flex items-center gap-2 font-mono">
                      {slot.verifiedEquipped && <span className="text-hud-ok font-sans font-medium">Equipped</span>}
                      {slot.sockets && <span className="text-hud-muted">{slot.sockets}</span>}
                      <span className="text-hud-dim">Lv {slot.levelReq}</span>
                    </div>
                  </div>

                  <div className={`text-xs font-semibold leading-tight ${RARITY_COLOR_CLASS[slot.rarity]}`}>
                    {slot.itemName}
                    {slot.baseType !== slot.itemName && (
                      <span className="text-[11px] font-normal text-hud-muted"> · {slot.baseType}</span>
                    )}
                  </div>

                  {slot.mods.length > 0 && (
                    <ul className="space-y-0.5 pt-0.5">
                      {slot.mods.slice(0, 4).map((mod, idx) => (
                        <li key={idx} className="text-[11px] text-hud-muted leading-snug">
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
