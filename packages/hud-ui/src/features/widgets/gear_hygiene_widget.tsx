import {
  resolveSnapshotGameId,
  type HudSessionSnapshot,
  type TargetItemSetSummary,
} from "@exile-hud/core";
import { LayoutGrid, List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  normalizeItemSetToPaperDoll,
  type PaperDollSlotKey,
} from "../gear_paper_doll/gear_slot_normalizer.js";
import { EquipmentPaperDollView } from "../gear_paper_doll/equipment_paper_doll_view.js";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import {
  localizeBenchPrescription,
  localizeBenchProblemSummary,
  localizeGearHygieneMessage,
} from "../i18n/telemetry_advisor_localizer.js";
import { GearHygieneListView } from "./gear_hygiene_list_view.js";

function selectDefaultItemSet(itemSets: TargetItemSetSummary[], characterLevel: number): TargetItemSetSummary | null {
  if (itemSets.length === 0) return null;
  let active = itemSets[0]!;
  for (const set of itemSets) {
    if (set.minLevel <= characterLevel) active = set;
  }
  return active;
}

function findSlotForAlertId(
  alertsBySlot: Partial<Record<PaperDollSlotKey, { hygiene: Array<{ id: string }>; crafts: Array<{ id: string }>; runes: Array<{ id: string }> }>>,
  kind: "hygiene" | "crafts" | "runes",
  id: string,
): PaperDollSlotKey | null {
  for (const [slotKey, bucket] of Object.entries(alertsBySlot)) {
    if (bucket && bucket[kind].some((entry) => entry.id === id)) {
      return slotKey as PaperDollSlotKey;
    }
  }
  return null;
}

