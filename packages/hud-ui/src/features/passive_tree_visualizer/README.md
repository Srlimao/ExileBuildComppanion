# Passive Tree Visualizer Feature

Self-contained vertical slice for rendering and interacting with the GGG `3.30.0` Path of Exile Passive Skill Tree on the 4th `TREE` HUD mode.

## Architectural Rules
- **Batched 2D Canvas + Spatial Grid Culling:** Replaces thousands of SVG DOM nodes with an opaque HTML5 2D `<canvas>` (`alpha: false`, `passive_tree_canvas.tsx` + `passive_tree_canvas_painter.ts`) backed by a uniform `1024`-unit 2D spatial hash grid (`passive_tree_spatial_index.ts`). Each frame uses monotonic `Uint32Array` visit stamps and reusable scratch buffers for zero-allocation frustum culling, batched path passes (~12 draw calls), adaptive DPR capping (`1.25` on low-end/coarse-pointer tablets, `2.0` on desktop), and semantic zoom LOD (hiding sub-pixel minor wireframe details at wide zoom while keeping build paths and notables crisp).
- **Imperative `rAF` Pan/Zoom & Settled Persistence:** `usePanZoomViewport` keeps camera state in `cameraRef`, caches container bounds via `ResizeObserver`, and coalesces pan, two-finger pinch, and wheel updates into a single `requestAnimationFrame` callback (`subscribeCamera`) with zero React re-renders during gestures. `onCameraSettled` persists pan/zoom per `profileId` and bracket `specKey` (`exile_hud_tree_viewport_v1` in `localStorage`) once gestures complete.
- **Read-Only Telemetry & Next-Passive Initial Zoom:** Allocation state reflects GGG/PoB telemetry only (no manual node modification controls). On opening `TREE` or switching brackets, `computeNextPassivesBounds` (`passive_tree_camera_bounds.ts`) frames the immediate unallocated cluster (~2,000–3,200 world units wide) rather than zooming out to the entire tree or Ascendancy islands.
- **Spatial Touch Hit-Testing & GPU-Safe Overlays:** Single-finger/mouse taps convert screen coordinates via `screenPointToWorld` (`pinch_zoom_math.ts`) and resolve nodes via `hitTestPassiveTreeNode` with a `22 CSS px` touch tolerance prioritizing highlighted/notable/keystone nodes. Floating legend and tooltip cards (`passive_tree_node_tooltip.tsx`) avoid `backdrop-blur` over the animated canvas and memoize shortest-path BFS lookups.
- **Bracket Progression Semantics:** Every spec in `snapshot.passiveTree.specs` is compared against its preceding level bracket via `computeBracketProgressionDiff`:
  - Emerald: Allocated (GGG Character API / PoB telemetry — read-only).
  - Amber: New target points in the selected level bracket.
  - Cyan: Earlier-bracket points not yet allocated.
  - Rose (dashed): Nodes present in the previous bracket and dropped in the selected bracket (respec).
  - Violet: Optional future-bracket preview.
- **File Limit:** Every component and helper file in this directory stays strictly under `300` lines.
