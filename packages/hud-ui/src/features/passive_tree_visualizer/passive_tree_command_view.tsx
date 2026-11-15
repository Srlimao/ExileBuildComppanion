import type { HudSessionSnapshot } from "@exile-hud/core";
import {
  computeBracketProgressionDiff,
  resolveEffectiveAllocatedSet,
  selectBracketSpecIndex,
  sortTreeSpecsByLevel,
} from "@exile-hud/core";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { syncRunTimerSnapshot } from "../widgets/run_timer_clock_tracker.js";
import {
  computeBracketOverviewBounds,
  computeNextPassivesBounds,
  computeNodeSetBounds,
} from "./passive_tree_camera_bounds.js";
import { PassiveTreeCanvas } from "./passive_tree_canvas.js";
import { getBuiltPoe1TreeGeometry, resolveVisibleAscendancies } from "./passive_tree_geometry_builder.js";
import { PassiveTreeLevelStepperBar } from "./passive_tree_level_stepper_bar.js";
import { PassiveTreeSidebarDrawer } from "./passive_tree_sidebar_drawer.js";
import {
  buildSpatialTreeIndex,
  buildTreeHighlightLookup,
  hitTestPassiveTreeNode,
} from "./passive_tree_spatial_index.js";
import { loadSavedTreeViewport, saveTreeViewport } from "./passive_tree_viewport_storage.js";
import { usePanZoomViewport, type ViewportCamera, type WorldPointHit } from "./use_pan_zoom_viewport.js";
import { useTreeViewportPersistence } from "./use_tree_viewport_persistence.js";

interface PassiveTreeCommandViewProps {
  snapshot: HudSessionSnapshot;
  onTriggerManualSync: () => void;
}

