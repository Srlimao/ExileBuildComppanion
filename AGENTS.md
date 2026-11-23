# AGENTS.md

Engineering guardrails and repository context for AI coding agents working in `ExileBuildHelper` (`Exile Companion HUD`).

> Read the relevant feature `README.md` (indexed at the bottom of this file) and [poe_companion_hud_architecture_ux_spec.md](poe_companion_hud_architecture_ux_spec.md) before modifying non-trivial domains.

---

## 1. Monorepo Architecture & Build Order

| Package / App | Name in `package.json` | Output / Runtime | Notes |
| --- | --- | --- | --- |
| `packages/game-data` | `@exile-hud/game-data` | Exports `src/index.ts` directly (**no `dist/` build step**) | Consumed directly by Vite/Vitest/`tsc` workspace resolution; static JSON/datasets under `packages/game-data/data/poe1/` |
| `packages/core` | `@exile-hud/core` | Compiles to `dist/` via `tsc -p tsconfig.json` | Pure TypeScript domain engine + Zod wire protocol; **must be built before `pwa` or `desktop` `tsc -b` builds** |
| `packages/hud-ui` | `@exile-hud/hud-ui` | Exports `src/index.ts` directly (**no `dist/` build step**) | Shared React 19 HUD widgets, modular grid engine, and passive tree visualizer consumed by both `pwa` and `desktop` |
| `apps/edge-worker` | `@exile-hud/edge-worker` | Cloudflare Worker + Hibernating `SessionRoomDurableObject` | Deployed via root `wrangler.jsonc` (`name: "exilebuildcomppanion"`, serving `./apps/pwa/dist` as static `ASSETS` and `/api/*` + WS routes) |
| `apps/pwa` | `@exile-hud/pwa` | React 19 + Tailwind CSS v4 + Vite + Workbox PWA | Second-screen HUD (`FIELD`, `TOWN`, `LAB`, `TREE`, `STANDBY`); supports offline `?demo=1` mode |
| `apps/desktop` | `@exile-hud/desktop` | Tauri v2 Rust host (`src-tauri/`) + React 19 coordinator (`src/`) | Runs in Windows System Tray; bundles native `Client.txt` tailing, PoE process monitor, GGG HTTP sync, hotkey watcher, and local AppData JSON stores |
| `scripts` | — | Node ESM scripts | Asset ingestion (`ingest_upstream_game_assets.mjs`, `ingest_ggg_passive_tree.mjs`), icon generation, and `verify_max_file_lines.mjs` |

Use `pnpm run build:all` so `@exile-hud/core` compiles before `@exile-hud/pwa` and `@exile-hud/desktop`.

---

## 2. Hard Structural Rules (CI-Enforced)

1. **Strict `< 300`-Line File Ceiling:**
   - Every `.ts`, `.tsx`, `.rs`, `.mjs`, and `.css` file under `packages/`, `apps/`, and `scripts/` MUST contain **fewer than 300 lines** (`pnpm run check:lines` runs `node scripts/verify_max_file_lines.mjs`, which fails CI at `>= 300` lines).
   - Keep files cohesive (~80–240 lines ideal) and **extract a focused domain module before a file crosses ~270 lines**.
   - **Current hotspot files near the ceiling** (split before adding features):
     - `apps/edge-worker/tests/session_room_e2e.test.ts`
     - `apps/pwa/src/features/pairing_and_connection/edge_websocket_room_client.ts`
     - `packages/hud-ui/src/features/i18n/pwa_surface_messages.ts`
     - `apps/desktop/src/features/build_library/build_library_editor_panel.tsx`
     - `packages/core/src/features/checkpoint_graph/checkpoint_progression_reducer.ts`
     - `packages/core/src/features/route_compiler/route_fragment_ast_parser.ts`
2. **Vertical Slicing (`features/<domain>/`):**
   - Organize new functionality inside domain slices (e.g., `packages/core/src/features/route_compiler/`, `apps/pwa/src/features/passive_tree_visualizer/`, `apps/desktop/src-tauri/src/features/client_log_watcher/`), keeping UI components, state hooks/reducers, pure geometry/math, and I/O adapters cleanly separated.
   - Do **not** create generic catch-all files such as `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts`. Name every file after its concrete domain responsibility.
