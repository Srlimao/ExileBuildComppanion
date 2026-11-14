import { Palette } from "lucide-react";
import { useHudTheme } from "./hud_theme_provider.js";
import { HUD_ACCENT_SWATCHES, type HudAppearanceMode } from "./theme_tokens_and_palettes.js";

const MODE_OPTIONS: Array<{ id: HudAppearanceMode; label: string }> = [
  { id: "oled", label: "OLED" },
  { id: "soft-dark", label: "Soft" },
  { id: "light", label: "Light" },
];

/** Inline surface mode, curated accent swatch, and custom hex appearance controls. */
export function ThemeAppearanceControls() {
  const { theme, setMode, setAccentId, setCustomHex } = useHudTheme();

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
          Surface
        </div>
        <div className="grid grid-cols-3 gap-1 border-b border-hud-hairline pb-2">
          {MODE_OPTIONS.map((opt) => {
            const active = theme.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`hud-mode-${opt.id}`}
                onClick={() => setMode(opt.id)}
                className={`py-1 rounded text-xs transition-colors cursor-pointer ${
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-[0.12em] text-hud-muted">Accent</span>
          <span className="text-hud-dim font-mono">
            {theme.accentId === "custom"
              ? theme.customHex.toUpperCase()
              : HUD_ACCENT_SWATCHES.find((s) => s.id === theme.accentId)?.label ?? "Chalk"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {HUD_ACCENT_SWATCHES.map((swatch) => {
            const selected = theme.accentId === swatch.id;
            const dotColor = theme.mode === "light" ? swatch.lightHex : swatch.darkHex;
            return (
              <button
                key={swatch.id}
                type="button"
                data-testid={`hud-accent-${swatch.id}`}
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => setAccentId(swatch.id)}
                className={`h-6 w-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                  selected ? "scale-110" : "hover:scale-105 opacity-85 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: dotColor,
                  boxShadow: selected
                    ? "0 0 0 2px var(--hud-surface), 0 0 0 3.5px var(--hud-text)"
                    : "0 0 0 1px var(--hud-hairline)",
                }}
              />
            );
          })}
        </div>
      </div>

      <label className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline text-xs cursor-pointer">
        <span className="inline-flex items-center gap-1.5 text-hud-muted">
          <Palette className="h-3.5 w-3.5" />
          <span>Custom Hex</span>
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
