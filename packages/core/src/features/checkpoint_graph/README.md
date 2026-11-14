# Checkpoint Graph Domain

Owns zone disambiguation, campaign DAG construction, and state reduction (`packages/core/src/features/checkpoint_graph/`):
- `area_dominator_resolver.ts`: Computes and `WeakMap`-caches strict intra-act BFS dominators (excluding `isIgnoredGraphEdge` portals such as `2_10_town->2_10_6` and `1_4_town->1_4_6_3`) plus prior-act trunk dominators when entering a new Act or non-town zone.
- `checkpoint_directed_graph_builder.ts`: Classifies route steps (`stepKind`, offer-scoped `isSkillBookQuestOffer`, Labyrinth `*_Labyrinth_boss_3` ascend steps) and annotates contiguous Visit Blocks with `expectedExitAreaId`, `prerequisiteAreaIds`, and `isOptionalDetour`.
- `checkpoint_progression_evaluator.ts` & `checkpoint_progression_reducer.ts`: Tracks `visitedAreaIds` and `clearedAreaIds`, gates completion on strict dominators, Visit-Block exits, and prerequisite clearance, guards against `player_slain` town/hideout respawns, and prioritizes prerequisite-cleared `SKILL_BOOK` checkpoints on `skill_points_received`.
- `lab_and_passives_reconciler.ts`: Auto-completes unlocked tier Labyrinth trials (and prior Lab tiers) upon entering interior Labyrinth rooms (`1_Labyrinth_*`–`EndGame_Labyrinth_*`) or via allocated Ascendancy nodes / `/passives` Ascendancy summary lines, and reconciles `/passives` quest summary headers and parenthesized `(N from <Quest>)` lines against campaign `SKILL_BOOK` checkpoints.
- `zone_context_disambiguator.ts`: Parses PoE `Client.txt` lines (including `/passives` Ascendancy, level, quest-summary header, and parenthesized quest lines) and disambiguates duplicate zone names across Acts 1–5 / 6–10.
- `campaign_progress_persistence.ts`: Extracts and restores completed/soft-completed checkpoints, `visitedAreaIds`/`clearedAreaIds`, and gem states with category-agnostic semantic key migration and explicit reset preservation.
- `initial_session_snapshot_factory.ts`: Builds the initial PoB-backed HUD snapshot before live telemetry begins.
