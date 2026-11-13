# Passive Tree Visualizer Feature

Self-contained vertical slice for rendering and interacting with the GGG `3.30.0` Path of Exile Passive Skill Tree on the 4th `TREE` HUD mode.

## Architectural Rules
- **Vector Wireframe + Overlay Layering:** Static background tree edges (circular orbit arcs `A r r` within the same group/orbit + straight cross-group highways) and passive nodes are memoized per character class/ascendancy so pan/zoom (`viewBox` updates) stays fast on tablets and phones.
- **Bracket Progression Semantics:** Every spec in `snapshot.passiveTree.specs` is compared against its preceding level bracket via `computeBracketProgressionDiff`:
  - Emerald: Allocated (GGG API synced + local manual overrides).
  - Amber: New target points in the selected level bracket.
  - Cyan: Earlier-bracket points not yet allocated.
  - Rose (dashed): Nodes present in the previous bracket and dropped in the selected bracket (respec).
  - Violet: Optional future-bracket preview.
- **File Limit:** Every component and helper file in this directory stays strictly under `300` lines.
