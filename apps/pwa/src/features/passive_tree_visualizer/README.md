# Passive Tree Visualizer Feature

Self-contained vertical slice for rendering and interacting with the GGG `3.30.0` Path of Exile Passive Skill Tree on the 4th `TREE` HUD mode.

## Architectural Rules
- **Vector Wireframe + Overlay Layering:** Static background tree edges (circular orbit arcs `A r r` within the same group/orbit + straight cross-group highways) and passive nodes are memoized per character class/ascendancy so pan/zoom (`viewBox` updates) stays fast on tablets and phones.
- **Read-Only Telemetry & Next-Passive Initial Zoom:** Allocation state reflects GGG/PoB telemetry only (no manual node modification controls). On opening `TREE` or switching brackets, `computeNextPassivesBounds` frames the immediate unallocated cluster (~2,000–3,200 world units wide) rather than zooming out to the entire tree or Ascendancy islands.
- **Per-Profile Viewport Persistence (`passive_tree_viewport_storage.ts`):** Saves the active camera (`centerX`, `centerY`, `width`) and `manualSpecId` per `profileId` and bracket `specKey` (`exile_hud_tree_viewport_v1` in `localStorage`), restoring pan/zoom across tab switches (`FIELD`/`TOWN`/`LAB`/`TREE`), in-game passive tree toggles, and browser reloads.
- **Multi-Touch Pinch & Tap Delegation:** `usePanZoomViewport` tracks active touch/mouse pointers via `pointerHandlers` (`pinch_zoom_math.ts`), supporting focal-point two-finger pinch-to-zoom, midpoint panning, seamless 2-to-1 finger transition re-anchoring, trackpad `ctrl+wheel`/Safari gesture guards, and `data-tree-node-id` container-level tap delegation without swallowing multi-touch events.
- **Bracket Progression Semantics:** Every spec in `snapshot.passiveTree.specs` is compared against its preceding level bracket via `computeBracketProgressionDiff`:
  - Emerald: Allocated (GGG API synced + local manual overrides).
  - Amber: New target points in the selected level bracket.
  - Cyan: Earlier-bracket points not yet allocated.
  - Rose (dashed): Nodes present in the previous bracket and dropped in the selected bracket (respec).
  - Violet: Optional future-bracket preview.
- **File Limit:** Every component and helper file in this directory stays strictly under `300` lines.