3. **Preserve `@exile-hud/core` Purity:**
   - Keep `packages/core` free of DOM (`window`, `document`, `localStorage`), Node-only (`fs`), or Tauri IPC imports so every engine module runs identically in Browser PWA, Cloudflare Worker, Tauri WebView, and Vitest.

---

## 3. UI/UX & Gameplay Invariants

- **OLED Dark-First + DM Sans Design System:**
  - `apps/pwa/src/index.css` defines `--font-sans: "DM Sans", ...` on a pure-black OLED canvas (`#000000` body, `#09090B` / `#18181B` cards, subtle `border-zinc-800` / `border-white/10` hairlines, standardized compact corner radii).
  - Reserve monospace fonts strictly for vendor regex strings, room PINs, timers, hashes, and code IDs.
  - Keep gem/quest color coding consistent and high-contrast: Red (`R`), Green (`G`), Blue (`B`), White (`W`), Quest Gold.
- **Read-Only `TREE` Mode:**
  - `passive_tree_visualizer` is strictly **read-only** telemetry (no manual passive node click-to-allocate or respec manipulation). Allocation state comes from PoB/GGG Character API diffs, while initial view framing zooms around the immediate next unallocated passives (`computeNextPassivesBounds`) and persists pan/zoom per `profileId` + bracket `specKey`.
- **No Unwanted Memory/Macro Creep:**
  - Never add PoE process memory reading, network packet capture, or automated keyboard/mouse input injection. Foreground key-state polling (`foreground_poe_hotkey_poller.rs`) exists solely to toggle companion view mode (`TREE` <-> field/town), with chat-open (`Enter`/`Esc`) guards.
- **Desktop Build Library ("One Save, One Progression"):**
  - The desktop Control Center opens on the `Builds` tab (`builds | overlay | connect | game`). Each saved build `.json` under `builds/` owns independent campaign progress, `runElapsedMs`, `actSplitsMs`, and linked character/league. Switching builds MUST flush outgoing progress first and compile with `carryProgressFromPrevious: false`. Do not add a local PoB `Documents/Path of Building/Builds` `.xml` folder importer unless explicitly requested.
- **Desktop Control Center ("Precision Tray Companion"):**
  - Keep the `main` window compact (`460 × 640`, `minWidth: 420`, `minHeight: 540` in `apps/desktop/src-tauri/tauri.conf.json`) using a fixed `h-screen` shell (`DesktopControlHeader` with `HUD` toggle, `QuickQrPairPopover`, `ThemeSelectorPopover`, and 4-segment `builds | overlay | connect | game` nav; scrollable `<main>`; pinned slim `DesktopUpdateFooterBar` expanding to an accent CTA only when an update is available).
  - Enforce progressive disclosure across desktop tabs: unify active build info, progress bar, and 2-step reset inside `ActiveBuildRunCard` on `Builds` only (preserving `data-testid="pc-reset-progress-btn"`, `pc-confirm-reset-progress-btn`, and `pc-cancel-reset-progress-btn`); keep build/folder rows to 2 lines with `⋯` overflow menus; keep the Build Editor split into `PoB & Sets` / `Character & Notes`; keep `LeagueStarterFilterCard` and collapsed-by-default `CampaignSimulatorDrawer` under `Game`; keep `Advanced Relay URL` collapsed under `Connect` (`Second Screen` | `GGG Character`); and place raw disk paths (`rootDir`, `filterDir`) in icon tooltips instead of footer text.
- **Android PWA Auto-Reconnect & Mobile WebSocket Resilience:**
  - Installed Android PWAs undergo OS eviction, Workbox `autoUpdate` reloads, and silent TCP suspension. Preserve `exile_hud_recent_room_session_v1` + 24h `exile_hud_last_snapshot_v1` auto-reconnect on cold start (disabling `autoConnect` only when the user manually opens Pairing / switches rooms), keep `visibilitychange`/`online`/`pageshow`/`focus` recovery probes, ping/pong watchdogs, and socket generation guards (`this.socket !== ws`) in `EdgeWebSocketRoomClient`, and stop auto-retry cleanly on `4003` (clear stale PIN, keep room code) and `4001` (disable `autoConnect`).

