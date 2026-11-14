import {
  HUD_ACCENT_SWATCHES,
  ThemeSelectorPopover,
  useHudTheme,
  type HudAppearanceMode,
} from "@exile-hud/hud-ui";

const SURFACE_MODES: ReadonlyArray<{ id: HudAppearanceMode; label: string }> = [
  { id: "oled", label: "OLED" },
  { id: "soft-dark", label: "Soft" },
  { id: "light", label: "Light" },
];

/** Compact inline surface + PoE accent color playground bar for the landing header. */
export function LandingThemePlaygroundBar() {
  const { theme, setMode, setAccentId } = useHudTheme();

  return (
    <div
      data-testid="landing-theme-playground"
      className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-hud-surface border border-hud-hairline px-2.5 py-1.5"
    >
      <div className="inline-flex items-center gap-0.5" role="group" aria-label="Surface appearance">
        {SURFACE_MODES.map((opt) => {
          const active = theme.mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`landing-mode-${opt.id}`}
              onClick={() => setMode(opt.id)}
              className={`px-2 py-1 rounded-md text-[11px] leading-none transition-colors cursor-pointer ${
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

      <div className="inline-flex items-center gap-1.5" role="group" aria-label="Accent color swatches">
        {HUD_ACCENT_SWATCHES.map((swatch) => {
          const selected = theme.accentId === swatch.id;
          const dotColor = theme.mode === "light" ? swatch.lightHex : swatch.darkHex;
          return (
            <button
              key={swatch.id}
              type="button"
              data-testid={`landing-accent-${swatch.id}`}
              aria-label={`Accent ${swatch.label}`}
              title={swatch.label}
              onClick={() => setAccentId(swatch.id)}
              className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
                selected ? "scale-110" : "opacity-80 hover:opacity-100 hover:scale-105"
              }`}
              style={{
                backgroundColor: dotColor,
                boxShadow: selected
                  ? "0 0 0 2px var(--hud-surface), 0 0 0 3px var(--hud-text)"
                  : "0 0 0 1px var(--hud-hairline)",
              }}
            />
          );
        })}
      </div>

      <span className="h-3.5 w-px bg-hud-hairline" aria-hidden="true" />

      <ThemeSelectorPopover compact />
    </div>
  );
}
