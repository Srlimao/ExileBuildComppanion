import type { WidgetGridItemLayout } from "@exile-hud/core";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";

export type OverlayDockPreset =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left-edge"
  | "right-edge"
  | "free";

export type OverlayContextMode = "FIELD" | "TOWN" | "LAB" | "TREE_COMPACT";

export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedOverlayConfig {
  enabled: boolean;
  clickThroughLocked: boolean;
  pinOnDesktop: boolean;
  opacityPercent: number;
  dockPreset: OverlayDockPreset;
  bounds: OverlayBounds | null;
  toggleVisibilityHotkey: string;
  toggleLockHotkey: string;
  modeLayouts: Partial<Record<OverlayContextMode, WidgetGridItemLayout[]>>;
  updatedAtMs: number;
}

export type OverlayResizeDirection =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const FALLBACK_STORAGE_KEY = "exile_saved_overlay_config_v1";
const FALLBACK_EVENT_NAME = "exile-local-overlay-config-updated";

export const DEFAULT_OVERLAY_CONFIG: SavedOverlayConfig = {
  enabled: false,
  clickThroughLocked: false,
  pinOnDesktop: false,
  opacityPercent: 88,
  dockPreset: "top-left",
  bounds: null,
  toggleVisibilityHotkey: "F7",
  toggleLockHotkey: "F8",
  modeLayouts: {},
  updatedAtMs: 0,
};

function readFallbackConfig(): SavedOverlayConfig {
  if (typeof localStorage === "undefined") return { ...DEFAULT_OVERLAY_CONFIG };
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OVERLAY_CONFIG };
    return { ...DEFAULT_OVERLAY_CONFIG, ...(JSON.parse(raw) as Partial<SavedOverlayConfig>) };
  } catch {
    return { ...DEFAULT_OVERLAY_CONFIG };
  }
}

function writeFallbackConfig(cfg: SavedOverlayConfig): SavedOverlayConfig {
  const next: SavedOverlayConfig = {
    ...DEFAULT_OVERLAY_CONFIG,
    ...cfg,
    opacityPercent: Math.min(100, Math.max(35, Math.round(cfg.opacityPercent))),
    updatedAtMs: Date.now(),
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SavedOverlayConfig>(FALLBACK_EVENT_NAME, { detail: next }));
  }
  return next;
}

export async function getOverlayConfigIpc(): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) return readFallbackConfig();
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("get_overlay_config");
}

export async function updateOverlayConfigIpc(config: SavedOverlayConfig): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) return writeFallbackConfig(config);
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("update_overlay_config", {
    config: { ...config, updatedAtMs: Date.now() },
  });
}

export async function applyOverlayDockPresetIpc(
  preset: Exclude<OverlayDockPreset, "free">,
): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) {
    return writeFallbackConfig({ ...readFallbackConfig(), dockPreset: preset });
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("apply_overlay_dock_preset", { preset });
}

export async function saveOverlayFreeBoundsIpc(bounds?: OverlayBounds): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) {
    const prev = readFallbackConfig();
    return writeFallbackConfig({ ...prev, dockPreset: "free", bounds: bounds ?? prev.bounds });
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("save_overlay_free_bounds", { bounds: bounds ?? null });
}

export async function toggleOverlayVisibilityIpc(): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) {
    const prev = readFallbackConfig();
    return writeFallbackConfig({ ...prev, enabled: !prev.enabled });
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("toggle_overlay_visibility");
}

export async function toggleOverlayClickThroughIpc(): Promise<SavedOverlayConfig> {
  if (!isTauriRuntime()) {
    const prev = readFallbackConfig();
    return writeFallbackConfig({ ...prev, clickThroughLocked: !prev.clickThroughLocked });
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SavedOverlayConfig>("toggle_overlay_click_through");
}

export async function startOverlayWindowDrag(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

export async function startOverlayWindowResize(direction: OverlayResizeDirection): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startResizeDragging(direction);
}

export async function subscribeOverlayConfigUpdates(
  onUpdate: (config: SavedOverlayConfig) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<SavedOverlayConfig>).detail;
      if (detail) onUpdate(detail);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === FALLBACK_STORAGE_KEY && ev.newValue) {
        try {
          onUpdate(JSON.parse(ev.newValue) as SavedOverlayConfig);
        } catch {
          // Ignore malformed storage JSON
        }
      }
    };
    window.addEventListener(FALLBACK_EVENT_NAME, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FALLBACK_EVENT_NAME, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<SavedOverlayConfig>("overlay-config-updated", (ev) => onUpdate(ev.payload));
}
