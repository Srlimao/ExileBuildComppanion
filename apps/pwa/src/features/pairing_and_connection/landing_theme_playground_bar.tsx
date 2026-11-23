import {
  HUD_ACCENT_SWATCHES,
  ThemeSelectorPopover,
  useHudI18n,
  useHudTheme,
  type HudAppearanceMode,
  type HudLocale,
} from "@exile-hud/hud-ui";

const SURFACE_MODE_IDS: ReadonlyArray<HudAppearanceMode> = ["oled", "soft-dark", "light"];
const LOCALE_PILLS: ReadonlyArray<{ id: HudLocale; label: string }> = [
  { id: "pt-BR", label: "PT" },
  { id: "en", label: "EN" },
];

/** Compact inline language, surface + PoE accent color playground bar for the landing header. */
export function LandingThemePlaygroundBar() {
  const { theme, setMode, setAccentId } = useHudTheme();
  const { locale, setLocale, msg } = useHudI18n();

  return (
    <div
      data-testid="landing-theme-playground"
      className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-hud-surface border border-hud-hairline px-2.5 py-1.5"
    >
      <div className="inline-flex items-center gap-0.5" role="group" aria-label={msg.theme.languageLabel}>
        {LOCALE_PILLS.map((opt) => {
          const active = locale === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              data-testid={`landing-locale-${opt.id}`}
              onClick={() => setLocale(opt.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] leading-none transition-colors cursor-pointer ${
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

      <span className="h-3.5 w-px bg-hud-hairline" aria-hidden="true" />

      <div className="inline-flex items-center gap-0.5" role="group" aria-label={msg.theme.surfaceLabel}>
        {SURFACE_MODE_IDS.map((modeId) => {
          const active = theme.mode === modeId;
          return (
            <button
              key={modeId}
              type="button"
              aria-pressed={active}
              data-testid={`landing-mode-${modeId}`}
              onClick={() => setMode(modeId)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] leading-none transition-colors cursor-pointer ${
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

      <span className="h-3.5 w-px bg-hud-hairline" aria-hidden="true" />

      <div className="inline-flex items-center gap-0.5" role="group" aria-label={msg.theme.accentLabel}>
        {HUD_ACCENT_SWATCHES.map((swatch) => {
          const selected = theme.accentId === swatch.id;
          const dotColor = theme.mode === "light" ? swatch.lightHex : swatch.darkHex;
          const label = msg.theme.swatches[swatch.id] ?? swatch.label;
          return (
            <button
              key={swatch.id}
              type="button"
              aria-pressed={selected}
              data-testid={`landing-accent-${swatch.id}`}
              aria-label={`${msg.theme.accentLabel} ${label}`}
              title={label}
              onClick={() => setAccentId(swatch.id)}
              className="h-7 w-7 rounded-full inline-flex items-center justify-center cursor-pointer"
            >
              <span
                className={`h-4 w-4 rounded-full block transition-transform ${
                  selected ? "scale-110" : "opacity-80 hover:opacity-100 hover:scale-105"
                }`}
                style={{
                  backgroundColor: dotColor,
                  boxShadow: selected
                    ? "0 0 0 2px var(--hud-surface), 0 0 0 3px var(--hud-text)"
                    : "0 0 0 1px var(--hud-hairline)",
                }}
              />
            </button>
          );
        })}
      </div>

      <span className="h-3.5 w-px bg-hud-hairline" aria-hidden="true" />

      <ThemeSelectorPopover compact />
    </div>
  );
}
