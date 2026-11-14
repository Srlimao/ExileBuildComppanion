# HUD Theme Feature Slice (`@exile-hud/hud-ui`)

Per-device visual theme system supporting `oled`, `soft-dark`, and `light` surfaces, 6 curated accent swatches (`chalk` default), and custom hex color selection with WCAG luminance safety.

- **Local-Only Persistence:** Stored exclusively in `localStorage["exile_hud_theme_v1"]` and synchronized across same-origin windows (e.g., Desktop Control Center and Local PC Overlay) via `storage` events. Never serialized into `HudSessionSnapshot` or Cloudflare Durable Object frames.
- **Gameplay Color Invariants:** Socket colors (`R`, `G`, `B`, `W`), resistance elements, and Quest Gold retain recognizable PoE semantics while shifting brightness in `light` mode (`--hud-socket-ring` outlines white sockets).
- **Transparent Overlay Compatibility:** `applyHudThemeToDocument` mutates CSS custom properties on `document.documentElement` without overwriting inline `body` background styles.
- **UI Entrypoints:** `ThemeAppearanceControls` renders the inline Surface, Accent, and Custom Hex controls for drawers/panels (used inside the PWA Settings Drawer), while `ThemeSelectorPopover` wraps those controls in a compact dropdown popover for Desktop Control Center and PC Overlay dock bars.
