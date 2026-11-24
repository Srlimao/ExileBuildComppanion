import type { TargetItemSlotSummary } from "@exile-hud/core";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import {
  localizeBenchPrescription,
  localizeGearHygieneMessage,
} from "../i18n/telemetry_advisor_localizer.js";
import type { SlotAnchoredAlerts } from "./gear_slot_normalizer.js";
import { ItemSocketPips } from "./equipment_slot_silhouettes.js";

const RARITY_HEADER_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "text-hud-warn",
  rare: "text-hud-quest",
  magic: "text-hud-cold",
  normal: "text-hud-text",
  unknown: "text-hud-text",
};

export interface TooltipAnchorBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  containerWidth: number;
  containerHeight: number;
}

interface GearItemFloatingTooltipProps {
  slotLabel: string;
  slot: TargetItemSlotSummary | null;
  alerts?: SlotAnchoredAlerts;
  isPoe2: boolean;
  anchor: TooltipAnchorBox | null;
  onClose: () => void;
}

/** Authentic PoE-styled floating item tooltip clamped within the paper-doll container bounds. */
export function GearItemFloatingTooltip({
  slotLabel,
  slot,
  alerts,
  isPoe2,
  anchor,
  onClose,
}: GearItemFloatingTooltipProps) {
  const { locale, msg, appMsg } = useHudI18n();
  const t = msg.widgets.gearPaperDoll;
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = tooltipRef.current;
    if (!anchor || !el) return;
    const tipW = el.offsetWidth || 260;
    const tipH = el.offsetHeight || 180;
    const pad = 6;
    const fitsRight = anchor.right + 8 + tipW <= anchor.containerWidth - pad;
    const fitsLeft = anchor.left - 8 - tipW >= pad;
    const rawLeft = fitsRight
      ? anchor.right + 8
      : fitsLeft
        ? anchor.left - 8 - tipW
        : Math.max(pad, Math.min(anchor.left, anchor.containerWidth - tipW - pad));
    const rawTop = Math.max(pad, Math.min(anchor.top, anchor.containerHeight - tipH - pad));
    setPos({ left: Math.round(rawLeft), top: Math.round(rawTop) });
  }, [anchor, slot?.itemId, alerts?.totalCount]);

  const hasAlerts = Boolean(alerts && alerts.totalCount > 0);
  const positionStyle = pos
    ? { left: `${pos.left}px`, top: `${pos.top}px` }
    : { right: "6px", top: "6px" };

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label={slot?.itemName ?? slotLabel}
      style={positionStyle}
      className="absolute z-30 w-[min(272px,calc(100%-12px))] rounded-xl border border-hud-accent/70 bg-hud-bg/95 backdrop-blur-sm shadow-2xl p-2.5 space-y-2 text-xs"
    >
      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-hud-hairline">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-hud-dim">
            <span>{slot?.slotName ?? slotLabel}</span>
            {slot && (
              <>
                <span>·</span>
                <span className="font-mono">Lv {slot.levelReq}</span>
              </>
            )}
          </div>
          <div
            className={`text-xs font-semibold leading-snug truncate ${
              slot ? RARITY_HEADER_CLASS[slot.rarity] : "text-hud-muted"
            }`}
          >
            {slot ? slot.itemName : slotLabel}
          </div>
          {slot && slot.baseType && slot.baseType !== slot.itemName && (
            <div className="text-[11px] text-hud-muted truncate">{slot.baseType}</div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {slot && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                slot.verifiedEquipped
                  ? "text-hud-ok border-hud-ok/40"
                  : "text-hud-muted border-hud-hairline"
              }`}
            >
              {slot.verifiedEquipped ? msg.widgets.equipped : t.targetBadge}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeTooltip}
            className="p-0.5 rounded border border-hud-hairline text-hud-muted hover:text-hud-text cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!slot && !hasAlerts && <p className="text-[11px] text-hud-dim">{t.noTargetItem}</p>}

      {slot?.sockets && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-hud-dim">
            {isPoe2 || slot.sockets.startsWith("RUNE:") ? t.runeSocketsLabel : t.socketsLabel}
          </span>
          <ItemSocketPips sockets={slot.sockets} isPoe2={isPoe2} />
        </div>
      )}

      {slot && slot.mods.length > 0 && (
        <ul className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5">
          {slot.mods.map((mod, idx) => (
            <li key={idx} className="text-[11px] text-hud-text/90 leading-snug">
              {mod}
            </li>
          ))}
        </ul>
      )}

      {hasAlerts && alerts && (
        <div className="pt-1.5 border-t border-hud-hairline space-y-1">
          {alerts.hygiene.map((issue) => (
            <div
              key={issue.id}
              className="rounded-md px-2 py-1 text-[11px] border border-hud-warn/40 bg-hud-warn/10 text-hud-warn leading-snug"
            >
              {localizeGearHygieneMessage(issue, locale)}
            </div>
          ))}
          {alerts.crafts.map((craft) => (
            <div
              key={craft.id}
              className="rounded-md px-2 py-1 text-[11px] border border-hud-hairline bg-hud-subtle flex items-baseline justify-between gap-2"
            >
              <span className="text-hud-text/90">
                <span className="text-hud-accent font-medium">{msg.widgets.benchPrefix}</span>{" "}
                {localizeBenchPrescription(craft.prescription, locale)}
              </span>
              <span className="font-mono text-hud-quest shrink-0">{craft.costLabel}</span>
            </div>
          ))}
          {alerts.runes.map((rune) => (
            <div
              key={rune.id}
              className="rounded-md px-2 py-1 text-[11px] border border-hud-hairline bg-hud-subtle flex items-baseline justify-between gap-2"
            >
              <span className="text-hud-text/90">
                <span className="text-hud-accent font-medium">{appMsg.poe2.runeSlotPrefix}:</span>{" "}
                {rune.runeName}
              </span>
              <span className="font-mono text-hud-quest shrink-0">{rune.effectLabel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
