import type { TargetItemSetSummary, TargetItemSlotSummary } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

const RARITY_COLOR_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "text-hud-warn",
  rare: "text-hud-quest",
  magic: "text-hud-cold",
  normal: "text-hud-text",
  unknown: "text-hud-text",
};

/** Compact text-list fallback view for PoB / .build ItemSets inside GearHygieneWidget. */
export function GearHygieneListView({ activeSet }: { activeSet: TargetItemSetSummary | null }) {
  const { msg } = useHudI18n();

  return (
    <div className="divide-y divide-hud-hairline overflow-y-auto pr-0.5 flex-1 min-h-0">
      {!activeSet || activeSet.slots.length === 0 ? (
        <div className="text-xs text-hud-muted py-2">{msg.widgets.noItemsInSet}</div>
      ) : (
        activeSet.slots.map((slot) => (
          <div key={`${slot.slotName}:${slot.itemId}`} className="py-2 first:pt-0 space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="uppercase tracking-wider font-semibold text-hud-muted">{slot.slotName}</span>
              <div className="flex items-center gap-2 font-mono">
                {slot.verifiedEquipped && (
                  <span className="text-hud-ok font-sans font-medium">{msg.widgets.equipped}</span>
                )}
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
  );
}
