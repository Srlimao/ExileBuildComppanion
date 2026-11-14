import type { WidgetGridItemLayout } from "@exile-hud/core";
import type { OverlayContextMode } from "./overlay_types_and_ipc.js";

/** Default compact widget grid presets strictly scoped to the local PC overlay. */
export function getDefaultOverlayLayoutForMode(mode: OverlayContextMode): WidgetGridItemLayout[] {
  if (mode === "TOWN") {
    return [
      { widgetId: "vendor_shopping", colSpan: 1, rowSpan: 2, order: 0 },
      { widgetId: "regex_sync", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "socket_links", colSpan: 1, rowSpan: 1, order: 2 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 3 },
    ];
  }

  if (mode === "LAB") {
    return [
      { widgetId: "lab_compass", colSpan: 1, rowSpan: 2, order: 0 },
      { widgetId: "run_timer", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 2 },
    ];
  }

  if (mode === "TREE_COMPACT") {
    return [
      { widgetId: "passive_tree", colSpan: 1, rowSpan: 2, order: 0 },
      { widgetId: "socket_links", colSpan: 1, rowSpan: 1, order: 1 },
      { widgetId: "resistance_cap", colSpan: 1, rowSpan: 1, order: 2 },
    ];
  }

  return [
    { widgetId: "active_checklist", colSpan: 1, rowSpan: 2, order: 0 },
    { widgetId: "zone_layout", colSpan: 1, rowSpan: 2, order: 1 },
    { widgetId: "run_timer", colSpan: 1, rowSpan: 1, order: 2 },
  ];
}
