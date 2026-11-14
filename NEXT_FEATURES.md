# Planned Next Features Roadmap

Prioritized roadmap of telemetry, QoL, and open-API improvements for **Exile Companion HUD**. Every feature below must preserve `@exile-hud/core` purity (no DOM/Node/Tauri imports), the strict `< 300`-line file ceiling (`pnpm run check:lines`), the local-only `POESESSID` security boundary, and graceful offline/outage fallback behavior.

---

## Priority Overview

| # | Feature | Status | Primary Data Source | Primary Impact |
| --- | --- | --- | --- | --- |
| 1 | Backpack & Weapon-Swap Gem Detection | Done | `get-items` (already fetched) | Stops `TOWN` regex/shopping nags for gems already bought or leveling on swap |
| 2 | Actual Bandit & Pantheon State (+ PoB Check) | Planned | `get-passive-skills` + PoB `<Build>`/`<Config>` | Fixes Act 1 Alira res inflation and surfaces Bandit/Pantheon mismatch alerts |
| 3 | Socketed Tree Jewels | Planned | `get-passive-skills` (`items`, `jewel_data`, `hashes`) | Includes jewel resistances in caps and flags empty allocated jewel sockets |
| 4 | 1-Click Character Dropdown & League Auto-Detect | Planned | `character-window/get-characters` | Zero-typing character selection, SSF/Ruthless/HC flags, PoB class check |
| 5 | Daily Labyrinth Layouts | Planned | Cloudflare Worker `/api/lab/daily` + PoELab JSON | Zero-paste `LAB` room compass across sessions with `00:00 UTC` expiry |
| 6 | Actionable Bench Craft Suggestions | Done | RePoE `crafting_bench_options.json` + `get-items` | Exact *"Craft X Res on Gloves (1x Transmute)"* advice in `TOWN` mode |

---

## 1. Backpack & Weapon-Swap Gem Detection

**Goal:** Distinguish gems the player **owns** (in inventory or weapon-swap slots) from gems **actively socketed** in primary combat gear.

- **Data Source:** Already-fetched `get-items` payload (`apps/desktop/src-tauri/src/features/ggg_api_client/character_window_http_poller.rs`).
- **Target Slices:**
  - `packages/core/src/features/character_telemetry_diff/socket_link_and_gem_verifier.ts`
  - `packages/core/src/features/vendor_regex/vendor_search_regex_builder.ts`
  - `apps/pwa/src/features/widgets/vendor_shopping_widget.tsx` & `socket_links_widget.tsx`
- **Behavior:**
  - Inspect `MainInventory`, `Weapon2`, and `Offhand2` entries in addition to active equipment slots—handling **both**:
    1. Loose gem items stored directly in `MainInventory` (matching top-level gem `baseType` / `typeLine` on items without `socketedItems`).
    2. Gems inside `socketedItems` of `Weapon2`, `Offhand2`, or spare gear sitting in `MainInventory`.
  - Split verification state into **Acquired/Owned (`verifiedByApi`)** vs. **Actively Socketed (`verifiedSocketed`)**:
    - Owning a gem in backpack or weapon-swap marks it complete in `VendorShoppingWidget` and removes it from the Auto-Clipboard Vendor Regex so `Ctrl+V` stops highlighting already-purchased gems.
    - `SocketLinksWidget` still highlights unlinked/unequipped active skills or auras when a required gem is sitting in `MainInventory` or `Weapon2`/`Offhand2` rather than primary slots.
- **Offline Fallback:** Preserves existing heuristic town soft-tracking when GGG API is unavailable.

---

## 2. Actual Bandit & Pantheon State (with PoB Cross-Check)

**Goal:** Replace assumed PoB Alira buffs with live character state and warn when in-game Bandit or Pantheon choices drift from the PoB build plan.

- **Data Sources:**
  - **Live API:** `bandit_choice`, `pantheon_major`, and `pantheon_minor` fields from `get-passive-skills` (`passives_json`).
  - **PoB Plan:** `<Build>` attributes (`bandit`, `pantheonMajorGod`, `pantheonMinorGod`) and active `<Config>` / `<ConfigSet>` `<Input>` overrides (`bandit`, `pantheonMajorGod`, `pantheonMinorGod`).
