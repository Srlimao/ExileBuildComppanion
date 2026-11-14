import { Contrast, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHudTheme } from "./hud_theme_provider.js";
import { ThemeAppearanceControls } from "./theme_appearance_controls.js";

/** Compact Whisper theme popover for toggling OLED / Soft Dark / Light Mode and accent colors. */
export function ThemeSelectorPopover({ compact = false }: { compact?: boolean }) {
  const { theme } = useHudTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const ModeIcon = theme.mode === "light" ? Sun : theme.mode === "soft-dark" ? Contrast : Moon;

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        data-testid="hud-theme-trigger"
        aria-expanded={open}
        aria-label="Theme and appearance settings"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md transition-colors cursor-pointer hover:bg-hud-subtle text-hud-muted hover:text-hud-text ${
          compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
        }`}
        title="Appearance & Accent Color"
      >
        <ModeIcon className="h-3.5 w-3.5" />
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{
            backgroundColor: "var(--hud-accent)",
            boxShadow: "0 0 0 1px var(--hud-hairline)",
          }}
        />
        {!compact && <span className="hidden sm:inline font-medium">Theme</span>}
      </button>

      {open && (
        <div
          data-testid="hud-theme-popover"
          className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl bg-hud-surface border border-hud-hairline p-3.5 shadow-2xl"
        >
          <ThemeAppearanceControls />
        </div>
      )}
    </div>
  );
}
