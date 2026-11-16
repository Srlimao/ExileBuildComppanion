import type { DeviceFormFactor, HudContextMode, WidgetGridItemLayout, WidgetId } from "@exile-hud/core";
import { HUD_SHELL_AND_TREE_MESSAGES } from "../i18n/hud_shell_messages.js";
import type { HudLocale } from "../i18n/locale_storage_and_types.js";

export interface WidgetCatalogEntry {
  widgetId: WidgetId;
  label: string;
  description: string;
}

const ORDERED_WIDGET_IDS: readonly WidgetId[] = [
  "zone_layout",
  "active_checklist",
  "vendor_shopping",
  "socket_links",
  "passive_tree",
  "regex_sync",
  "deferred_backlog",
  "resistance_cap",
  "gear_hygiene",
  "twink_gear",
  "run_timer",
  "lab_compass",
];

/** Returns localized widget catalog metadata for the active HUD locale. */
export function getLocalizedWidgetCatalog(locale: HudLocale): WidgetCatalogEntry[] {
  const dict = HUD_SHELL_AND_TREE_MESSAGES[locale].grid.widgetCatalog;
  return ORDERED_WIDGET_IDS.map((widgetId) => ({
    widgetId,
    label: dict[widgetId].label,
    description: dict[widgetId].description,
  }));
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = getLocalizedWidgetCatalog("en");

export function getDefaultLayoutForMode(
  formFactor: DeviceFormFactor,
  mode: HudContextMode,
  options?: { leagueStart?: boolean },
): WidgetGridItemLayout[] {
  const isPhone = formFactor === "phone";

  if (mode === "TOWN") {
    const items: WidgetGridItemLayout[] = [
      { widgetId: "vendor_shopping", colSpan: isPhone ? 1 : 2, rowSpan: 2, order: 0 },
      { widgetId: "regex_sync", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "socket_links", colSpan: 1, rowSpan: 1, order: 2 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 3 },
      { widgetId: "gear_hygiene", colSpan: 1, rowSpan: 1, order: 4 },
      { widgetId: "passive_tree", colSpan: isPhone ? 1 : 2, rowSpan: 1, order: 5 },
    ];
    if (options?.leagueStart === false) {
      items.splice(1, 0, { widgetId: "twink_gear", colSpan: isPhone ? 1 : 2, rowSpan: 2, order: 1 });
      return items.map((item, idx) => ({ ...item, order: idx }));
    }
    return items;
  }

  if (mode === "LAB") {
    return [
      { widgetId: "lab_compass", colSpan: isPhone ? 1 : 2, rowSpan: 2, order: 0 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "run_timer", colSpan: 1, rowSpan: 1, order: 2 },
      { widgetId: "gear_hygiene", colSpan: 1, rowSpan: 1, order: 3 },
    ];
  }

  return [
    { widgetId: "zone_layout", colSpan: isPhone ? 1 : 2, rowSpan: 2, order: 0 },
    { widgetId: "active_checklist", colSpan: 1, rowSpan: 2, order: 1 },
    { widgetId: "run_timer", colSpan: 1, rowSpan: 1, order: 2 },
    { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 3 },
    { widgetId: "deferred_backlog", colSpan: 1, rowSpan: 1, order: 4 },
    { widgetId: "vendor_shopping", colSpan: 1, rowSpan: 1, order: 5 },
  ];
}