- **Target Slices:**
  - `packages/core/src/features/pob_import/pob_xml_skill_and_tree_extractor.ts`
  - `packages/core/src/features/character_telemetry_diff/equipped_resistance_estimator.ts`
  - `packages/core/src/features/protocol/session_room_wire_protocol.ts`
  - `apps/desktop/src/features/host_coordinator/desktop_telemetry_bridge.ts`
  - `apps/pwa/src/features/widgets/resistance_cap_widget.tsx` & `gear_hygiene_widget.tsx`
- **Behavior:**
  - Extract target `pantheonMajor` and `pantheonMinor` alongside `bandit` during PoB compilation.
  - When live `passives_json` is available, `estimateEquippedResistances` applies Alira's `+15%` Elemental Resistances **only** when live `bandit_choice === "Alira"` (preventing false `+15%` res padding during Act 1 before Act 2's bandit quest).
  - Surface compact alerts in `TOWN` mode when:
    - Post-Act 2 `bandit_choice` mismatches PoB's target `bandit` (showing the `20x Orb of Regret + Amber/Jade/Lapis/Onyx Amulet` Eramir/Bandit respec recipe hint).
    - Act 6+ `pantheon_major` or `pantheon_minor` is unset or differs from PoB's target soul once the corresponding god soul act/boss has been cleared.
- **Offline Fallback:** Falls back to PoB-configured `bandit` metadata when GGG sync is offline or unconfigured.

---

## 3. Socketed Tree Jewels

**Goal:** Account for resistances and attributes granted by passive-tree jewels and catch empty allocated jewel sockets.

- **Data Source:** Already-fetched `get-passive-skills` payload (`passives_json.items`, `passives_json.jewel_data`, and `passives_json.hashes`).
- **Target Slices:**
  - `packages/core/src/features/character_telemetry_diff/equipped_resistance_estimator.ts`
  - `packages/core/src/features/character_telemetry_diff/gear_and_flask_hygiene_auditor.ts`
  - `apps/pwa/src/features/widgets/resistance_cap_widget.tsx` & `passive_tree_widget.tsx`
- **Behavior:**
  - Feed `implicitMods`, `explicitMods`, `craftedMods`, `fracturedMods`, and `enchantMods` from `passives_json.items` (regular, unique, and cluster jewels) into `parseResistanceLines` inside `estimateEquippedResistances`.
  - Cross-check allocated `isJewelSocket` node IDs in `hashes` against `jewel_data` / `items`; emit an informational reminder in `GearHygieneWidget` / `PassiveTreeWidget` if an allocated jewel socket is empty.
- **Offline Fallback:** Safely skips jewel inspection when `passives_json` is absent.

---

## 4. 1-Click Character Dropdown & League Auto-Detect

**Goal:** Eliminate manual character-name typing and automatically detect active league rulesets (`SSF`, `Ruthless`, `Hardcore`).

- **Data Source:** `https://www.pathofexile.com/character-window/get-characters?accountName=<ACC>` (plus optional edge-cached `/api/trade/data/leagues` metadata).
- **Target Slices:**
  - `apps/desktop/src-tauri/src/features/ggg_api_client/character_window_http_poller.rs` (plus dedicated helper module for `get-characters` IPC command)
  - `apps/desktop/src/features/ggg_sync_panel/character_sync_settings_card.tsx`
  - `apps/desktop/src/features/host_coordinator/tauri_ipc_adapter.ts` & `desktop_telemetry_bridge.ts`
- **Behavior:**
  - Entering an Account Name (`Name#1234`) exposes a **"Fetch Characters"** action (and auto-populates on valid credentials using local Windows Credential Manager `POESESSID` only on PC—never sent to Cloudflare).
  - Render a 1-click dropdown listing each character's `name`, `class`, `level`, `league`, and `lastActive` badge, auto-selecting the `lastActive` character without needing to wait for a `Client.txt` level-up line.
  - Detect `SSF` / `Ruthless` / `Hardcore` rulesets from the character's `league` name and show a non-blocking warning in the PC Control Center if the selected character's class mismatches the loaded PoB `characterClass`.
