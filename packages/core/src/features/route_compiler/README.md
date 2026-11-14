# `route_compiler` Domain

Compiles Exile Leveling route scripts and PoB skill plans into structured campaign steps and town shopping lists:
- **Conditional Preprocessor (`route_dsl_preprocessor.ts`):** Combines Act 1–10 default route files (or user custom route overrides) and evaluates `#ifdef` flags for `LEAGUE_START`, `LIBRARY`, and Bandit choices.
- **Route Fragment AST Parser (`route_fragment_ast_parser.ts`):** Parses route tags (`{enter|...}`, `{waypoint|...}`, `{quest|...}`, `{dir|...}`, `{trial}`, `#sub` notes) into typed fragments, resolving `{quest|...}` steps to human-readable quest names and turn-in NPCs from `quests.json` with clean punctuation spacing.
- **Gem & Vendor Currency Assigner (`gem_quest_and_vendor_assigner.ts`):** Maps required PoB gems to earliest `FREE_QUEST_REWARD` vs. `VENDOR_BUY` (`FALLBACK_VENDOR` in endgame fallback mode) quest stops and computes Act 1–3 next-town currency totals (`computeNextTownCurrencyBudget`).
