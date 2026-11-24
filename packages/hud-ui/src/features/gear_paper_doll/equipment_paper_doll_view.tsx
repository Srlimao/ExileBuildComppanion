import type { SupportedGameId, TargetItemSlotSummary } from "@exile-hud/core";
import { useEffect, useRef, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { EquipmentPaperDollSlot } from "./equipment_paper_doll_slot.js";
import { EquipmentSlotSilhouette } from "./equipment_slot_silhouettes.js";
import type { NormalizedPaperDollModel, PaperDollSlotKey } from "./gear_slot_normalizer.js";
import { GearItemFloatingTooltip, type TooltipAnchorBox } from "./gear_item_floating_tooltip.js";

const CORE_SLOTS: ReadonlyArray<{ key: PaperDollSlotKey; gridClass: string }> = [
  { key: "weapon1", gridClass: "col-start-1 col-end-2 row-start-1 row-end-4" },
  { key: "gloves", gridClass: "col-start-1 col-end-2 row-start-4 row-end-5" },
  { key: "ring1", gridClass: "col-start-2 col-end-3 row-start-3 row-end-4" },
  { key: "helmet", gridClass: "col-start-3 col-end-4 row-start-1 row-end-2" },
  { key: "body", gridClass: "col-start-3 col-end-4 row-start-2 row-end-4" },
  { key: "belt", gridClass: "col-start-3 col-end-4 row-start-4 row-end-5" },
  { key: "amulet", gridClass: "col-start-4 col-end-5 row-start-2 row-end-3" },
  { key: "ring2", gridClass: "col-start-4 col-end-5 row-start-3 row-end-4" },
  { key: "weapon2", gridClass: "col-start-5 col-end-6 row-start-1 row-end-4" },
  { key: "boots", gridClass: "col-start-5 col-end-6 row-start-4 row-end-5" },
];

const POE1_FLASK_KEYS: readonly PaperDollSlotKey[] = ["flask1", "flask2", "flask3", "flask4", "flask5"];
const POE2_CHARM_KEYS: readonly PaperDollSlotKey[] = ["charm1", "charm2", "charm3"];

function computeRelativeAnchor(container: HTMLElement | null, target: HTMLElement | null): TooltipAnchorBox | null {
  if (!container || !target) return null;
  const cRect = container.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  return {
    left: tRect.left - cRect.left,
    top: tRect.top - cRect.top,
    right: tRect.right - cRect.left,
    bottom: tRect.bottom - cRect.top,
    containerWidth: cRect.width,
    containerHeight: cRect.height,
  };
}

export interface EquipmentPaperDollViewProps {
  model: NormalizedPaperDollModel;
  gameId: SupportedGameId;
  pinnedKey: string | null;
  onPinnedKeyChange: (key: string | null) => void;
}

/** Shared PoE 1 & PoE 2 paper-doll equipment grid, flask/charm tray, and floating PoE tooltip. */
export function EquipmentPaperDollView({
  model,
  gameId,
  pinnedKey,
  onPinnedKeyChange,
}: EquipmentPaperDollViewProps) {
  const { msg } = useHudI18n();
  const t = msg.widgets.gearPaperDoll;
  const isPoe2 = gameId === "poe2";
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [weaponSet, setWeaponSet] = useState<1 | 2>(1);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [anchorBox, setAnchorBox] = useState<TooltipAnchorBox | null>(null);

  useEffect(() => {
    if (!model.hasWeaponSet2 && weaponSet === 2) {
      setWeaponSet(1);
    }
  }, [model.hasWeaponSet2, weaponSet]);

  useEffect(() => {
    if (!pinnedKey) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onPinnedKeyChange(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onPinnedKeyChange(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinnedKey, onPinnedKeyChange]);

  const resolveSlotItem = (key: PaperDollSlotKey): TargetItemSlotSummary | null => {
    if (key === "weapon1" && weaponSet === 2) {
      return model.weaponSwapSlots.weapon1 ?? null;
    }
    if (key === "weapon2" && weaponSet === 2) {
      return model.weaponSwapSlots.weapon2 ?? null;
    }
    return model.primarySlots[key] ?? null;
  };

  const handleHoverStart = (key: string, el: HTMLElement) => {
    if (pinnedKey) return;
    setHoveredKey(key);
    setAnchorBox(computeRelativeAnchor(containerRef.current, el));
  };

  const handleHoverEnd = (key: string) => {
    if (hoveredKey === key) setHoveredKey(null);
  };

  const handleTogglePin = (key: string, el: HTMLElement) => {
    if (pinnedKey === key) {
      onPinnedKeyChange(null);
      return;
    }
    setHoveredKey(null);
    setAnchorBox(computeRelativeAnchor(containerRef.current, el));
    onPinnedKeyChange(key);
  };

  const activeTooltipKey = pinnedKey ?? hoveredKey;
  const activeExtra = activeTooltipKey ? model.extras.find((ex) => ex.key === activeTooltipKey) : undefined;
  const activePrimaryKey = activeTooltipKey && !activeExtra ? (activeTooltipKey as PaperDollSlotKey) : null;
  const activeSlot = activeExtra
    ? activeExtra.slot
    : activePrimaryKey
      ? resolveSlotItem(activePrimaryKey)
      : null;
  const activeAlerts = activePrimaryKey ? model.alertsBySlot[activePrimaryKey] : undefined;
  const activeSlotLabel = activeExtra
    ? activeExtra.slot.slotName
    : activePrimaryKey
      ? t.slotShortLabels[activePrimaryKey]
      : "";

  const populatedCharms = POE2_CHARM_KEYS.filter((k) => Boolean(model.primarySlots[k])).length;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2 min-h-0">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "minmax(0,1.28fr) minmax(0,0.82fr) minmax(0,1.52fr) minmax(0,0.82fr) minmax(0,1.28fr)",
          gridTemplateRows: "46px 42px 48px 50px",
        }}
      >
        {CORE_SLOTS.map(({ key, gridClass }) => (
          <EquipmentPaperDollSlot
            key={key}
            slotKey={key}
            gridAreaClass={gridClass}
            slot={resolveSlotItem(key)}
            gameId={gameId}
            alerts={model.alertsBySlot[key]}
            active={activeTooltipKey === key}
            weaponSet={weaponSet}
            hasWeaponSet2={model.hasWeaponSet2}
            onWeaponSetChange={key === "weapon1" || key === "weapon2" ? setWeaponSet : undefined}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
            onTogglePin={handleTogglePin}
          />
        ))}
      </div>

      {!isPoe2 ? (
        <div className="grid grid-cols-5 gap-1">
          {POE1_FLASK_KEYS.map((fk) => (
            <div key={fk} className="h-[58px]">
              <EquipmentPaperDollSlot
                slotKey={fk}
                slot={model.primarySlots[fk] ?? null}
                gameId={gameId}
                alerts={model.alertsBySlot[fk]}
                active={activeTooltipKey === fk}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
                onTogglePin={handleTogglePin}
                compact
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid items-stretch gap-1" style={{ gridTemplateColumns: "1fr 2.4fr 1fr" }}>
          <div className="h-[60px]">
            <EquipmentPaperDollSlot
              slotKey="flask1"
              slot={model.primarySlots.flask1 ?? null}
              gameId={gameId}
              alerts={model.alertsBySlot.flask1}
              active={activeTooltipKey === "flask1"}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onTogglePin={handleTogglePin}
              compact
            />
          </div>

          <div className="h-[60px] rounded-lg border border-hud-hairline bg-hud-subtle/40 p-1 flex flex-col justify-between">
            <div className="flex items-center justify-between px-0.5 text-[9px] uppercase tracking-wider text-hud-dim leading-none">
              <span>{t.charmsLabel}</span>
              <span className="font-mono">{populatedCharms}/3</span>
            </div>
            <div className="grid grid-cols-3 gap-1 flex-1 pt-0.5 min-h-0">
              {POE2_CHARM_KEYS.map((ck) => (
                <EquipmentPaperDollSlot
                  key={ck}
                  slotKey={ck}
                  slot={model.primarySlots[ck] ?? null}
                  gameId={gameId}
                  alerts={model.alertsBySlot[ck]}
                  active={activeTooltipKey === ck}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                  onTogglePin={handleTogglePin}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="h-[60px]">
            <EquipmentPaperDollSlot
              slotKey="flask2"
              slot={model.primarySlots.flask2 ?? null}
              gameId={gameId}
              alerts={model.alertsBySlot.flask2}
              active={activeTooltipKey === "flask2"}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onTogglePin={handleTogglePin}
              compact
            />
          </div>
        </div>
      )}

      {model.extras.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] uppercase tracking-wider text-hud-dim">{t.jewelsLabel}:</span>
          {model.extras.map((ex) => {
            const isSel = activeTooltipKey === ex.key;
            return (
              <button
                key={ex.key}
                type="button"
                aria-expanded={isSel}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") handleHoverStart(ex.key, e.currentTarget);
                }}
                onPointerLeave={() => handleHoverEnd(ex.key)}
                onClick={(e) => handleTogglePin(ex.key, e.currentTarget)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] cursor-pointer transition-colors ${
                  isSel
                    ? "border-hud-accent bg-hud-surface text-hud-text"
                    : "border-hud-hairline bg-hud-subtle/60 text-hud-muted hover:text-hud-text"
                }`}
              >
                <EquipmentSlotSilhouette slotKey="extra" rarity={ex.slot.rarity} className="w-3 h-3" />
                <span className={ex.slot.rarity === "unique" ? "text-hud-warn font-medium" : "text-hud-quest"}>
                  {ex.slot.itemName}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeTooltipKey && (
        <GearItemFloatingTooltip
          slotLabel={activeSlotLabel}
          slot={activeSlot}
          alerts={activeAlerts}
          isPoe2={isPoe2}
          anchor={activeTooltipKey === pinnedKey ? anchorBox : anchorBox}
          onClose={() => {
            setHoveredKey(null);
            onPinnedKeyChange(null);
          }}
        />
      )}
    </div>
  );
}
