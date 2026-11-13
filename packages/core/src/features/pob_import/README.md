# `pob_import` Domain

Handles multi-source Path of Building ingestion and validation:
- **Offline Raw Code & Local XML**: Decodes `base64url` + zlib (`pako.inflate`) strings and raw `<PathOfBuilding>` XML with zero network calls (`pobb.in` downtime safe).
- **`pobb.in` Fetching**: Fetches `https://pobb.in/<id>/raw` when given a URL.
- **Multi-Set vs. Endgame-Only Fallback**:
  - Multi-set PoBs map each `<SkillSet>` and `<Spec>` to its target character level bracket.
  - Single-set endgame PoBs trigger `isEndgameOnlyFallback: true` and re-group gems into earliest quest/vendor leveling brackets instead of dumping Act 10 setups in Act 1.