/** Displays shared PoE 1 & PoE 2 paper-doll gear/flasks UI, anchored alerts, and PoB Item Set switcher. */
export function GearHygieneWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, msg, appMsg } = useHudI18n();
  const gameId = resolveSnapshotGameId(snapshot);
  const isPoe2 = gameId === "poe2";
  const issues = snapshot.gearHygiene;
  const craftSuggestions = useMemo(
    () =>
      (snapshot.benchCraftSuggestions ?? []).filter(
        (s) => !(s.id === "bench_boots_ms" && issues.some((i) => i.id === "boots_0ms")),
      ),
    [snapshot.benchCraftSuggestions, issues],
  );
  const topRunes = useMemo(
    () => (isPoe2 ? (snapshot.runeSuggestions ?? []).slice(0, 2) : []),
    [isPoe2, snapshot.runeSuggestions],
  );
  const itemSets = snapshot.itemSets ?? [];
  const defaultSet = selectDefaultItemSet(itemSets, snapshot.characterLevel);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(defaultSet?.id ?? null);
  const [viewMode, setViewMode] = useState<"doll" | "list">("doll");
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  useEffect(() => {
    const stillValid = itemSets.some((s) => s.id === selectedSetId);
    if (!stillValid) {
      setSelectedSetId(defaultSet?.id ?? null);
    }
  }, [defaultSet?.id, itemSets, selectedSetId]);

  const activeSet = itemSets.find((s) => s.id === selectedSetId) ?? defaultSet;
  const dollModel = useMemo(
    () =>
      normalizeItemSetToPaperDoll({
        itemSet: activeSet,
        gameId,
        hygiene: issues,
        crafts: craftSuggestions,
        runes: topRunes,
      }),
    [activeSet, gameId, issues, craftSuggestions, topRunes],
  );

  const t = msg.widgets.gearPaperDoll;
  const totalAlerts = issues.length + craftSuggestions.length + topRunes.length;

  const pinSlotFromChip = (slotKey: PaperDollSlotKey | null) => {
    if (!slotKey) return;
    setViewMode("doll");
    setPinnedKey((prev) => (prev === slotKey ? null : slotKey));
  };

  return (
    <div className="flex flex-col h-full gap-2 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted truncate">
            {msg.widgets.gearAndFlasks}
          </h2>
          <span className="text-[11px] font-mono text-hud-muted tabular-nums shrink-0">
            {msg.widgets.slotsAndAlerts(activeSet ? activeSet.slots.length : null, issues.length + craftSuggestions.length)}
          </span>
        </div>

        <div className="inline-flex items-center rounded-md border border-hud-hairline bg-hud-subtle/60 p-0.5 shrink-0">
          <button
            type="button"
            aria-pressed={viewMode === "doll"}
            aria-label={t.paperDollView}
            title={t.paperDollView}
            onClick={() => setViewMode("doll")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === "doll" ? "bg-hud-accent text-hud-accent-fg" : "text-hud-muted hover:text-hud-text"
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            aria-label={t.listView}
            title={t.listView}
            onClick={() => setViewMode("list")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === "list" ? "bg-hud-accent text-hud-accent-fg" : "text-hud-muted hover:text-hud-text"
            }`}
          >
            <List className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
        {issues.map((issue) => {
          const targetSlot = findSlotForAlertId(dollModel.alertsBySlot, "hygiene", issue.id);
          const isSelected = Boolean(targetSlot && pinnedKey === targetSlot);
          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => pinSlotFromChip(targetSlot)}
              title={localizeGearHygieneMessage(issue, locale)}
              className={`px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? "border-hud-accent bg-hud-accent text-hud-accent-fg font-semibold"
                  : issue.severity === "warn"
                    ? "border-hud-warn/45 bg-hud-warn/10 text-hud-warn hover:bg-hud-warn/20"
                    : "border-hud-hairline bg-hud-subtle/70 text-hud-text/90 hover:bg-hud-subtle"
              }`}
            >
              {targetSlot ? `${t.slotShortLabels[targetSlot]}: ` : ""}
              {localizeGearHygieneMessage(issue, locale)}
            </button>
          );
        })}

        {craftSuggestions.map((s) => {
          const targetSlot = findSlotForAlertId(dollModel.alertsBySlot, "crafts", s.id);
          const isSelected = Boolean(targetSlot && pinnedKey === targetSlot);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pinSlotFromChip(targetSlot)}
              title={`${localizeBenchProblemSummary(s.problemSummary, locale)} → ${localizeBenchPrescription(s.prescription, locale)} (${s.costLabel})`}
              className={`px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1 ${
                isSelected
                  ? "border-hud-accent bg-hud-accent text-hud-accent-fg font-semibold"
                  : "border-hud-hairline bg-hud-subtle/70 text-hud-text/90 hover:bg-hud-subtle"
              }`}
            >
              <span className={isSelected ? "font-semibold" : "text-hud-accent font-medium"}>
                {msg.widgets.benchPrefix}
              </span>
              <span>{s.slot}</span>
              <span className="font-mono text-hud-quest">{s.recipeLabel}</span>
            </button>
          );
        })}

        {issues.length === 0 &&
          craftSuggestions.length === 0 &&
          topRunes.map((rune) => {
            const targetSlot = findSlotForAlertId(dollModel.alertsBySlot, "runes", rune.id);
            const isSelected = Boolean(targetSlot && pinnedKey === targetSlot);
            return (
              <button
                key={rune.id}
                type="button"
                onClick={() => pinSlotFromChip(targetSlot)}
                title={`${rune.runeName} (${rune.slotHint}) · ${rune.effectLabel}`}
                className={`px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1 ${
                  isSelected
                    ? "border-hud-accent bg-hud-accent text-hud-accent-fg font-semibold"
                    : "border-hud-hairline bg-hud-subtle/70 text-hud-text/90 hover:bg-hud-subtle"
                }`}
              >
                <span className={isSelected ? "font-semibold" : "text-hud-accent font-medium"}>
                  {appMsg.poe2.runeSlotPrefix}:
                </span>
                <span>{rune.runeName}</span>
                <span className="font-mono text-hud-quest">{rune.effectLabel}</span>
              </button>
            );
          })}

        {totalAlerts === 0 && <p className="text-[11px] text-hud-ok">{msg.widgets.gearLooksGood}</p>}
      </div>

      {itemSets.length > 0 && activeSet && (
        <div className="flex items-center gap-3 overflow-x-auto pb-0.5 border-b border-hud-hairline shrink-0">
          {itemSets.map((set) => {
            const isSelected = set.id === activeSet.id;
            return (
              <button
                key={set.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedSetId(set.id);
                  setPinnedKey(null);
                }}
                className={`py-1 text-xs whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
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
      )}

      {viewMode === "doll" ? (
        <div className="flex-1 min-h-0">
          <EquipmentPaperDollView
            model={dollModel}
            gameId={gameId}
            pinnedKey={pinnedKey}
            onPinnedKeyChange={setPinnedKey}
          />
        </div>
      ) : (
        <GearHygieneListView activeSet={activeSet} />
      )}
    </div>
  );
}
