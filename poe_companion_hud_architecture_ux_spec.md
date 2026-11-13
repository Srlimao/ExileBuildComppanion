# Path of Exile Companion HUD — System & UX Specification

## 1. System Overview & Core Philosophy

A lightweight, real-time second-screen telemetry HUD designed for Path of Exile campaign leveling. It runs silently in the Windows System Tray on the gaming PC, parses Path of Building (PoB) character plans via Exile Leveling's data/parser engine, and reacts automatically to live in-game events read from `Client.txt` (enriched by throttled GGG Character API snapshots when available), streaming context-aware guidance to a phone or tablet via a Cloudflare edge relay.

* **Core Design Principle:** Zero-touch, glanceable operation during gameplay. The UI adapts automatically to player location, live gear/socket state, and progression rather than requiring manual scrolling or clicking—and degrades gracefully during league-launch API outages.

* **Tech Stack Target:**

  * **PC Desktop Host & Tray App:** Tauri (Rust + Webview) or Electron wrapping the Node.js/TypeScript engine—provides native Windows System Tray integration, lightweight setup popover, `Client.txt` auto-discovery, `PathOfExile.exe` process heartbeat monitor, GGG Character API poller, Windows clipboard control, and an outbound WebSocket uplink to Cloudflare.

  * **Cloudflare Edge Infrastructure:**

    * **Cloudflare Pages:** Hosts the static React + Tailwind PWA frontend over native HTTPS (`poe-hud.pages.dev` or custom domain) with a full offline-capable Service Worker cache.

    * **Cloudflare Worker + Durable Objects:** Acts as the real-time WebSocket message broker pairing the PC host with connected mobile/tablet clients via a session room.

    * **Cloudflare KV (or R2):** Persists parsed build profiles, checkpoint progress, and device-scoped custom grid layouts across sessions.

  * **Upstream Data Dependencies:** `HeartofPhos/exile-leveling` (route JSON, gem/vendor matching, PoB decoding), `nicolasbagatello/poe1-campaign-helper` or community assets (zone layout cheat sheets), and GGG `character-window` JSON endpoints.

## 2. Cloudflare Edge & Relay Architecture

### 2.1 Why Cloudflare Edge vs. Pure LAN

* **Frictionless PWA & Wake-Lock:** Mobile browsers (especially iOS Safari) restrict PWAs and `navigator.wakeLock` on insecure `http://192.168.x.x` origins. Cloudflare Pages provides instant, valid TLS/HTTPS out of the box.

* **Zero Firewall / Subnet Friction:** Both the PC app and the mobile PWA make standard outbound TLS/WebSocket connections to the Worker—bypassing Windows Defender Firewall prompts, router AP isolation, or VPN split-tunneling issues.

### 2.2 Component Responsibilities

1. **Cloudflare Pages (Companion PWA + Service Worker):**

   * Serves the React + Tailwind frontend statically from the edge and pre-caches all route JSONs and zone layout assets in the browser Service Worker so mid-run Wi-Fi blips never blank out layout maps.

   * Connects via `wss://<worker-domain>/session/<ROOM_ID>?role=viewer&pin=<PIN>` to receive real-time telemetry updates and send manual checkpoint overrides or grid layout edits.

2. **Cloudflare Worker + Durable Object (`SessionRoom`):**

   * Each active user/pairing session maps to a lightweight **Durable Object** instance keyed by `ROOM_ID`.

   * **Inbound from PC Host (`role=host`):** PC opens a persistent outbound WebSocket (with exponential backoff auto-reconnect) and pushes lightweight state diffs (`zoneChange`, `levelUp`, `playerSlain`, `processState`, `characterSync`, `checkpointToggle`, `buildLoaded`).

   * **Outbound to Mobile Viewers (`role=viewer`):** The Durable Object fans out state updates instantly to all paired tablets/phones in that room and holds the latest snapshot in memory so a newly opened or refreshed tablet hydrates immediately without waiting for the next zone change.

   * **Bi-Directional Commands:** Allows tapping a checkpoint, triggering a manual gear sync, or saving a custom grid layout on the tablet to relay back to the PC host and persist to storage.

