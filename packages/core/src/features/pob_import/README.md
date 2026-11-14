# `pob_import` Domain

Handles multi-source Path of Building ingestion and validation:
- **Offline Raw Code & Local XML**: Decodes `base64url` + zlib (`pako.inflate`) strings and raw `<PathOfBuilding>` XML with zero network calls (`pobb.in` downtime safe).
- **`pobb.in` Fetching**: Fetches `https://pobb.in/<id>/raw` when given a URL.
- **Multi-Set vs. Endgame-Only Fallback & Selective Set Filtering:**
  - Parses `<SkillSet>`, passive `<Spec>`, and `<ItemSet>` (`pob_xml_item_set_extractor.ts`).
  - `pob_build_set_filter.ts` lets users selectively filter and reconcile which Passive Specs, Skill Sets, and Item Sets are active.
  - Multi-set PoBs map each `<SkillSet>` and `<Spec>` to its target character level bracket.
  - Single-set endgame PoBs trigger `isEndgameOnlyFallback: true` and re-group gems into earliest quest/vendor leveling brackets instead of dumping Act 10 setups in Act 1.
