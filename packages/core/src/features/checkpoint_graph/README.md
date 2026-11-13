# `checkpoint_graph` Domain

Models PoE campaign progression as a non-linear directed sequence of zone-indexed checkpoints rather than a brittle `currentStep++` cursor:
- **Deterministic Primary Zone Resolution:** Uses `Generating level <N> area "<areaId>" with seed <seed>` (works in every client language).
- **Act Context Window Fallback:** Resolves localized `: You have entered <ZoneName>.` strings using `highestUnlockedAct`, `lastCombatZoneId`, and `characterLevel >= 44` Part 2 tie-breaking.
- **Party & Carry Resilience:** Entering any downstream `MANDATORY_PATH` zone marks prior mandatory steps completed automatically.
- **Launch Outage Safety:** When GGG Character API is offline, exiting a Town hub into a combat zone soft-checks town-eligible gems while keeping tap-to-toggle overrides enabled.