3. **Cloudflare KV / R2 (Generic Persistence):**

   * **Cloudflare KV:** Stores lightweight JSON documents keyed by `room:<ROOM_ID>`:

     * Active parsed build summary & checkpoint completion map (`< 50 KB`).

     * Device-scoped custom widget grid layouts (`Tablet Landscape`, `Tablet Portrait`, `Phone`).

   * **R2 (Optional):** Can host static zone layout map PNGs/WebPs if not bundled directly into Cloudflare Pages assets.

## 3. PC Desktop Control Center & System Tray

### 3.1 System Tray Lifecycle

* **Background Operation:** App minimizes to the Windows System Tray (`notification area`) with a dynamic status icon:

  * **Gray:** Standby / Waiting for `PathOfExile.exe` or Build.

  * **Green:** Active (`Client.txt` hooked + PoB loaded + Connected to Cloudflare Worker).

  * **Amber:** Degraded / Warning (`Client.txt` path missing, PoB has no leveling skill sets, Worker uplink reconnecting, or GGG Character API paused due to launch downtime).

* **Tray Context Menu:** Right-click provides instant actions: *Open Setup / Pairing Window*, *Sync Character Gear Now*, *Reload Build from Clipboard*, *Reset Campaign Progress*, *Toggle Auto-Clipboard Regex*, and *Quit*.

### 3.2 Compact PC Setup & Pairing Popover

Clicking the tray icon opens a sleek, compact (\~420×640px) setup window on the PC with four primary sections:

1. **Instant Device Pairing (Cloudflare Room + PIN):**

   * Generates/persists a unique `ROOM_ID` and rotating 4-digit `PIN` (plus a Worker API secret stored locally on the PC).

   * Displays a **dynamic QR Code** encoding `https://<pages-domain>/?room=<ROOM_ID>&pin=<PIN>` so pointing a phone/tablet camera opens the HTTPS PWA and joins the Durable Object room immediately.

   * Displays a fallback **short URL + Room/PIN** and a live list of connected viewer sockets (`iPad Air • Connected via Edge`).

2. **PoB Build Loader & Profile Manager (League-Launch Resilient):**

   * **Multi-Source Ingestion:** Accepts raw PoB export strings (works 100% offline if `pobb.in` is down on launch day), `pobb.in` links, or local `Path of Building/Builds/*.xml` file selection (with optional file-watcher auto-reload when you save changes in PoB).

   * **Local Bundle & Cache:** Bundles Exile Leveling's route dataset and zone layouts locally inside the PC installer and PWA cache—zero external CDN dependency during league launch spikes.

   * **Build Validation & Fallbacks:** Inspects the decoded XML for leveling skill sets and passive trees:

     * *Multi-Set PoBs:* Maps each PoB Skill Set / Tree Spec to its target level bracket automatically.

     * *Endgame-Only PoBs:* Flags a warning and activates **Fallback Leveling Mode** (groups gems by earliest vendor availability rather than dumping Act 10 setups in Act 1).

   * **Saved Run Profiles:** Allows switching between multiple characters/builds (e.g., *League Starter RF*, *Twink Hollow Palm*) while preserving each character's checkpoint completion state in KV.

3. **GGG Character Sync Settings (Public or `POESESSID`):**

   * **Account & Character Inputs:** Dedicated text fields in the PC setup window for **PoE Account Name** (including discriminator if applicable, e.g., `Name#1234`) and **Character Name** (with an `Auto-detect from Client.txt` toggle that updates the character name automatically on level-up).

   * **Optional Private-Profile Bypass (`POESESSID`):** Expandable advanced field allowing the user to paste their `POESESSID` cookie if their PoE account privacy is set to private.

     * *Local-Only Security Boundary:* `POESESSID` is encrypted locally on Windows (DPAPI / OS keychain) and used solely for outbound requests from the PC host to `pathofexile.com`—it is **never** sent to Cloudflare Workers, Durable Objects, or KV.

   * **Connection & Launch Outage Status Badge:** Validates credentials on save and displays `Connected (Public Profile)`, `Connected (POESESSID Authenticated)`, or `API Unavailable (Fallback Mode Active)`.