---

## 4. Security, Privacy & Persistence Boundaries

- **No Session Cookies & Auth-Token Edge Guard (CRITICAL):**
  - Browser session cookies are never collected, stored, or transmitted anywhere (per GGG API policy); `character_window_http_poller.rs` queries public `www.pathofexile.com` character profiles only.
  - **Never** include OAuth tokens or secrets (`access_token`, `refresh_token`, `client_secret`, `code_verifier`) in `HudSessionSnapshot`, WebSocket frames, worker logs, localStorage, or `builds/**/*.json` / `saved_pob_profile.json` / `saved_campaign_progress.json`. (Storing the rotatable 4-digit room pairing PIN in `exile_hud_recent_room_session_v1` / `exile_room_pin` is permitted for pairing UX; never store OAuth tokens or cookies.)
  - `apps/edge-worker/src/features/session_room/session_room_durable_object.ts` enforces HTTP `400` / close code `1008` if any inbound payload contains forbidden auth token fields. Keep that guard intact and covered by E2E tests.
- **Backwards-Compatible Storage & Wire Protocol:**
  - Wire schema changes belong in `packages/core/src/features/protocol/session_room_wire_protocol.ts` using Zod schemas shared across desktop, worker, and PWA.
  - Durable Object SQLite schema in `apps/edge-worker/src/features/session_room/session_room_sqlite_repository.ts` (`room_meta`, `room_snapshot`, `room_layouts`) must remain backwards-compatible for existing rooms.
  - PC AppData stores (`builds/**/*.json`, `build_library_state.json`, plus non-destructive 1-time migration from legacy `saved_pob_profile.json` and `saved_campaign_progress.json`) and browser `localStorage` keys (`exile_hud_tree_viewport_v1`, `exile_hud_widget_layouts_v1`, `exile_hud_demo_progress_v1`, `exile_hud_recent_room_v1`, `exile_hud_recent_room_session_v1`, `exile_hud_last_snapshot_v1`, `exile_build_library_v1`, `exile_room_*` host prefs) must preserve compatibility or provide migration fallbacks (e.g., `extractLegacyQuestKeySet` in `campaign_progress_persistence.ts`) when key formats evolve.

---

## 5. Verification & Environment Gotchas

Run all applicable checks after edits (and re-run after final edits):

```bash
pnpm run check:lines                                      # Mandatory <300-line check across all 228+ files
pnpm test                                                 # Core, edge-worker, pwa, and desktop Vitest suites
pnpm run build:all                                        # Type-check & production build (core -> pwa & desktop)
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml   # Required whenever Rust code or tauri.conf.json changes
```

**Known Gotchas:**
- **Windows PowerShell 5.1 command chaining:** Default `powershell` on this machine does not support `&&`. Chain sequential commands with `; if ($LASTEXITCODE -eq 0) { ... }` instead.
- **Windows NTFS case-only renames in Rust:** On case-insensitive NTFS, `foo.json` and `Foo.json` share an inode — never write the target and delete `old_path` when `old.eq_ignore_ascii_case(new)`. Route case-only file/folder renames through an intermediate temp/backup path.
- **Node ad-hoc scripts importing `@exile-hud/game-data`:** `packages/game-data` has no `dist/` build output, so raw `node -e` importing TS files will fail with `ERR_MODULE_NOT_FOUND`. Run checks through Vitest (`pnpm --filter @exile-hud/core test`) or read the `.json` files directly.
- **Desktop preview command:** `apps/desktop/package.json` defines `dev`, `build`, and `tauri` (no `preview` script). To preview its built frontend directly, run `pnpm --filter @exile-hud/desktop exec vite preview --host 127.0.0.1 --port 4174 --strictPort`.
- **PWA Service Worker cache during local/prod UI checks:** `@exile-hud/pwa` ships a Workbox Service Worker (`dist/sw.js`). When testing freshly built PWA bundles locally (`vite preview`) or in production (`?demo=1`), unregister existing service workers via `navigator.serviceWorker.getRegistrations()` before reloading so stale cached assets do not mask changes.
- **GitHub & Remote Safety:** Never push to GitHub, create tags/releases, or deploy without explicit user request and confirmation.
- **Windows concurrent same-file edits:** Do not issue parallel `edit_file` calls targeting the same file path on Windows (can fail with `"user-mapped section open"`); edit distinct files in parallel or apply multiple edits to one file sequentially.