- **Offline Fallback:** Manual character input and `Client.txt` level-up auto-detection continue to work unchanged if `get-characters` fails or returns `429`/`5xx`.

---

## 5. Daily Labyrinth Layouts (Zero-Paste `LAB` Mode)

**Goal:** Automatically hydrate `LabCompassWidget` upon entering Aspirants' Plaza (`Labyrinth_Airlock`) without manually pasting PoELab JSON on every device.

- **Data Source:** Shared Cloudflare Worker cache (`GET /api/lab/daily` & `POST /api/lab/daily`, normalized through `parsePoelabDailyJson` in `packages/core/src/features/lab_compass/poelab_daily_json_tracker.ts`).
- **Target Slices:**
  - `apps/edge-worker/src/worker_http_and_ws_router.ts` (plus a dedicated `features/lab_daily/` repository/handler)
  - `apps/desktop/src/features/host_coordinator/desktop_telemetry_bridge.ts`
  - `apps/pwa/src/features/widgets/lab_compass_widget.tsx`
- **Behavior:**
  - Cache normalized Normal, Cruel, Merciless, and Uber Labyrinth room graphs per UTC day (`YYYY-MM-DD`, auto-expiring at the `00:00 UTC` Lab reset).
  - Allow the desktop host or any companion viewer importing a daily PoELab JSON to publish the normalized layout to `/api/lab/daily` (validated strictly via Zod), and auto-fetch today's layout when entering `Labyrinth_Airlock` or switching to `LAB` mode.
  - Retain manual file upload and Paste controls in `lab_compass_widget.tsx` for offline play or immediate override.
- **Offline Fallback:** Manual PoELab JSON upload/paste remains 100% functional without network access.

---

## 6. Actionable Bench Craft Suggestions (Cross-Referencing)

**Goal:** Turn passive resistance and movement-speed alerts in `TOWN` / `ResistanceCapWidget` / `GearHygieneWidget` into exact, ready-to-craft Crafting Bench instructions.

- **Data Source:** Build-time ingestion of RePoE's `crafting_bench_options.json` (filtered to campaign leveling crafts: Elemental/Chaos Resistances, Movement Speed, Life, Attributes) cross-referenced against live `get-items` gear and `clearedAreaIds` / unlocked `{crafting|...}` route checkpoints.
- **Target Slices:**
  - `scripts/ingest_upstream_game_assets.mjs` -> `packages/game-data/data/poe1/` + `packages/game-data/src/poe1_campaign_game_adapter.ts`
  - New pure advisor module in `packages/core/src/features/character_telemetry_diff/`
  - `apps/pwa/src/features/widgets/resistance_cap_widget.tsx` & `gear_hygiene_widget.tsx`
- **Behavior:**
  - Parse equipped gear (`Helm`, `BodyArmour`, `Gloves`, `Boots`, `Belt`, `Amulet`, `Ring`, `Ring2`) for existing `craftedMods`, item rarity/class (`rare` / `magic` compatibility), `ilvl`, and open suffix/prefix heuristic (`craftedMods.length === 0` and mod-slot headroom).
  - Match unresolved deficits (e.g., Fire/Cold/Lightning Res below target, `0%` Movement Speed on boots, or missing attributes) against unlocked bench recipes for the character's current act progression.
  - Display concrete prescriptions in `TOWN` mode (e.g., *"Cold Res -14% under cap -> Craft 16-20% Cold Res on Gloves (1x Orb of Transmutation)"*).
- **Offline Fallback:** Uses static act resistance targets and existing `0% MS` reminders when GGG API gear data is unavailable.

---

## Hotspot Files to Split First (`< 300`-Line Rule)

Several orchestrator files already sit just under the CI `< 300`-line ceiling (`pnpm run check:lines`). Extract focused domain modules **before** adding any new logic to them:

- `apps/desktop/src/features/host_coordinator/use_desktop_host_controller.ts` (298 lines)
- `apps/pwa/src/App.tsx` (298 lines)
- `apps/edge-worker/tests/session_room_e2e.test.ts` (296 lines)
- `packages/core/src/features/checkpoint_graph/campaign_progress_persistence.ts` (289 lines)
