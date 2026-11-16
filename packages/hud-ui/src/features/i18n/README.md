# HUD Internationalization (`i18n`)

Provides lightweight, zero-dependency bilingual (`pt-BR` default + `en` toggle) localization across `@exile-hud/hud-ui`, `apps/pwa`, and `apps/desktop`.

## Storage & Cross-Window Sync

- **Key:** `exile_hud_locale_v1` in browser/WebView `localStorage` (intentionally separate from `exile_hud_theme_v1` so theme contracts remain unchanged).
- **Default:** `"pt-BR"` when missing or invalid.
- **Sync:** `saveHudLocale` updates `document.documentElement.lang`, writes `localStorage`, and dispatches `exile-hud-locale-change`. `subscribeHudLocaleChanges` listens to both same-window custom events and cross-window `storage` events (keeping Desktop Control Center and `F7` Overlay synchronized).

## Game-Entity & Protocol Invariant

- `@exile-hud/core` snapshots, WebSocket frames, and Durable Object SQLite remain strictly canonical and untranslated.
- All Path of Exile proper nouns (quests, areas, bosses, NPCs, gems, items, mods, currencies, passive node names/stats, classes, and regex strings) plus PoE community terms (`Waypoint`, `Trial`, `Links`, `Respec`, `Regex`, `PoB`, `Swap`, `Darkshrine`, `Golden Door`) remain strictly in English.