---

## 6. CI/CD & Release Automation

- **CI (`.github/workflows/ci.yml`):** Triggers on `push` / `pull_request` to `main`. Runs `pnpm run check:lines`, `pnpm run build:all`, and `pnpm test` on `ubuntu-latest`, plus desktop Vite build and `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` on `windows-latest`.
- **Cloudflare Worker (`wrangler.jsonc`):** Pushing to `main` triggers Cloudflare Workers Builds to deploy `exilebuildcomppanion` (`https://exile.dunhas.com`), serving both the built PWA static bundle (`./apps/pwa/dist`) and the `SessionRoomDurableObject` WebSocket/API routes. Local non-interactive shells generally do not hold Cloudflare credentials; avoid committing secrets into `wrangler.jsonc`.
- **Windows Desktop Release (`.github/workflows/release-desktop.yml`):** Pushing changes under `apps/desktop/**`, `packages/core/**`, `packages/game-data/**`, `packages/hud-ui/**`, `apps/pwa/public/**`, or `scripts/generate_tauri_icons.mjs` to `main` (or manual `workflow_dispatch`) stamps `v0.1.<run_number>`, builds `ExileRelay.exe`, `ExileRelay-Setup.exe`, `ExileCompanionHUD.exe`, `ExileCompanionHUD-Setup.exe`, and `SHA256SUMS.txt`, and publishes the latest GitHub Release.

---

## 7. Feature Slice Documentation Index

- System & UX Specification: [poe_companion_hud_architecture_ux_spec.md](poe_companion_hud_architecture_ux_spec.md)
- Checkpoint Graph & Progress Persistence: [packages/core/src/features/checkpoint_graph/README.md](packages/core/src/features/checkpoint_graph/README.md)
- PoB Decoder & Set Filtering: [packages/core/src/features/pob_import/README.md](packages/core/src/features/pob_import/README.md)
- Route Preprocessor, AST & Gem Assigner: [packages/core/src/features/route_compiler/README.md](packages/core/src/features/route_compiler/README.md)
- Edge Durable Object Relay & SQLite: [apps/edge-worker/src/features/session_room/README.md](apps/edge-worker/src/features/session_room/README.md)
- Passive Tree Visualizer (`TREE` Mode): [packages/hud-ui/src/features/passive_tree_visualizer/README.md](packages/hud-ui/src/features/passive_tree_visualizer/README.md)
- Modular Widget Grid Engine: [packages/hud-ui/src/features/widget_grid_engine/README.md](packages/hud-ui/src/features/widget_grid_engine/README.md)
- Desktop Coordinator & Tauri IPC Bridge: [apps/desktop/src/features/host_coordinator/README.md](apps/desktop/src/features/host_coordinator/README.md)
- Desktop PoB-Style Build Library: [apps/desktop/src/features/build_library/README.md](apps/desktop/src/features/build_library/README.md)
- Desktop Local PC Overlay HUD: [apps/desktop/src/features/overlay_hud/README.md](apps/desktop/src/features/overlay_hud/README.md)
- Desktop Auto-Updater (`Portable` & `NSIS Setup`): [apps/desktop/src/features/auto_updater/README.md](apps/desktop/src/features/auto_updater/README.md)
- Planned Next Features Roadmap: [NEXT_FEATURES.md](NEXT_FEATURES.md)
