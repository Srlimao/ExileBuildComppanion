# `overlay_hud` & `overlay_window` Domain

Renders a local, floating, dockable, click-through-lockable PC in-game overlay inside `@exile-hud/desktop` without touching Cloudflare Workers, Durable Objects, or browser PWA `localStorage`.

## Architecture & Isolation Invariants

- **In-Process Zero-Cloudflare Sync (`overlay_local_bus.ts`):**
  - Both the Control Center (`main`) and Overlay (`overlay`, loaded at `index.html?window=overlay`) share the same Tauri WebView2 origin.
  - Telemetry snapshots (`main -> overlay`) and user commands (`overlay -> main`: manual checkpoint/gem toggles, regex copy, character sync, PoELab daily JSON import) travel exclusively over `BroadcastChannel("exile_local_hud_bus_v1")`.
  - Manual checks performed in the PC overlay update `saved_campaign_progress.json` directly on disk via `useDesktopHostController`.
- **Isolated Overlay Storage (`saved_overlay_config.json`):**
  - Rust `overlay_config_disk_store.rs` persists overlay visibility, `clickThroughLocked`, `pinOnDesktop`, `opacityPercent`, `dockPreset` (`top-left`, `top-right`, `bottom-left`, `bottom-right`, `left-edge`, `right-edge`, `free`), clamped pixel `bounds`, `F7`/`F8` hotkeys, and per-mode `modeLayouts` (`FIELD`, `TOWN`, `LAB`, `TREE_COMPACT`) atomically inside `%LOCALAPPDATA%\com.dunhas.exilecompanion\saved_overlay_config.json`.
  - Cloudflare `room_layouts` and PWA `exile_hud_widget_layouts_v1` remain completely untouched.
- **Win32 Click-Through & Focus-Safe Visibility (`overlay_window_controller.rs`):**
  - Click-through lock toggles `set_ignore_cursor_events(true/false)` via `F8`, the System Tray menu, or Control Center.
  - Auto-visibility hides the overlay on Alt-Tab unless `pinOnDesktop` is enabled, keeping it visible whenever Path of Exile or the Control Center/Overlay process holds foreground focus and re-showing via `SetWindowPos(..., SWP_NOACTIVATE | SWP_SHOWWINDOW)` so PoE never loses game input focus.
  - Pressing `P` in-game defaults the overlay to compact `TREE_COMPACT` mode (so PoE's passive tree stays uncovered), with an optional `Expand Tree` toggle to open the full interactive tree canvas.
