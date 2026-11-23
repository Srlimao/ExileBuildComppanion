import { Languages, Palette } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import type { HudLocale } from "../i18n/locale_storage_and_types.js";
import { useHudTheme } from "./hud_theme_provider.js";
import { HUD_ACCENT_SWATCHES, type HudAppearanceMode } from "./theme_tokens_and_palettes.js";

const MODE_IDS: readonly HudAppearanceMode[] = ["oled", "soft-dark", "light"];
const LOCALE_OPTIONS: ReadonlyArray<{ id: HudLocale; label: string }> = [
  { id: "pt-BR", label: "PT-BR" },
  { id: "en", label: "EN" },
];

/** Inline language, surface mode, curated accent swatch, and custom hex appearance controls. */
export function ThemeAppearanceControls() {
  const { theme, setMode, setAccentId, setCustomHex } = useHudTheme();
  const { locale, setLocale, msg } = useHudI18n();

  const activeSwatch =
    theme.accentId === "custom"
      ? theme.customHex.toUpperCase()
      : msg.theme.swatches[theme.accentId] ?? msg.theme.swatches.chalk;

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
          <Languages className="h-3.5 w-3.5" />
          <span>{msg.theme.languageLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 border-b border-hud-hairline pb-2">
          {LOCALE_OPTIONS.map((opt) => {
            const active = locale === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                data-testid={`hud-locale-${opt.id}`}
                onClick={() => setLocale(opt.id)}
                className={`py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  active
                    ? "bg-hud-accent text-hud-accent-fg font-semibold"
                    : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.theme.surfaceLabel}
        </div>
        <div className="grid grid-cols-3 gap-1 border-b border-hud-hairline pb-2">
          {MODE_IDS.map((modeId) => {
            const active = theme.mode === modeId;
            return (
              <button
                key={modeId}
                type="button"
                aria-pressed={active}
                data-testid={`hud-mode-${modeId}`}
                onClick={() => setMode(modeId)}
                className={`py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  active
                    ? "bg-hud-accent text-hud-accent-fg font-semibold"
                    : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
                }`}
              >
                {msg.theme.modes[modeId]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-[0.12em] text-hud-muted">
            {msg.theme.accentLabel}
          </span>
          <span className="text-hud-dim font-mono">{activeSwatch}</span>
        </div>

        <div className="flex items-center justify-between gap-1">
          {HUD_ACCENT_SWATCHES.map((swatch) => {
            const selected = theme.accentId === swatch.id;
            const dotColor = theme.mode === "light" ? swatch.lightHex : swatch.darkHex;
            const label = msg.theme.swatches[swatch.id] ?? swatch.label;
            return (
              <button
                key={swatch.id}
                type="button"
                aria-pressed={selected}
                data-testid={`hud-accent-${swatch.id}`}
                aria-label={label}
                title={label}
                onClick={() => setAccentId(swatch.id)}
                className="h-8 w-8 rounded-full cursor-pointer flex items-center justify-center"
              >
                <span
                  className={`h-5 w-5 rounded-full block transition-transform ${
                    selected ? "scale-110" : "hover:scale-105 opacity-85 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: selected
                      ? "0 0 0 2px var(--hud-surface), 0 0 0 3.5px var(--hud-text)"
                      : "0 0 0 1px var(--hud-hairline)",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline text-xs cursor-pointer">
        <span className="inline-flex items-center gap-1.5 text-hud-muted">
          <Palette className="h-3.5 w-3.5" />
          <span>{msg.theme.customHexLabel}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-[11px] text-hud-text uppercase">{theme.customHex}</span>
          <input
            type="color"
            data-testid="hud-custom-color-input"
            value={theme.customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            className="h-5 w-7 rounded bg-transparent border-0 p-0 cursor-pointer"
          />
        </span>
      </label>
    </div>
  );
}
