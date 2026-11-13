import { computeBracketProgressionDiff, resolveEffectiveAllocatedSet, selectBracketSpecIndex, sortTreeSpecsByLevel } from "@exile-hud/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInteractiveDemoSnapshot } from "../src/features/pairing_and_connection/demo_campaign_snapshot_factory.js";
import {
  computeNextPassivesBounds,
  getBuiltPoe1TreeGeometry,
} from "../src/features/passive_tree_visualizer/passive_tree_geometry_builder.js";
import {
  clearSavedTreeViewportCache,
  loadSavedTreeViewport,
  saveTreeViewport,
} from "../src/features/passive_tree_visualizer/passive_tree_viewport_storage.js";
import {
  clampViewWidth,
  computeCursorZoomCamera,
  computePinchedCamera,
  createPinchAnchor,
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  type ViewportCamera,
  type ViewportRect,
} from "../src/features/passive_tree_visualizer/pinch_zoom_math.js";

const RECT: ViewportRect = { left: 100, top: 50, width: 800, height: 600 };

describe("pinch_zoom_math", () => {
  it("halves viewBox width on 2x finger spread while keeping the off-center world midpoint stationary", () => {
    const startCamera: ViewportCamera = { centerX: 1200, centerY: -800, width: 4000 };
    // Off-center midpoint at (620, 410) -> fx = (620 - 100)/800 - 0.5 = 0.15, fy = (410 - 50)/600 - 0.5 = 0.1
    const p1Start = { x: 520, y: 410 };
    const p2Start = { x: 720, y: 410 }; // startDist = 200
    const anchor = createPinchAnchor(p1Start, p2Start, startCamera, RECT);

    // Spread 2x (dist = 400) around the exact same screen midpoint (620, 410)
    const p1End = { x: 420, y: 410 };
    const p2End = { x: 820, y: 410 };
    const next = computePinchedCamera(p1End, p2End, anchor, RECT);

    expect(next.width).toBeCloseTo(2000, 6);

    // Check that world coordinate under screen midpoint (620, 410) equals anchor worldX/worldY
    const fx = 0.15;
    const fy = 0.1;
    const nextHeight = next.width * (RECT.height / RECT.width);
    const worldUnderMidX = next.centerX + fx * next.width;
    const worldUnderMidY = next.centerY + fy * nextHeight;
    expect(worldUnderMidX).toBeCloseTo(anchor.worldX, 6);
    expect(worldUnderMidY).toBeCloseTo(anchor.worldY, 6);
  });

  it("pans camera 1:1 with two-finger midpoint translation when distance is constant", () => {
    const startCamera: ViewportCamera = { centerX: 0, centerY: 0, width: 8000 };
    // At width = 8000 over 800px, 1px = 10 world units
    const p1Start = { x: 400, y: 300 };
    const p2Start = { x: 600, y: 300 };
    const anchor = createPinchAnchor(p1Start, p2Start, startCamera, RECT);

    // Shift both fingers right by +40px and down by +25px (width unchanged -> 400w, 250w shift)
    const next = computePinchedCamera(
      { x: 440, y: 325 },
      { x: 640, y: 325 },
      anchor,
      RECT,
    );

    expect(next.width).toBeCloseTo(8000, 6);
    expect(next.centerX).toBeCloseTo(-400, 6);
    expect(next.centerY).toBeCloseTo(-250, 6);
  });

  it("clamps viewBox width to MIN_VIEW_WIDTH and MAX_VIEW_WIDTH cleanly without NaN or drift", () => {
    expect(clampViewWidth(100)).toBe(MIN_VIEW_WIDTH);
    expect(clampViewWidth(999999)).toBe(MAX_VIEW_WIDTH);

    const startCamera: ViewportCamera = { centerX: 500, centerY: -300, width: 1000 };
    const anchor = createPinchAnchor(
      { x: 480, y: 350 },
      { x: 520, y: 350 },
      startCamera,
      RECT,
    );

    // Extreme spread -> hits MIN_VIEW_WIDTH while still keeping midpoint world anchor intact
    const zoomedIn = computePinchedCamera({ x: 100, y: 350 }, { x: 900, y: 350 }, anchor, RECT);
    expect(zoomedIn.width).toBe(MIN_VIEW_WIDTH);
    expect(Number.isFinite(zoomedIn.centerX)).toBe(true);
    expect(Number.isFinite(zoomedIn.centerY)).toBe(true);
    expect(zoomedIn.centerX).toBeCloseTo(anchor.worldX, 6);
    expect(zoomedIn.centerY).toBeCloseTo(anchor.worldY, 6);

    // Extreme pinch together from wide camera -> hits MAX_VIEW_WIDTH cleanly
    const wideAnchor = createPinchAnchor(
      { x: 400, y: 350 },
      { x: 600, y: 350 },
      { centerX: 500, centerY: -300, width: 12000 },
      RECT,
    );
    const zoomedOut = computePinchedCamera({ x: 500, y: 350 }, { x: 501, y: 350 }, wideAnchor, RECT);
    expect(zoomedOut.width).toBe(MAX_VIEW_WIDTH);
    expect(Number.isFinite(zoomedOut.centerX)).toBe(true);
    expect(Number.isFinite(zoomedOut.centerY)).toBe(true);

    // Cursor zoom keeps cursor world coordinate anchored even near clamp boundaries
    const wheelZoomed = computeCursorZoomCamera(700, 200, 0.2, startCamera, RECT);
    expect(wheelZoomed.width).toBe(MIN_VIEW_WIDTH);
    const fx = (700 - RECT.left) / RECT.width - 0.5;
    const prevWorldX = startCamera.centerX + fx * startCamera.width;
    const nextWorldX = wheelZoomed.centerX + fx * wheelZoomed.width;
    expect(nextWorldX).toBeCloseTo(prevWorldX, 6);
  });

  it("frames computeNextPassivesBounds tightly around next unallocated passives instead of entire tree/Ascendancy", () => {
    const snap = createInteractiveDemoSnapshot();
    const geometry = getBuiltPoe1TreeGeometry();
    const specs = sortTreeSpecsByLevel(snap.passiveTree.specs ?? []);
    const selectedIndex = selectBracketSpecIndex(specs, snap.characterLevel);
    const allocatedIds = resolveEffectiveAllocatedSet(snap.passiveTree);
    const diff = computeBracketProgressionDiff({
      specs,
      selectedIndex,
      allocatedIds,
      characterClass: snap.characterClass,
      adapter: {
        getPassiveTreeNodes: () => geometry.nodes,
        getPassiveTreeGraphMeta: () => geometry.meta,
      } as Parameters<typeof computeBracketProgressionDiff>[0]["adapter"],
    });

    const bounds = computeNextPassivesBounds({
      diff,
      allocatedIds,
      characterClass: snap.characterClass,
      geometry,
    });

    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(3600);
    expect(bounds.maxY - bounds.minY).toBeLessThanOrEqual(3600);

    for (const id of ["7938", "1031", "21958"]) {
      const node = geometry.nodes[id]!;
      expect(node.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(node.x).toBeLessThanOrEqual(bounds.maxX);
      expect(node.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(node.y).toBeLessThanOrEqual(bounds.maxY);
    }

    const ascNode = geometry.nodes["16023"]!;
    expect(ascNode.y).toBeLessThan(bounds.minY);
  });
});

describe("passive_tree_viewport_storage", () => {
  beforeEach(() => clearSavedTreeViewportCache(true));
  afterEach(() => clearSavedTreeViewportCache(true));

  it("persists and restores camera and manualSpecId per profile with clamped zoom width", () => {
    saveTreeViewport(
      "profile-a",
      {
        specKey: "profile-a::spec_40",
        camera: { centerX: -1450, centerY: -4200, width: 120 },
        manualSpecId: "spec_40",
      },
      true,
    );
    saveTreeViewport(
      "profile-b",
      {
        specKey: "profile-b::spec_75",
        camera: { centerX: 500, centerY: 1200, width: 99999 },
        manualSpecId: null,
      },
      true,
    );

    const a = loadSavedTreeViewport("profile-a");
    const b = loadSavedTreeViewport("profile-b");
    expect(a?.specKey).toBe("profile-a::spec_40");
    expect(a?.manualSpecId).toBe("spec_40");
    expect(a?.camera).toEqual({ centerX: -1450, centerY: -4200, width: MIN_VIEW_WIDTH });

    expect(b?.specKey).toBe("profile-b::spec_75");
    expect(b?.manualSpecId).toBeNull();
    expect(b?.camera).toEqual({ centerX: 500, centerY: 1200, width: MAX_VIEW_WIDTH });
    expect(loadSavedTreeViewport("profile-missing")).toBeNull();
  });

  it("re-hydrates saved camera cleanly across simulated browser reloads", () => {
    const store = new Map<string, string>();
    const prevStorage = (globalThis as { localStorage?: unknown }).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    try {
      saveTreeViewport(
        "demo",
        {
          specKey: "demo::spec_act4",
          camera: { centerX: -1800, centerY: -6400, width: 1420 },
          manualSpecId: "spec_act4",
        },
        true,
      );
      clearSavedTreeViewportCache(false);

      const restored = loadSavedTreeViewport("demo");
      expect(restored?.specKey).toBe("demo::spec_act4");
      expect(restored?.manualSpecId).toBe("spec_act4");
      expect(restored?.camera).toEqual({ centerX: -1800, centerY: -6400, width: 1420 });
    } finally {
      clearSavedTreeViewportCache(true);
      if (prevStorage === undefined) {
        Reflect.deleteProperty(globalThis, "localStorage");
      } else {
        Object.defineProperty(globalThis, "localStorage", { configurable: true, value: prevStorage });
      }
    }
  });
});
