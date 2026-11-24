import type { SupportedGameId, TargetItemSlotSummary } from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import { useEffect, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { summarizeGearSlotLabel } from "./gear_item_mod_summarizer.js";
import {
  classifyCharmVisualKind,
  classifyFlaskVisualKind,
  type PaperDollSlotKey,
  type SlotAnchoredAlerts,
} from "./gear_slot_normalizer.js";
import { EquipmentSlotSilhouette, ItemSocketPips } from "./equipment_slot_silhouettes.js";

const RARITY_TEXT_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "text-hud-warn",
  rare: "text-hud-quest",
  magic: "text-hud-cold",
  normal: "text-hud-text",
  unknown: "text-hud-text",
};

const RARITY_SURFACE_CLASS: Record<TargetItemSlotSummary["rarity"], string> = {
  unique: "border-hud-warn/50 bg-hud-warn/[0.06]",
  rare: "border-hud-quest/45 bg-hud-quest/[0.04]",
  magic: "border-hud-cold/45 bg-hud-cold/[0.04]",
  normal: "border-hud-hairline bg-hud-subtle/60",
  unknown: "border-hud-hairline bg-hud-subtle/60",
};

export interface EquipmentPaperDollSlotProps {
  slotKey: PaperDollSlotKey;
  gridAreaClass?: string;
  slot?: TargetItemSlotSummary | null;
  gameId: SupportedGameId;
  alerts?: SlotAnchoredAlerts;
  active: boolean;
  weaponSet?: 1 | 2;
  hasWeaponSet2?: boolean;
  onWeaponSetChange?: (next: 1 | 2) => void;
  onHoverStart: (key: string, el: HTMLElement) => void;
  onHoverEnd: (key: string) => void;
  onTogglePin: (key: string, el: HTMLElement) => void;
  compact?: boolean;
}

/** Interactive paper-doll slot tile showing Unique 2D art or non-unique base + 1-line mod summary. */
export function EquipmentPaperDollSlot({
  slotKey,
  gridAreaClass = "",
  slot = null,
  gameId,
  alerts,
  active,
  weaponSet = 1,
  hasWeaponSet2 = false,
  onWeaponSetChange,
  onHoverStart,
  onHoverEnd,
  onTogglePin,
  compact = false,
}: EquipmentPaperDollSlotProps) {
  const { msg } = useHudI18n();
  const t = msg.widgets.gearPaperDoll;
  const isPoe2 = gameId === "poe2";

  const iconUrl =
    slot && slot.rarity === "unique" ? getGameAdapter(gameId).resolveOfficialUniqueIconUrl(slot.itemName) : null;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [iconUrl]);

  const summary = slot ? summarizeGearSlotLabel(slot) : null;
  const shortLabel =
    isPoe2 && slotKey === "flask1"
      ? t.lifeFlaskShort
      : isPoe2 && slotKey === "flask2"
        ? t.manaFlaskShort
        : t.slotShortLabels[slotKey];

  const alertCount = alerts?.totalCount ?? 0;
  const isTall = slotKey === "weapon1" || slotKey === "weapon2" || slotKey === "body";
  const isWeaponSlot = slotKey === "weapon1" || slotKey === "weapon2";
  const isCharmSlot = slotKey === "charm1" || slotKey === "charm2" || slotKey === "charm3";
  const showUniqueArt = Boolean(iconUrl) && !imgError;

  const surfaceClass = active
    ? "border-hud-accent ring-1 ring-hud-accent bg-hud-surface"
    : alertCount > 0
      ? "border-hud-warn/80 bg-hud-warn/[0.06]"
      : slot
        ? RARITY_SURFACE_CLASS[slot.rarity]
        : "border-dashed border-hud-hairline/75 bg-hud-subtle/20 opacity-70";

  const artSizeClass = isCharmSlot
    ? "w-4 h-4"
    : isTall
      ? compact
        ? "w-6 h-8"
        : "w-8 h-11"
      : compact
        ? "w-5 h-5"
        : "w-6 h-6";

  const ariaLabel = slot
    ? `${slot.slotName}: ${summary?.primaryLabel ?? slot.itemName}${summary?.secondaryLabel ? ` (${summary.secondaryLabel})` : ""}`
    : `${shortLabel}: ${t.emptySlot}`;

  return (
    <div className={`relative h-full min-w-0 min-h-0 ${gridAreaClass}`}>
      {isWeaponSlot && onWeaponSetChange && (
        <div
          role="group"
          aria-label={t.weaponSetAria}
          className="absolute top-1 left-1 z-10 inline-flex items-center rounded bg-hud-bg/85 border border-hud-hairline p-[1px] text-[9px] font-mono leading-none"
        >
          <button
            type="button"
            onClick={() => onWeaponSetChange(1)}
            aria-pressed={weaponSet === 1}
            className={`px-1 py-0.5 rounded-[3px] cursor-pointer transition-colors ${
              weaponSet === 1 ? "bg-hud-accent text-hud-accent-fg font-bold" : "text-hud-dim hover:text-hud-text"
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => onWeaponSetChange(2)}
            aria-pressed={weaponSet === 2}
            className={`px-1 py-0.5 rounded-[3px] cursor-pointer transition-colors ${
              weaponSet === 2
                ? "bg-hud-accent text-hud-accent-fg font-bold"
                : hasWeaponSet2
                  ? "text-hud-muted hover:text-hud-text"
                  : "text-hud-dim/45 hover:text-hud-dim"
            }`}
          >
            II
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={active}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onHoverStart(slotKey, e.currentTarget);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") onHoverEnd(slotKey);
        }}
        onClick={(e) => onTogglePin(slotKey, e.currentTarget)}
        className={`w-full h-full rounded-lg border flex flex-col items-center justify-between p-1 transition-all cursor-pointer overflow-hidden hover:brightness-110 ${surfaceClass}`}
      >
        <div className="w-full flex items-center justify-end gap-1 min-h-[12px] shrink-0">
          {alertCount > 0 && (
            <span className="px-1 rounded text-[9px] font-bold leading-tight bg-hud-warn text-hud-accent-fg">
              !{alertCount > 1 ? alertCount : ""}
            </span>
          )}
          {slot?.verifiedEquipped && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-hud-ok shrink-0"
              title={msg.widgets.equipped}
            />
          )}
        </div>

        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {showUniqueArt ? (
            <img
              src={iconUrl ?? ""}
              alt={slot?.itemName ?? shortLabel}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className={`max-h-full max-w-full object-contain ${artSizeClass}`}
            />
          ) : (
            <EquipmentSlotSilhouette
              slotKey={slotKey}
              rarity={slot ? slot.rarity : "empty"}
              flaskKind={classifyFlaskVisualKind(slot)}
              charmKind={classifyCharmVisualKind(slot)}
              className={artSizeClass}
            />
          )}
        </div>

        <div className="w-full flex flex-col items-center gap-0.5 shrink-0 min-w-0">
          {slot?.sockets && <ItemSocketPips sockets={slot.sockets} isPoe2={isPoe2} compact />}
          {summary ? (
            <>
              <span
                className={`w-full text-center truncate text-[10px] font-semibold leading-tight ${
                  RARITY_TEXT_CLASS[slot!.rarity]
                }`}
              >
                {summary.primaryLabel}
              </span>
              {summary.secondaryLabel && !isCharmSlot && (
                <span className="w-full text-center truncate font-mono text-[9px] text-hud-muted leading-none">
                  {summary.secondaryLabel}
                </span>
              )}
            </>
          ) : (
            <span className="w-full text-center truncate text-[9px] text-hud-dim leading-none">
              {shortLabel}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
