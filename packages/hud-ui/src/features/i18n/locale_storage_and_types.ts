export type HudLocale = "pt-BR" | "en";

export const DEFAULT_HUD_LOCALE: HudLocale = "pt-BR";
export const HUD_LOCALE_STORAGE_KEY = "exile_hud_locale_v1";
const LOCALE_CHANGE_EVENT = "exile-hud-locale-change";

/** Parses a persisted locale string with safe fallback to Portuguese (Brazil). */
export function parseSavedHudLocale(raw: string | null): HudLocale {
  if (!raw) return DEFAULT_HUD_LOCALE;
  const trimmed = raw.trim();
  if (trimmed === "en") return "en";
  if (trimmed === "pt-BR") return "pt-BR";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === "en") return "en";
    if (parsed === "pt-BR") return "pt-BR";
  } catch {
    // Plain-string values are valid too
  }
  return DEFAULT_HUD_LOCALE;
}

/** Loads the per-device HUD locale from localStorage without throwing in SSR/Node. */
export function loadSavedHudLocale(): HudLocale {
  if (typeof window === "undefined") return DEFAULT_HUD_LOCALE;
  try {
    return parseSavedHudLocale(window.localStorage.getItem(HUD_LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_HUD_LOCALE;
  }
}

/** Updates `<html lang>` on the active document root. */
export function applyHudLocaleToDocument(locale: HudLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

/** Persists the device locale and notifies same-window and cross-window listeners. */
export function saveHudLocale(locale: HudLocale): void {
  const normalized: HudLocale = locale === "en" ? "en" : "pt-BR";
  applyHudLocaleToDocument(normalized);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HUD_LOCALE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage quota or sandbox errors
  }
  window.dispatchEvent(new CustomEvent<HudLocale>(LOCALE_CHANGE_EVENT, { detail: normalized }));
}

/** Initializes document `lang` synchronously before first React paint. */
export function initHudLocaleOnDom(): HudLocale {
  const locale = loadSavedHudLocale();
  applyHudLocaleToDocument(locale);
  return locale;
}

/** Subscribes to locale changes across both same-window events and cross-window storage updates. */
export function subscribeHudLocaleChanges(listener: (locale: HudLocale) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== HUD_LOCALE_STORAGE_KEY) return;
    const next = parseSavedHudLocale(ev.newValue);
    applyHudLocaleToDocument(next);
    listener(next);
  };

  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<HudLocale>).detail;
    if (detail === "pt-BR" || detail === "en") listener(detail);
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCALE_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onCustom);
  };
}
