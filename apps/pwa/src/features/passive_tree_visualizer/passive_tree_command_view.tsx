import type { HudSessionSnapshot } from "@exile-hud/core";
import {
  computeBracketProgressionDiff,
  resolveEffectiveAllocatedSet,
  selectBracketSpecIndex,
  sortTreeSpecsByLevel,
} from "@exile-hud/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { PassiveTreeCanvasSvg } from "./passive_tree_canvas_svg.js";
import {
  computeNodeSetBounds,
  getBuiltPoe1TreeGeometry,
  resolveVisibleAscendancies,
} from "./passive_tree_geometry_builder.js";
import { PassiveTreeLevelStepperBar } from "./passive_tree_level_stepper_bar.js";
import { PassiveTreeSidebarDrawer } from "./passive_tree_sidebar_drawer.js";
import { usePanZoomViewport } from "./use_pan_zoom_viewport.js";

interface PassiveTreeCommandViewProps {
  snapshot: HudSessionSnapshot;
  onToggleAllocatedNodes: (nodeIds: string[], allocated: boolean, clearOverrides?: boolean) => void;
  onTriggerManualSync: () => void;
}

/** Full-canvas interactive GGG 3.30.0 passive tree workspace rendered on the 4th TREE tab. */
export function PassiveTreeCommandView({
  snapshot,
  onToggleAllocatedNodes,
  onTriggerManualSync,
}: PassiveTreeCommandViewProps) {
  const geometry = useMemo(() => getBuiltPoe1TreeGeometry(), []);
  const specs = useMemo(
    () => sortTreeSpecsByLevel(snapshot.passiveTree.specs ?? []),
    [snapshot.passiveTree.specs],
  );

  const [manualSpecId, setManualSpecId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const ascendancyNodeIds = useMemo(
    () => visibleNodes.filter((n) => Boolean(n.ascendancyName)).map((n) => n.id),
    [visibleNodes],
  );

  const searchMatchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const node of visibleNodes) {
      if (node.name.toLowerCase().includes(q) || node.stats.some((s) => s.toLowerCase().includes(q))) {
        hits.add(node.id);
      }
    }
    return hits;
  }, [searchQuery, visibleNodes]);

  const initialBounds = useMemo(
    () => computeNodeSetBounds(diff.targetSet, geometry.nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const viewport = usePanZoomViewport(initialBounds);
  const lastFittedSpecKey = useRef<string>("");

  useEffect(() => {
    const specKey = diff.selectedSpec?.id ?? "__empty__";
    if (lastFittedSpecKey.current === specKey) return;
    lastFittedSpecKey.current = specKey;
    viewport.fitBounds(computeNodeSetBounds(diff.targetSet, geometry.nodes));
  }, [diff.selectedSpec?.id, diff.targetSet, geometry.nodes, viewport]);

  const focusNode = (nodeId: string) => {
    const node = geometry.nodes[nodeId];
    if (!node) return;
    setSelectedNodeId(nodeId);
    viewport.focusPoint(node.x, node.y, Math.min(viewport.viewWidth, 3200));
  };

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-5 pt-3 space-y-3">
      <PassiveTreeLevelStepperBar
        characterLevel={snapshot.characterLevel}
        specs={specs}
        selectedIndex={selectedIndex}
        manualSpecId={manualSpecId}
        allocatedIds={allocatedIds}
        overrideCount={snapshot.passiveTree.localOverrideNodeIds?.length ?? 0}
        diff={diff}
        searchQuery={searchQuery}
        searchMatchCount={searchMatchIds.size}
        showFuture={showFuture}
        hasAscendancyNodes={ascendancyNodeIds.length > 0}
        onSelectManualSpec={(id) => {
          setManualSpecId(id);
          setSelectedNodeId(null);
        }}
        onSearchChange={setSearchQuery}
        onToggleShowFuture={() => setShowFuture((v) => !v)}
        onFitBracket={() => viewport.fitBounds(computeNodeSetBounds(diff.targetSet, geometry.nodes))}
        onFocusNextTarget={() => {
          const next = diff.nextNotableTargets[0];
          if (next) focusNode(next.nodeId);
        }}
        onFocusAscendancy={() => viewport.fitBounds(computeNodeSetBounds(ascendancyNodeIds, geometry.nodes))}
        onClearLocalOverrides={() => onToggleAllocatedNodes([], false, true)}
      />

      <div className="flex flex-col lg:flex-row gap-3 items-stretch">
        <PassiveTreeCanvasSvg
          geometry={geometry}
          visibleEdges={visibleEdges}
          visibleNodes={visibleNodes}
          diff={diff}
          allocatedIds={allocatedIds}
          characterClass={snapshot.characterClass}
          showFuture={showFuture}
          searchMatchIds={searchMatchIds}
          selectedNodeId={selectedNodeId}
          containerRef={viewport.containerRef}
          viewBox={viewport.viewBox}
          onSelectNode={setSelectedNodeId}
          onToggleAllocatedNodes={(ids, alloc) => onToggleAllocatedNodes(ids, alloc)}
          onZoomIn={() => viewport.zoomBy(0.75)}
          onZoomOut={() => viewport.zoomBy(1.33)}
          onPointerDown={viewport.onPointerDown}
          onPointerMove={viewport.onPointerMove}
          consumeDragMoved={viewport.consumeDragMoved}
        />

        <PassiveTreeSidebarDrawer
          diff={diff}
          nodes={geometry.nodes}
          allocatedIds={allocatedIds}
          onFocusNode={focusNode}
          onToggleAllocatedNodes={(ids, alloc) => onToggleAllocatedNodes(ids, alloc)}
          onTriggerManualSync={onTriggerManualSync}
        />
      </div>
    </main>
  );
}
