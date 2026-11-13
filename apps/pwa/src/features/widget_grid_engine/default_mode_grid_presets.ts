import type { DeviceFormFactor, HudContextMode, WidgetGridItemLayout, WidgetId } from "@exile-hud/core";

export interface WidgetCatalogEntry {
  widgetId: WidgetId;
  label: string;
  description: string;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { widgetId: "zone_layout", label: "Zone Layout", description: "Exile-UI map seed variants & compass direction" },
  { widgetId: "active_checklist", label: "Active Checklist", description: "Zone steps, quest objectives & soft-progress" },
  { widgetId: "vendor_shopping", label: "Vendor & Gems", description: "Quest vs vendor gems & Act 1-3 currency budget" },
  { widgetId: "socket_links", label: "Socket & Links", description: "Target links, unlinked support & aura alerts" },
  { widgetId: "passive_tree", label: "Passive Tree", description: "Unallocated PoB notables & respec counter" },
  { widgetId: "regex_sync", label: "Vendor Regex", description: "Live PC clipboard regex sync & re-push" },
  { widgetId: "deferred_backlog", label: "Cleanup Backlog", description: "Skipped skill books & Lab trials" },
  { widgetId: "resistance_cap", label: "Resistances", description: "Live ele/chaos vs Act & Kitava targets" },
  { widgetId: "gear_hygiene", label: "Gear & Flasks", description: "0% MS boots, flask tier & weapon alerts" },
  { widgetId: "run_timer", label: "Run Timer", description: "Total timer, Act splits & pace delta" },
  { widgetId: "lab_compass", label: "Lab Compass", description: "Daily PoELab room tracker, Trials & Izaro" },
];

export function getDefaultLayoutForMode(
  formFactor: DeviceFormFactor,
  mode: HudContextMode,
): WidgetGridItemLayout[] {
  const isPhone = formFactor === "phone";

  if (mode === "TOWN") {
    return [
      { widgetId: "vendor_shopping", colSpan: isPhone ? 1 : 2, rowSpan: 2, order: 0 },
      { widgetId: "regex_sync", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "socket_links", colSpan: 1, rowSpan: 1, order: 2 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 3 },
      { widgetId: "gear_hygiene", colSpan: 1, rowSpan: 1, order: 4 },
      { widgetId: "passive_tree", colSpan: isPhone ? 1 : 2, rowSpan: 1, order: 5 },
    ];
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
