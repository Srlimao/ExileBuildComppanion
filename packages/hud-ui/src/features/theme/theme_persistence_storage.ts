import {
  DEFAULT_HUD_THEME,
  HUD_ACCENT_SWATCHES,
  normalizeHexColor,
  resolveThemeCssVariables,
  type HudAccentPresetId,
  type HudAppearanceMode,
  type SavedHudTheme,
} from "./theme_tokens_and_palettes.js";

export const HUD_THEME_STORAGE_KEY = "exile_hud_theme_v1";
const THEME_CHANGE_EVENT = "exile-hud-theme-change";

const VALID_MODES = new Set<HudAppearanceMode>(["oled", "soft-dark", "light"]);
const VALID_ACCENTS = new Set<HudAccentPresetId>([
  ...HUD_ACCENT_SWATCHES.map((s) => s.id),
  "custom",
]);

/** Validates serialized theme JSON from localStorage with safe fallback to defaults. */
export function parseSavedHudTheme(raw: string | null): SavedHudTheme {
  if (!raw) return { ...DEFAULT_HUD_THEME };
  try {
    const parsed = JSON.parse(raw) as Partial<SavedHudTheme> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_HUD_THEME };
    const mode = parsed.mode && VALID_MODES.has(parsed.mode) ? parsed.mode : DEFAULT_HUD_THEME.mode;
    const accentId =
      parsed.accentId && VALID_ACCENTS.has(parsed.accentId)
        ? parsed.accentId
        : DEFAULT_HUD_THEME.accentId;
    const customHex =
      typeof parsed.customHex === "string"
        ? normalizeHexColor(parsed.customHex, DEFAULT_HUD_THEME.customHex)
        : DEFAULT_HUD_THEME.customHex;
    return { mode, accentId, customHex };
  } catch {
    return { ...DEFAULT_HUD_THEME };
  }
}

/** Loads the per-device HUD theme from localStorage without throwing in restricted contexts. */
export function loadSavedHudTheme(): SavedHudTheme {
  if (typeof window === "undefined") return { ...DEFAULT_HUD_THEME };
  try {
    return parseSavedHudTheme(window.localStorage.getItem(HUD_THEME_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_HUD_THEME };
  }
}

/** Applies CSS custom properties, mode attribute, color-scheme, and PWA theme-color to document root. */
export function applyHudThemeToDocument(theme: SavedHudTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = resolveThemeCssVariables(theme);
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
  root.dataset.hudMode = theme.mode;
  root.classList.toggle("dark", theme.mode !== "light");
  root.style.colorScheme = theme.mode === "light" ? "light" : "dark";

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", vars["--hud-bg"] ?? "#000000");
  }
}

/** Persists the device theme and notifies other windows (e.g., Desktop Control Center -> Overlay). */
export function saveHudTheme(theme: SavedHudTheme): void {
  const normalized: SavedHudTheme = {
    mode: VALID_MODES.has(theme.mode) ? theme.mode : DEFAULT_HUD_THEME.mode,
    accentId: VALID_ACCENTS.has(theme.accentId) ? theme.accentId : DEFAULT_HUD_THEME.accentId,
    customHex: normalizeHexColor(theme.customHex, DEFAULT_HUD_THEME.customHex),
  };
  applyHudThemeToDocument(normalized);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HUD_THEME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota or sandbox errors
  }
  window.dispatchEvent(new CustomEvent<SavedHudTheme>(THEME_CHANGE_EVENT, { detail: normalized }));
}

/** Initializes DOM variables synchronously before first React paint to avoid theme flash. */
export function initHudThemeOnDom(): SavedHudTheme {
  const theme = loadSavedHudTheme();
  applyHudThemeToDocument(theme);
  return theme;
}

/** Subscribes to theme updates across both same-window and cross-window localStorage changes. */
export function subscribeHudThemeChanges(listener: (theme: SavedHudTheme) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== HUD_THEME_STORAGE_KEY) return;
    const next = parseSavedHudTheme(ev.newValue);
    applyHudThemeToDocument(next);
    listener(next);
  };

  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<SavedHudTheme>).detail;
    if (detail) listener(detail);
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onCustom);
  };
}
