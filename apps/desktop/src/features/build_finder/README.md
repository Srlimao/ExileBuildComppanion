# `build_finder` Domain

Dedicated secondary Tauri v2 window (`?window=build-finder`, `980 × 700`) for browsing and importing community builds without crowding the `460 × 640` Control Center.

- **Guided 3-Step Funnel:** Step 1 (`Class & Ascendancy` + `Skip to All Builds`), Step 2 (`Playstyle & Goal Tags` + `PoB-Ready Only` default ON for PoE 1 / OFF for PoE 2), Step 3 (live filter bar + ranked OLED build cards).
- **IPC Handoff:** `select_build_from_finder` emits `build-finder:selected` to `main`, hides `build-finder`, focuses `main`, and pre-fills the New Build editor (`use_build_finder_handoff.ts`).
- **Browser Preview Fallback:** Uses `window.open("?window=build-finder")` + `BroadcastChannel` when running outside Tauri.
