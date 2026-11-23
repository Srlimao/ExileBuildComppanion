import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:pwa-register", () => ({
  registerSW: vi.fn(() => vi.fn(async () => undefined)),
}));

import {
  classifyTouchMoveIntent,
  computeDampedPullDistance,
  isTargetBlockedFromPullRefresh,
  PULL_DEADZONE_PX,
  PULL_MAX_DISTANCE_PX,
} from "../src/features/pwa_refresh/pull_to_refresh_math.js";
import { forcePwaRefresh } from "../src/features/pwa_refresh/pwa_service_worker_controller.js";

function createMockElement(opts: {
  matchesSelector?: boolean;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  overflowY?: string;
  parent?: unknown;
}) {
  return {
    scrollTop: opts.scrollTop ?? 0,
    scrollHeight: opts.scrollHeight ?? 100,
    clientHeight: opts.clientHeight ?? 100,
    parentElement: opts.parent ?? null,
    overflowY: opts.overflowY ?? "visible",
    closest: (selector: string) => (opts.matchesSelector && selector ? {} : null),
  };
}

describe("pull_to_refresh_math", () => {
  it("applies deadzone and damped resistance up to PULL_MAX_DISTANCE_PX", () => {
    expect(computeDampedPullDistance(0)).toBe(0);
    expect(computeDampedPullDistance(PULL_DEADZONE_PX)).toBe(0);

    const d1 = computeDampedPullDistance(40);
    const d2 = computeDampedPullDistance(120);
    const d3 = computeDampedPullDistance(2000);
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
    expect(d3).toBeLessThanOrEqual(PULL_MAX_DISTANCE_PX);
  });

  it("classifies touch move intent into pull, cancel, or undecided", () => {
    expect(classifyTouchMoveIntent(4, 6)).toBe("undecided");
    expect(classifyTouchMoveIntent(3, -30)).toBe("cancel");
    expect(classifyTouchMoveIntent(45, 25)).toBe("cancel");
    expect(classifyTouchMoveIntent(10, 40)).toBe("pull");
  });

  it("blocks pull-to-refresh inside canvases/dialogs/touch-none and scrolled containers", () => {
    const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    const bodyMarker = { nodeName: "BODY" };

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { body: bodyMarker, documentElement: {} },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        getComputedStyle: (el: { overflowY?: string }) => ({ overflowY: el.overflowY ?? "visible" }),
      },
    });

    try {
      expect(isTargetBlockedFromPullRefresh(null)).toBe(false);

      const blockedBySelector = createMockElement({ matchesSelector: true, parent: bodyMarker });
      expect(isTargetBlockedFromPullRefresh(blockedBySelector as unknown as EventTarget)).toBe(true);

      const scrolledAncestor = createMockElement({
        scrollTop: 42,
        scrollHeight: 400,
        clientHeight: 150,
        overflowY: "auto",
        parent: bodyMarker,
      });
      const childInsideScrolled = createMockElement({ parent: scrolledAncestor });
      expect(isTargetBlockedFromPullRefresh(childInsideScrolled as unknown as EventTarget)).toBe(true);

      const topScrollContainer = createMockElement({
        scrollTop: 0,
        scrollHeight: 400,
        clientHeight: 150,
        overflowY: "auto",
        parent: bodyMarker,
      });
      const childAtTop = createMockElement({ parent: topScrollContainer });
      expect(isTargetBlockedFromPullRefresh(childAtTop as unknown as EventTarget)).toBe(false);
    } finally {
      if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });
});

describe("forcePwaRefresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls registration.update() and reloads", async () => {
    const update = vi.fn(async () => undefined);
    const reload = vi.fn();
    await forcePwaRefresh({
      registration: { update, installing: null, waiting: null } as unknown as ServiceWorkerRegistration,
      updateSw: null,
      reload,
      timeoutMs: 200,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("activates a waiting service worker via updateSw(true) and reloads", async () => {
    const update = vi.fn(async () => undefined);
    const updateSw = vi.fn(async () => undefined);
    const reload = vi.fn();
    await forcePwaRefresh({
      registration: { update, installing: null, waiting: {} } as unknown as ServiceWorkerRegistration,
      updateSw,
      reload,
      timeoutMs: 200,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateSw).toHaveBeenCalledWith(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads within timeoutMs if registration.update() hangs or rejects", async () => {
    const hangingUpdate = vi.fn(() => new Promise<void>(() => undefined));
    const reloadHanging = vi.fn();
    await forcePwaRefresh({
      registration: { update: hangingUpdate, installing: null, waiting: null } as unknown as ServiceWorkerRegistration,
      updateSw: null,
      reload: reloadHanging,
      timeoutMs: 30,
    });
    expect(reloadHanging).toHaveBeenCalledTimes(1);

    const failingUpdate = vi.fn(async () => {
      throw new Error("Offline");
    });
    const reloadOffline = vi.fn();
    await forcePwaRefresh({
      registration: { update: failingUpdate, installing: null, waiting: null } as unknown as ServiceWorkerRegistration,
      updateSw: null,
      reload: reloadOffline,
      timeoutMs: 50,
    });
    expect(reloadOffline).toHaveBeenCalledTimes(1);
  });
});
