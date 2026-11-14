import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyHudThemeToDocument,
  loadSavedHudTheme,
  saveHudTheme,
  subscribeHudThemeChanges,
} from "./theme_persistence_storage.js";
import {
  DEFAULT_HUD_THEME,
  resolvePassiveTreePalette,
  type HudAccentPresetId,
  type HudAppearanceMode,
  type PassiveTreeThemePalette,
  type SavedHudTheme,
} from "./theme_tokens_and_palettes.js";

interface HudThemeContextValue {
  theme: SavedHudTheme;
  treePalette: PassiveTreeThemePalette;
  setMode: (mode: HudAppearanceMode) => void;
  setAccentId: (accentId: HudAccentPresetId) => void;
  setCustomHex: (hex: string) => void;
  resetTheme: () => void;
}

const DEFAULT_CONTEXT_VALUE: HudThemeContextValue = {
  theme: DEFAULT_HUD_THEME,
  treePalette: resolvePassiveTreePalette(DEFAULT_HUD_THEME),
  setMode: () => undefined,
  setAccentId: () => undefined,
  setCustomHex: () => undefined,
  resetTheme: () => undefined,
};

const HudThemeContext = createContext<HudThemeContextValue>(DEFAULT_CONTEXT_VALUE);

/** Provides reactive Whisper theme state backed by per-device localStorage persistence. */
export function HudThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SavedHudTheme>(() => loadSavedHudTheme());

  useEffect(() => {
    applyHudThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    return subscribeHudThemeChanges((next) => setTheme(next));
  }, []);

  const updateTheme = useCallback((updater: (prev: SavedHudTheme) => SavedHudTheme) => {
    setTheme((prev) => {
      const next = updater(prev);
      saveHudTheme(next);
      return next;
    });
  }, []);

  const setMode = useCallback(
    (mode: HudAppearanceMode) => updateTheme((prev) => ({ ...prev, mode })),
    [updateTheme],
  );

  const setAccentId = useCallback(
    (accentId: HudAccentPresetId) => updateTheme((prev) => ({ ...prev, accentId })),
    [updateTheme],
  );

  const setCustomHex = useCallback(
    (customHex: string) => updateTheme((prev) => ({ ...prev, accentId: "custom", customHex })),
    [updateTheme],
  );

  const resetTheme = useCallback(() => {
    const next = { ...DEFAULT_HUD_THEME };
    saveHudTheme(next);
    setTheme(next);
  }, []);

  const treePalette = useMemo(() => resolvePassiveTreePalette(theme), [theme]);

  const value = useMemo<HudThemeContextValue>(
    () => ({ theme, treePalette, setMode, setAccentId, setCustomHex, resetTheme }),
    [theme, treePalette, setMode, setAccentId, setCustomHex, resetTheme],
  );

  return <HudThemeContext.Provider value={value}>{children}</HudThemeContext.Provider>;
}

/** Reads the active per-device HUD theme and mutators. */
export function useHudTheme(): HudThemeContextValue {
  return useContext(HudThemeContext);
}
