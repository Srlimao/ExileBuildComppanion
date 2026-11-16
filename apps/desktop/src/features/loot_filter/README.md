# `loot_filter` Domain

Provides 1-click installation of baked per-league NeverSink starter loot filters (`1-REGULAR`, `2-SEMI-STRICT`, or both) directly from the desktop Control Center's **PoB (`build`)** tab:
- **Build-Time Baking (`scripts/ingest_neversink_loot_filter.mjs`):** Downloads and caches MIT-licensed `NeverSinkDev/NeverSink-Filter` releases per league tag, writing `.filter` files under `packages/game-data/data/poe1/filters/` and lightweight metadata (`league_starter_filter_meta.json`) exported via `@exile-hud/game-data`.
- **Self-Contained Rust Installer (`apps/desktop/src-tauri/src/features/loot_filter_store/local_loot_filter_installer.rs`):** Embeds the baked `.filter` assets via `include_str!`, resolves the active PoE filter directory (`Documents/My Games/Path of Exile` with OneDrive fallback), and performs atomic writes.
- **Desktop UI (`league_starter_filter_card.tsx`, `loot_filter_types_and_ipc.ts`):** Lets the user pick `1 - Regular (Campaign)`, `2 - Semi-Strict (Early Maps)`, or `Both`, install with one click, and open the target PoE filter folder.
