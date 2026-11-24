import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DESKTOP_BUILD_LIBRARY_MESSAGES,
  type DesktopBuildLibraryMessages,
} from "./desktop_build_library_messages.js";
import {
  DESKTOP_OVERLAY_AND_UPDATER_MESSAGES,
  type DesktopOverlayAndUpdaterMessages,
} from "./desktop_overlay_and_updater_messages.js";
import { DESKTOP_CONTROL_MESSAGES, type DesktopControlMessages } from "./desktop_surface_messages.js";
import { HUD_A11Y_MESSAGES, type HudA11yMessages } from "./hud_a11y_messages.js";
import { HUD_SHELL_AND_TREE_MESSAGES, type HudShellAndTreeMessages } from "./hud_shell_messages.js";
import { HUD_WIDGET_MESSAGES, type HudWidgetsMessages } from "./hud_widgets_messages.js";
import {
  applyHudLocaleToDocument,
  DEFAULT_HUD_LOCALE,
  loadSavedHudLocale,
  saveHudLocale,
  subscribeHudLocaleChanges,
  type HudLocale,
} from "./locale_storage_and_types.js";
import { POE2_SURFACE_MESSAGES, type Poe2SurfaceMessages } from "./poe2_surface_messages.js";
import { PWA_SURFACE_MESSAGES, type PwaSurfaceMessages } from "./pwa_surface_messages.js";

export type HudMessagesBundle = HudShellAndTreeMessages & {
  widgets: HudWidgetsMessages;
  a11y: HudA11yMessages;
};
export type DesktopSurfaceMessages = DesktopControlMessages &
  DesktopOverlayAndUpdaterMessages &
  DesktopBuildLibraryMessages;

export interface AppMessagesBundle {
  legalDisclaimer: string;
  pwa: PwaSurfaceMessages;
  desktop: DesktopSurfaceMessages;
  poe2: Poe2SurfaceMessages;
}

export interface HudI18nContextValue {
  locale: HudLocale;
  isPtBr: boolean;
  setLocale: (next: HudLocale) => void;
  msg: HudMessagesBundle;
  appMsg: AppMessagesBundle;
}

function buildContextValue(locale: HudLocale, setLocale: (next: HudLocale) => void): HudI18nContextValue {
  const shell = HUD_SHELL_AND_TREE_MESSAGES[locale];
  const widgets = HUD_WIDGET_MESSAGES[locale];
  const a11y = HUD_A11Y_MESSAGES[locale];
  const pwa = PWA_SURFACE_MESSAGES[locale];
  const poe2 = POE2_SURFACE_MESSAGES[locale];
  const desktop = {
    ...DESKTOP_CONTROL_MESSAGES[locale],
    ...DESKTOP_OVERLAY_AND_UPDATER_MESSAGES[locale],
    ...DESKTOP_BUILD_LIBRARY_MESSAGES[locale],
  };
  return {
    locale,
    isPtBr: locale === "pt-BR",
    setLocale,
    msg: { ...shell, widgets, a11y },
    appMsg: { legalDisclaimer: pwa.legalDisclaimer, pwa, desktop, poe2 },
  };
}

const DEFAULT_CONTEXT_VALUE = buildContextValue(DEFAULT_HUD_LOCALE, () => undefined);
const HudI18nContext = createContext<HudI18nContextValue>(DEFAULT_CONTEXT_VALUE);

/** Provides reactive per-device PT-BR / EN localization backed by localStorage persistence. */
export function HudI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<HudLocale>(() => loadSavedHudLocale());

  useEffect(() => {
    applyHudLocaleToDocument(locale);
  }, [locale]);

  useEffect(() => {
    return subscribeHudLocaleChanges((next) => setLocaleState(next));
  }, []);

  const setLocale = useCallback((next: HudLocale) => {
    const normalized: HudLocale = next === "en" ? "en" : "pt-BR";
    setLocaleState(normalized);
    saveHudLocale(normalized);
  }, []);

  const value = useMemo(() => buildContextValue(locale, setLocale), [locale, setLocale]);

  return <HudI18nContext.Provider value={value}>{children}</HudI18nContext.Provider>;
}

/** Reads the active HUD locale, setter, and typed bilingual message bundles. */
export function useHudI18n(): HudI18nContextValue {
  return useContext(HudI18nContext);
}