4. **Environment & `Client.txt` Detection:**

   * Auto-detects `Client.txt` across standard Standalone (`Grinding Gear Games\Path of Exile\logs\`) and Steam (`steamapps\common\Path of Exile\logs\`) install paths, with a manual folder picker fallback and a green `Log Hooked` heartbeat indicator.

## 4. Backend & Telemetry Pipeline

### 4.1 `Client.txt` Log Watcher & Process Heartbeat

* **Process Heartbeat (`PathOfExile.exe` / `PathOfExileSteam.exe`):** Polls Windows process list every 5 seconds. When PoE closes or crashes, the PC host transitions the tablet HUD to **Standby / Session Summary Mode** and pauses the active run timer until the client relaunches.

* **Log Tailing Mechanism:** Byte-offset file tailing (`fs.statSync` + `fs.createReadStream` from `lastOffset`) triggered by `fs.watch` to avoid loading multi-hundred-MB log files into memory.

* **Tracked Log Events (Anchored after `[INFO Client \d+]`):**

  * **Zone Entry:** `: You have entered (.+)\.$` -> Triggers view mode switch and zone-indexed route lookup.

  * **Level Up:** `: (.+) \((.+)\) is now level (\d+)$` -> Updates character level, auto-populates active character name (if auto-detect is enabled), and updates gem eligibility.

  * **Skill Point Quest Reward:** `: You have received (\d+) passive skill points?\.$` -> Auto-completes active skill-book objective.

  * **Player Death:** `: (.+) has been slain\.$` -> Marks `recentDeath = true` so clicking *"Resurrect in Town"* displays a **"Resume Previous Zone"** quick-banner rather than treating it as a planned vendor stop.

  * **NPC / Boss Dialogue / Crafting Triggers:** `^([A-Za-z\s,'-]+): (.+)$` -> Optional sub-step progression inside multi-objective zones.

### 4.2 GGG Character Window Snapshot Sync (Launch-Outage Safe)

* **Endpoints Used:**

  * `https://www.pathofexile.com/character-window/get-items?accountName=<ACC>&character=<CHAR>`

  * `https://www.pathofexile.com/character-window/get-passive-skills?accountName=<ACC>&character=<CHAR>`

  * *(Attaches `Cookie: POESESSID=<TOKEN>` header locally when configured for private accounts.)*

* **Rate-Limit & Outage Circuit Breaker:**

  * Triggered automatically **only on Town/Hideout zone entries** (when GGG flushes character state to the API), debounced with a strict **45-second cooldown** (plus a manual `Sync Now` button on the tablet/tray).

  * **League-Launch Circuit Breaker:** If `pathofexile.com` returns `502/503/504`, `429` rate-limit errors, or times out during league launch, the poller backs off exponentially (up to 5 minutes) and emits `characterSyncStatus = "OFFLINE_FALLBACK"`.

  * **Graceful Degradation (Zero Blocking):** When the API is down or unconfigured, the HUD seamlessly falls back to **Heuristic Soft-Tracking** (assuming town-available gems are acquired once you visit that town and exit to the next combat zone, while keeping manual tap-to-toggle enabled and displaying static Act resistance targets instead of live gear diffs).

* **Derived Live Telemetry (Sanitized Diffs Sent to Cloudflare When Online):**

  * **Live Elemental & Chaos Resistances:** Parses all equipped item mods, applies Act 5 (`-30%`) and Act 10 (`-60%`) Kitava penalties, and compares actual totals against upcoming boss targets.

  * **Verified Gems & Link Groups:** Inspects `socketedItems` and `group` IDs to auto-check off purchased/socketed gems, warn if a support gem is placed in an unlinked socket, and flag missing core auras/reservations.

  * **Passive Tree Diff & Respec Counter:** Compares allocated node `hashes` against the active PoB tree spec to auto-check allocated nodes, highlight only remaining nodes, and count required Orb of Regret / quest respec points when transitioning trees.

  * **Gear & Flask Hygiene Checks:** Flags `0% Movement Speed` boots past Act 2, outdated Life/Mana flask tiers for current character level, and under-leveled weapon bases for attack builds.

### 4.3 Non-Linear Progression & Checkpoint State Machine

Instead of a fragile linear pointer (`currentStep++`), the engine models the campaign as a **directed graph of discrete Checkpoints** indexed by `ZoneID`.

* **Checkpoint Categories:**

  * `MANDATORY_PATH` (Main story progression, required bosses, act transitions)

  * `SKILL_BOOK` (Optional passive point quests—e.g., *Dweller of the Deep*, *Marooned Mariner*)

  * `LAB_TRIAL` (Ascendancy trials required for Normal/Cruel/Merciless Lab)

  * `WAYPOINT` / `RECIPE` (Optional convenience or crafting unlocks)

* **Quest Reward vs. Vendor Purchase Tagging:**

  * Every required gem step is explicitly classified as either `FREE_QUEST_REWARD` (tagged with the exact NPC name and gold badge so you don't waste early currency or pick the wrong quest reward) or `VENDOR_BUY` (tagged with vendor NPC and exact currency cost: Wisdom, Transmutation, Alteration, Chance, Alchemy).

  * **Act 1–3 Currency Budget Tally:** Aggregates total currency needed at the *next* town stop (e.g., `2x Transmute, 1x Alt, 3x Wisdom`) and surfaces a subtle prep hint in `Field Mode` so you pick up enough rares to vendor for shards.

* **Automatic Completion Triggers:**

  * **Zone Exit / Next-Zone Entry:** Entering a downstream mandatory zone implicitly marks upstream `MANDATORY_PATH` traversal steps as `COMPLETED` (handles party portals and boss carries automatically).

  * **Explicit Log Events:** `You have received X passive skill points` marks the matching `SKILL_BOOK` checkpoint `COMPLETED` regardless of when you returned to claim it.

  * **Area Level / Character Level Heuristic:** If a `LAB_TRIAL` or `SKILL_BOOK` zone is entered and exited after clearing, or manually tapped on the HUD, it flips to `COMPLETED`.

* **Zone Name Disambiguation (Acts 1–5 vs. Acts 6–10):**

  * Because PoE reuses zone names across Part 1 and Part 2 (e.g., *The Coast*, *The Prison*, *The Chamber of Sins*, *The Cathedral Rooftop*), `Client.txt` zone strings are resolved using an **Act Context Window**:

    * Tracks `highestUnlockedAct` and `lastCombatZoneId` (ensures entering *Lioneye's Watch* or *Hideout* anchors vendor checklists to the Act you are actively running).

    * Character level acts as a secondary tie-breaker (`level >= 44` biases toward Part 2 when ambiguous).

### 4.4 PC-Side Automation Bridge

* **Auto-Clipboard Vendor Regex:** Upon entering any Town hub (or approaching a gem/link milestone), the host service automatically writes the active vendor regex string (socket colors, links, target gem names—automatically excluding gems already verified as socketed via the Character API) to the Windows clipboard so the player can immediately press `Ctrl+V` in the vendor UI without interacting with the tablet/phone.

## 5. Companion Frontend & Modular UX

### 5.1 Context-Aware Modes (Auto-Switching)

The HUD automatically switches between four distinct states based on live telemetry:

1. **Field / Combat Mode:** Active in wilderness and dungeon zones. Prioritizes layout navigation, immediate zone objectives, skipped skill-book awareness, and a compact footer preview of upcoming town currency/gem needs.

2. **Town / Hideout Mode:** Active in Town hubs and Hideouts (anchored to `lastCombatZoneId`). Prioritizes `FREE_QUEST_REWARD` vs. `VENDOR_BUY` gem lists, upcoming currency budget, PC clipboard regex sync status, socket/link verification, gear/flask hygiene alerts, and passive tree allocation. (Shows a quick `"Resume <Last Zone>"` banner if entered via death respawn.)

3. **Labyrinth Mode:** Active in Aspirants' Plaza and Labyrinth zones. Prioritizes daily Lab room compass, Golden Door pathing, darkshrines, and Izaro phase notes.

4. **Standby / Session Summary Mode:** Active when `PathOfExile.exe` is closed. Dims the screen, pauses the run timer, and displays Act split times and completed checkpoint progress.

### 5.2 Per-Mode Custom Widget Grid Configuration

Instead of a single rigid layout, **each active Context Mode (*Field*, *Town*, *Lab*) maintains its own independent widget grid configuration** so you can optimize screen real estate for what matters in that specific state:

* **Modular Widget Catalog (Toggleable & Resizable):**

  * `ZoneLayoutWidget`: Visual map variants, exit direction compass, and dead-end warnings.

  * `ActiveChecklistWidget`: Context-filtered checklist for the current zone or town turn-ins.

  * `VendorShoppingWidget`: Grouped NPC `FREE_QUEST_REWARD` vs. `VENDOR_BUY` gem steps, currency budget tally, and socket color badges (auto-checked via Character API when socketed, or heuristic soft-tracked during API outages).

  * `SocketLinksWidget`: Target 3L/4L/5L/6L active + support gem setups with live unlinked-support and missing-aura warnings.

  * `PassiveTreeWidget`: Remaining unallocated passive nodes/masteries from PoB diff + respec point counter.

  * `RegexSyncWidget`: Live preview of the vendor regex synced to PC clipboard + one-tap manual re-sync.

  * `DeferredBacklogWidget`: Expandable "Cleanup List" of skipped skill-point quests and Lab trials.

  * `ResistanceCapWidget`: Live actual vs. target elemental/chaos resistances (with Kitava penalties applied) + boss damage warnings (falls back to static Act target checklist if GGG API is offline).

  * `GearHygieneWidget`: Live alerts for `0% MS` boots, outdated flask tiers, and under-leveled weapon bases.

  * `RunTimerWidget`: Total run timer, current Act split, and pace delta (auto-pauses when PoE closes).

  * `LabCompassWidget`: Daily Labyrinth graph, Golden Door markers, and Izaro mechanics.

* **Edit Mode & Grid Mechanics:**

  * **Unlocked Edit Mode:** Tapping the header `Layout Edit` icon enters grid customization for the *currently active mode* (or lets you preview/edit *Field*, *Town*, or *Lab* grids while sitting in Hideout).

  * **Drag, Resize & Snap:** Powered by a responsive CSS Grid / `react-grid-layout` system—drag cards to reorder, resize between compact (`1x1`), wide (`2x1`), or hero (`2x2`) spans, and toggle unused widgets off via a quick `+ Add Widget` drawer.

  * **Device-Scoped & Synced Presets:** Layouts are saved per device form-factor (`Tablet Landscape`, `Tablet Portrait`, `Phone`) and persisted to Cloudflare KV (plus a local PC backup JSON) so your custom grids survive browser refreshes and device switches.

### 5.3 Ergonomics & Visual Standards

* **OLED True-Black Palette:** `#000000` / `#09090B` surfaces with high-contrast, color-blind-safe socket badges (`#EF4444` R, `#22C55E` G, `#3B82F6` B, `#EAB308` Quest Gold).

* **Typography:** Minimum `16px–18px` body text for instructions; `24px+` headers for zone names and NPC targets.

* **Screen Wake-Lock:** Uses browser `navigator.wakeLock` API (enabled natively over Cloudflare Pages HTTPS) to keep the mobile/tablet display awake throughout active sessions.

## 6. Completed Design Decisions

* \[x\] **Cloudflare Edge Stack:** Cloudflare Pages (offline-cached PWA frontend), Worker + Durable Objects (real-time WebSocket session room & state hydration), and KV (build/checkpoint/grid persistence).

* \[x\] **GGG Character Snapshot Sync & Launch-Outage Resilience:** Rate-limit-safe town-entry polling with manual Account/Character inputs, auto-character detection, local-only `POESESSID` private-profile bypass, and circuit-breaker fallback to heuristic tracking during league-launch API downtime.

* \[x\] **Non-Linear Progression & Operational Edge Cases:** Checkpoint graph, implicit upstream completion, `FREE_QUEST_REWARD` vs. `VENDOR_BUY` tagging + currency tally, death respawn banner, `PathOfExile.exe` process heartbeat, and Act 1–5 vs. 6–10 zone disambiguation.

* \[x\] **PC System Tray & Pairing Flow:** Tray status states, QR/PIN device pairing, raw-string/local-XML PoB ingestion (works even if `pobb.in` is down), Account/Character/`POESESSID` config, and `Client.txt` auto-detection.

* \[x\] **Per-Mode Custom Widget Grid:** Independent customizable widget grids per context mode (*Field*, *Town*, *Lab*), device-scoped layouts synced to Cloudflare KV, and preview-editing from Hideout.