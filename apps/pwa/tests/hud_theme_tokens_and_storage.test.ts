import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HUD_THEME,
  HUD_ACCENT_SWATCHES,
  HUD_THEME_STORAGE_KEY,
  computeRelativeLuminance,
  loadSavedHudTheme,
  normalizeHexColor,
  parseSavedHudTheme,
  resolvePassiveTreePalette,
  resolveReadableAccentForMode,
  resolveThemeCssVariables,
  saveHudTheme,
  type SavedHudTheme
} from "@exile-hud/hud-ui";

function installMockWindow(): {
  store: Map<string, string>;
  dispatchedEvents: string[];
  restore: () => void;
} {
  const store = new Map<string, string>();
  const dispatchedEvents: string[] = [];
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  const localStorageMock = {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    }
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: localStorageMock,
      dispatchEvent(event: { type?: string }): boolean {
        dispatchedEvents.push(event?.type ?? "unknown");
        return true;
      },
      addEventListener(): void {},
      removeEventListener(): void {}
    }
  });

  return {
    store,
    dispatchedEvents,
    restore(): void {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  };
}

let cleanupWindow: (() => void) | null = null;

afterEach(() => {
  if (cleanupWindow) {
    cleanupWindow();
    cleanupWindow = null;
  }
});

describe("HUD theme tokens and contrast guards", () => {
  it("defaults fresh devices to OLED Black + Chalk Monochrome", () => {
    expect(DEFAULT_HUD_THEME).toEqual({
      mode: "oled",
      accentId: "chalk",
      customHex: "#eab308"
    });
    expect(HUD_THEME_STORAGE_KEY).toBe("exile_hud_theme_v1");
    expect(HUD_ACCENT_SWATCHES.length).toBeGreaterThanOrEqual(6);
  });

  it("maps mode surfaces and chalk contrast accurately across OLED, Soft Dark, and Light", () => {
    const oledVars = resolveThemeCssVariables({
      mode: "oled",
      accentId: "chalk",
      customHex: "#eab308"
    });
    const softVars = resolveThemeCssVariables({
      mode: "soft-dark",
      accentId: "chalk",
      customHex: "#eab308"
    });
    const lightVars = resolveThemeCssVariables({
      mode: "light",
      accentId: "chalk",
      customHex: "#eab308"
    });

    expect(oledVars["--hud-bg"]).toBe("#000000");
    expect(softVars["--hud-bg"]).toBe("#0c0c0e");
    expect(lightVars["--hud-bg"]).toBe("#fafafa");

    expect(oledVars["--hud-accent"]).toBe("#ffffff");
    expect(lightVars["--hud-accent"]).toBe("#09090b");
    expect(lightVars["--hud-socket-ring"]).toBe("rgba(9, 9, 11, 0.42)");
    expect(oledVars["--hud-socket-ring"]).not.toBe(lightVars["--hud-socket-ring"]);
  });

  it("clamps unreadable custom accent hexes for light and dark backgrounds", () => {
    expect(normalizeHexColor("eab308")).toBe("#eab308");
    expect(normalizeHexColor("#FFF")).toBe("#ffffff");
    expect(normalizeHexColor("not-a-color", "#123456")).toBe("#123456");

    const paleYellow = "#fef9c3";
    const lightSafe = resolveReadableAccentForMode(paleYellow, "light");
    expect(computeRelativeLuminance(lightSafe)).toBeLessThan(computeRelativeLuminance(paleYellow));

    const nearBlack = "#050505";
    const oledSafe = resolveReadableAccentForMode(nearBlack, "oled");
    const softSafe = resolveReadableAccentForMode(nearBlack, "soft-dark");
    expect(computeRelativeLuminance(oledSafe)).toBeGreaterThan(computeRelativeLuminance(nearBlack));
    expect(computeRelativeLuminance(softSafe)).toBeGreaterThan(computeRelativeLuminance(nearBlack));

    const customLightVars = resolveThemeCssVariables({
      mode: "light",
      accentId: "custom",
      customHex: paleYellow
    });
    expect(customLightVars["--hud-accent"]).toBe(lightSafe);
  });

  it("resolves distinct passive tree palettes for OLED, Soft Dark, and Light Mode", () => {
    const oledTree = resolvePassiveTreePalette({
      mode: "oled",
      accentId: "chalk",
      customHex: "#eab308"
    });
    const softTree = resolvePassiveTreePalette({
      mode: "soft-dark",
      accentId: "gold",
      customHex: "#eab308"
    });
    const lightTree = resolvePassiveTreePalette({
      mode: "light",
      accentId: "cyan",
      customHex: "#eab308"
    });

    expect(oledTree.canvasBg).toBe("#000000");
    expect(softTree.canvasBg).toBe("#0c0c0e");
    expect(lightTree.canvasBg).toBe("#f4f4f5");
    expect(lightTree.wireframeEdge).not.toBe(oledTree.wireframeEdge);
    expect(lightTree.nodeFill).not.toBe(oledTree.nodeFill);
  });
});

describe("HUD theme localStorage persistence", () => {
  it("falls back safely when storage payload is missing or malformed", () => {
    expect(parseSavedHudTheme(null)).toEqual(DEFAULT_HUD_THEME);
    expect(parseSavedHudTheme("{bad-json")).toEqual(DEFAULT_HUD_THEME);
    expect(
      parseSavedHudTheme(JSON.stringify({ mode: "neon", accentId: "unknown", customHex: "xyz" }))
    ).toEqual(DEFAULT_HUD_THEME);
  });

  it("returns default theme safely in SSR/Node without window", () => {
    expect(loadSavedHudTheme()).toEqual(DEFAULT_HUD_THEME);
  });

  it("persists and reloads mode, accent, and custom hex per device", () => {
    const env = installMockWindow();
    cleanupWindow = env.restore;

    const customTheme: SavedHudTheme = {
      mode: "light",
      accentId: "custom",
      customHex: "#0284c7"
    };

    saveHudTheme(customTheme);
    expect(env.store.get(HUD_THEME_STORAGE_KEY)).toBeTruthy();
    expect(loadSavedHudTheme()).toEqual(customTheme);
    expect(env.dispatchedEvents.length).toBeGreaterThanOrEqual(1);
  });
});
