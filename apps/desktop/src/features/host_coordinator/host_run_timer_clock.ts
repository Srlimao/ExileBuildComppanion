import type { HudSessionSnapshot } from "@exile-hud/core";

export interface HostRunTimerClock {
  syncBaseSnapshot: (snap: HudSessionSnapshot) => HudSessionSnapshot;
  advanceSnapshotRef: (snapshotRef: { current: HudSessionSnapshot | null }) => HudSessionSnapshot | null;
  reconcileOutgoingSnapshot: (
    prev: HudSessionSnapshot | null,
    next: HudSessionSnapshot,
    eventTag: string,
  ) => HudSessionSnapshot;
}

/** Tracks wall-clock deltas for the desktop host snapshot without polling intervals. */
export function createHostRunTimerClock(nowFn: () => number = Date.now): HostRunTimerClock {
  let lastTickAtMs: number | null = null;

  const isTimerActive = (snap: HudSessionSnapshot | null): boolean =>
    Boolean(snap?.poeRunning && snap?.runTimerRunning);

  return {
    syncBaseSnapshot(snap) {
      lastTickAtMs = isTimerActive(snap) ? nowFn() : null;
      return snap;
    },

    advanceSnapshotRef(snapshotRef) {
      const cur = snapshotRef.current;
      if (!cur) {
        lastTickAtMs = null;
        return null;
      }
      const now = nowFn();
      if (isTimerActive(cur)) {
        const delta = lastTickAtMs !== null ? Math.max(0, now - lastTickAtMs) : 0;
        lastTickAtMs = now;
        if (delta > 0) {
          snapshotRef.current = { ...cur, runElapsedMs: cur.runElapsedMs + delta };
        }
        return snapshotRef.current;
      }
      lastTickAtMs = null;
      return cur;
    },

    reconcileOutgoingSnapshot(prev, next, eventTag) {
      const now = nowFn();
      if (eventTag === "reset_progress" || eventTag === "viewer_reset_progress") {
        lastTickAtMs = isTimerActive(next) ? now : null;
        return next;
      }
      const prevRunning = isTimerActive(prev);
      const nextRunning = isTimerActive(next);
      const delta = prevRunning && lastTickAtMs !== null ? Math.max(0, now - lastTickAtMs) : 0;
      lastTickAtMs = nextRunning ? now : null;
      return delta > 0 ? { ...next, runElapsedMs: next.runElapsedMs + delta } : next;
    },
  };
}