/** Full-canvas read-only GGG 3.30.0 passive tree workspace rendered on the 4th TREE tab. */
export function PassiveTreeCommandView({
  snapshot,
  onTriggerManualSync,
}: PassiveTreeCommandViewProps) {
  syncRunTimerSnapshot(snapshot);
  const geometry = useMemo(() => getBuiltPoe1TreeGeometry(), []);
  const specs = useMemo(
    () => sortTreeSpecsByLevel(snapshot.passiveTree.specs ?? []),
    [snapshot.passiveTree.specs],
  );
  const savedViewport = useMemo(() => loadSavedTreeViewport(snapshot.profileId), [snapshot.profileId]);

  const [manualSpecId, setManualSpecId] = useState<string | null>(() => savedViewport?.manualSpecId ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showFuture, setShowFuture] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedIndex = selectBracketSpecIndex(specs, snapshot.characterLevel, manualSpecId);
  const allocatedIds = useMemo(
    () => resolveEffectiveAllocatedSet(snapshot.passiveTree),
    [snapshot.passiveTree],
  );

  const diff = useMemo(
    () =>
      computeBracketProgressionDiff({
        specs,
        selectedIndex,
        allocatedIds,
        characterClass: snapshot.characterClass,
        adapter: {
          getPassiveTreeNodes: () => geometry.nodes,
          getPassiveTreeGraphMeta: () => geometry.meta,
        } as Parameters<typeof computeBracketProgressionDiff>[0]["adapter"],
      }),
    [specs, selectedIndex, allocatedIds, snapshot.characterClass, geometry],
  );

  const visibleAscendancies = useMemo(
    () =>
      resolveVisibleAscendancies({
        characterClass: snapshot.characterClass,
        ascendancyName: snapshot.ascendancyName,
        activeSpecNodeIds: diff.targetSet,
        geometry,
      }),
    [snapshot.characterClass, snapshot.ascendancyName, diff.targetSet, geometry],
  );

  const visibleNodes = useMemo(
    () =>
      geometry.allNodesList.filter(
        (n) => !n.isBlighted && (!n.ascendancyName || visibleAscendancies.has(n.ascendancyName)),
      ),
    [geometry.allNodesList, visibleAscendancies],
  );

  const visibleEdges = useMemo(
    () =>
      geometry.edges.filter(
        (e) => !e.ascendancyName || visibleAscendancies.has(e.ascendancyName),
      ),
    [geometry.edges, visibleAscendancies],
  );

  const spatialIndex = useMemo(
    () => buildSpatialTreeIndex(visibleNodes, visibleEdges),
    [visibleNodes, visibleEdges],
  );

  const ascendancyNodeIds = useMemo(
    () => visibleNodes.filter((n) => Boolean(n.ascendancyName)).map((n) => n.id),
    [visibleNodes],
  );

  const searchMatchIds = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const node of visibleNodes) {
      const haystack = geometry.searchTextByNodeId.get(node.id);
      if (haystack && haystack.includes(q)) hits.add(node.id);
    }
    return hits;
  }, [deferredSearchQuery, visibleNodes, geometry]);

  const highlightLookup = useMemo(
    () =>
      buildTreeHighlightLookup({
        index: spatialIndex,
        diff,
        allocatedIds,
        showFuture,
        searchMatchIds,
        selectedNodeId,
      }),
    [spatialIndex, diff, allocatedIds, showFuture, searchMatchIds, selectedNodeId],
  );

  const currentSpecKey = `${snapshot.profileId}::${diff.selectedSpec?.id ?? "__empty__"}`;
  const restoredCamera =
    savedViewport && savedViewport.specKey === currentSpecKey ? savedViewport.camera : null;

  const getNextBounds = useCallback(
    () =>
      computeNextPassivesBounds({
        diff,
        allocatedIds,
        characterClass: snapshot.characterClass,
        geometry,
      }),
    [diff, allocatedIds, snapshot.characterClass, geometry],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialBounds = useMemo(() => getNextBounds(), []);

  const handleTapWorldPoint = useCallback(
    (hit: WorldPointHit, viewWidth: number) => {
      setSelectedNodeId(
        hitTestPassiveTreeNode({
          index: spatialIndex,
          lookup: highlightLookup,
          worldX: hit.worldX,
          worldY: hit.worldY,
          worldPerPx: hit.worldPerPx,
          viewWidth,
        }),
      );
    },
    [spatialIndex, highlightLookup],
  );

  const handleCameraSettled = useCallback(
    (camera: ViewportCamera) => {
      saveTreeViewport(snapshot.profileId, { specKey: currentSpecKey, camera, manualSpecId });
    },
    [snapshot.profileId, currentSpecKey, manualSpecId],
  );

  const { containerRef, getCamera, subscribeCamera, fitBounds, focusPoint, zoomBy, pointerHandlers } =
    usePanZoomViewport({
      initialBounds,
      initialCameraOverride: restoredCamera,
      onTapWorldPoint: handleTapWorldPoint,
      onCameraSettled: handleCameraSettled,
    });

  useTreeViewportPersistence({
    profileId: snapshot.profileId,
    currentSpecKey,
    manualSpecId,
    hasRestoredCamera: Boolean(restoredCamera),
    getNextBounds,
    fitBounds,
    getCamera,
  });

  const handleSelectManualSpec = useCallback((id: string | null) => {
    setManualSpecId(id);
    setSelectedNodeId(null);
  }, []);

  const handleToggleShowFuture = useCallback(() => setShowFuture((v) => !v), []);

  const handleFitBracket = useCallback(
    () => fitBounds(computeBracketOverviewBounds(diff.targetSet, geometry.nodes)),
    [fitBounds, diff.targetSet, geometry.nodes],
  );

  const handleFocusNextTarget = useCallback(() => {
    fitBounds(getNextBounds());
    setSelectedNodeId(diff.nextNotableTargets[0]?.nodeId ?? null);
  }, [fitBounds, getNextBounds, diff.nextNotableTargets]);

  const handleFocusAscendancy = useCallback(
    () => fitBounds(computeNodeSetBounds(ascendancyNodeIds, geometry.nodes)),
    [fitBounds, ascendancyNodeIds, geometry.nodes],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = geometry.nodes[nodeId];
      if (!node) return;
      setSelectedNodeId(nodeId);
      focusPoint(node.x, node.y, Math.min(getCamera().width, 3200));
    },
    [geometry.nodes, focusPoint, getCamera],
  );

  const handleZoomIn = useCallback(() => zoomBy(0.75), [zoomBy]);
  const handleZoomOut = useCallback(() => zoomBy(1.33), [zoomBy]);

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-5 pt-3 space-y-3">
      <PassiveTreeLevelStepperBar
        characterLevel={snapshot.characterLevel}
        specs={specs}
        selectedIndex={selectedIndex}
        manualSpecId={manualSpecId}
        allocatedIds={allocatedIds}
        diff={diff}
        searchQuery={searchQuery}
        searchMatchCount={searchMatchIds.size}
        showFuture={showFuture}
        hasAscendancyNodes={ascendancyNodeIds.length > 0}
        onSelectManualSpec={handleSelectManualSpec}
        onSearchChange={setSearchQuery}
        onToggleShowFuture={handleToggleShowFuture}
        onFitBracket={handleFitBracket}
        onFocusNextTarget={handleFocusNextTarget}
        onFocusAscendancy={handleFocusAscendancy}
      />

      <div className="flex flex-col lg:flex-row gap-3 items-stretch">
        <PassiveTreeCanvas
          geometry={geometry}
          spatialIndex={spatialIndex}
          highlightLookup={highlightLookup}
          diff={diff}
          allocatedIds={allocatedIds}
          characterClass={snapshot.characterClass}
          selectedNodeId={selectedNodeId}
          containerRef={containerRef}
          getCamera={getCamera}
          subscribeCamera={subscribeCamera}
          onSelectNode={setSelectedNodeId}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          pointerHandlers={pointerHandlers}
        />

        <PassiveTreeSidebarDrawer
          diff={diff}
          nodes={geometry.nodes}
          allocatedIds={allocatedIds}
          onFocusNode={focusNode}
          onTriggerManualSync={onTriggerManualSync}
        />
      </div>
    </main>
  );
}
