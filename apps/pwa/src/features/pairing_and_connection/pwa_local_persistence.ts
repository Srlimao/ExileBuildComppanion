import type { ModeWidgetGrids, SavedCampaignProgress } from "@exile-hud/core";

export const LOCAL_LAYOUT_KEY = "exile_hud_widget_layouts_v1";
export const DEMO_PROGRESS_KEY = "exile_hud_demo_progress_v1";

export function loadDemoProgress(): SavedCampaignProgress | null {
  try {
    const raw = localStorage.getItem(DEMO_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as SavedCampaignProgress) : null;
  } catch {
    return null;
  }
}

export function saveDemoProgress(record: SavedCampaignProgress): void {
  try {
    localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage error
  }
}

export function loadCachedLayouts(): ModeWidgetGrids {
  try {
    const raw = localStorage.getItem(LOCAL_LAYOUT_KEY);
    if (raw) return JSON.parse(raw) as ModeWidgetGrids;
  } catch {
    // Ignore storage error
  }
  return { "tablet-landscape": {}, "tablet-portrait": {}, phone: {} };
}
