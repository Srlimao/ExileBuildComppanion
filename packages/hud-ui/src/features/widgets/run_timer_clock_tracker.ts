import type { HudSessionSnapshot } from "@exile-hud/core";
import { useEffect, useState } from "react";

const NETWORK_LAG_WINDOW_MS = 2_000;
const TICK_POLL_MS = 250;

export interface RunTimerClockAnchor {
  sessionKey: string;
  baseElapsedMs: number;
  runningSinceMs: number | null;
  lastSnapshotElapsedMs: number;
  lastSnapshotVersion: number;
}

const sessionAnchors = new Map<string, RunTimerClockAnchor>();

/** Formats milliseconds as HH:MM:SS, clamping negative inputs to zero. */
export function formatRunTimerClock(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isPristineResetSnapshot(snapshot: HudSessionSnapshot): boolean {
  if (snapshot.runElapsedMs !== 0 || Object.keys(snapshot.actSplitsMs).length > 0) return false;
  if ((snapshot.visitedAreaIds?.length ?? 0) > 0 || (snapshot.clearedAreaIds?.length ?? 0) > 0) return false;
  if (snapshot.checkpoints.some((cp) => cp.completed || cp.softCompleted)) return false;
  if (snapshot.gemSteps.some((gs) => gs.manualCompleted || gs.softAcquired || gs.verifiedByApi)) return false;
  return true;
}

/** Computes current live elapsed milliseconds for a reconciled session timer anchor. */
export function computeLiveRunElapsedMs(anchor: RunTimerClockAnchor, nowMs: number): number {
  return anchor.runningSinceMs !== null
    ? anchor.baseElapsedMs + Math.max(0, nowMs - anchor.runningSinceMs)
    : anchor.baseElapsedMs;
}

/** Reconciles incoming telemetry snapshots against the monotonic client timer anchor. */
export function reconcileRunTimerAnchor(
  prev: RunTimerClockAnchor | null,
  snapshot: HudSessionSnapshot,
  nowMs: number,
): RunTimerClockAnchor {
  const sessionKey = `${snapshot.roomId}::${snapshot.profileId}`;
  const isRunning = Boolean(snapshot.runTimerRunning && snapshot.poeRunning);
  const incomingMs = Math.max(0, snapshot.runElapsedMs);

  if (!prev || prev.sessionKey !== sessionKey) {
    return {
      sessionKey,
      baseElapsedMs: incomingMs,
      runningSinceMs: isRunning ? nowMs : null,
      lastSnapshotElapsedMs: incomingMs,
      lastSnapshotVersion: snapshot.version,
    };
  }

  const isExplicitReset =
    incomingMs < prev.lastSnapshotElapsedMs ||
    (incomingMs === 0 &&
      prev.lastSnapshotElapsedMs === 0 &&
      snapshot.version !== prev.lastSnapshotVersion &&
      isPristineResetSnapshot(snapshot));

  if (isExplicitReset) {
    return {
      sessionKey,
      baseElapsedMs: incomingMs,
      runningSinceMs: isRunning ? nowMs : null,
      lastSnapshotElapsedMs: incomingMs,
      lastSnapshotVersion: snapshot.version,
    };
  }

  if (incomingMs === prev.lastSnapshotElapsedMs) {
    const wasRunning = prev.runningSinceMs !== null;
    if (wasRunning === isRunning && prev.lastSnapshotVersion === snapshot.version) {
      return prev;
    }
    if (wasRunning === isRunning) {
      return { ...prev, lastSnapshotVersion: snapshot.version };
    }
    if (wasRunning && !isRunning) {
      return {
        sessionKey,
        baseElapsedMs: computeLiveRunElapsedMs(prev, nowMs),
        runningSinceMs: null,
        lastSnapshotElapsedMs: incomingMs,
        lastSnapshotVersion: snapshot.version,
      };
    }
    return {
      sessionKey,
      baseElapsedMs: prev.baseElapsedMs,
      runningSinceMs: nowMs,
      lastSnapshotElapsedMs: incomingMs,
      lastSnapshotVersion: snapshot.version,
    };
  }

  const localElapsedMs = computeLiveRunElapsedMs(prev, nowMs);
  const resolvedMs =
    incomingMs >= localElapsedMs
      ? incomingMs
      : localElapsedMs - incomingMs <= NETWORK_LAG_WINDOW_MS
        ? localElapsedMs
        : incomingMs;

  return {
    sessionKey,
    baseElapsedMs: resolvedMs,
    runningSinceMs: isRunning ? nowMs : null,
    lastSnapshotElapsedMs: incomingMs,
    lastSnapshotVersion: snapshot.version,
  };
}

/** Updates and returns the module-level timer anchor for the snapshot's session. */
export function syncRunTimerSnapshot(snapshot: HudSessionSnapshot, nowMs = Date.now()): RunTimerClockAnchor {
  const sessionKey = `${snapshot.roomId}::${snapshot.profileId}`;
  const prev = sessionAnchors.get(sessionKey) ?? null;
  const next = reconcileRunTimerAnchor(prev, snapshot, nowMs);
  if (next !== prev) {
    sessionAnchors.set(sessionKey, next);
  }
  return next;
}

/** Clears cached timer anchors (primarily for isolated unit tests). */
export function clearRunTimerAnchorCache(): void {
  sessionAnchors.clear();
}

/** React hook providing continuous elapsed time across HUD tab/widget unmount-remount cycles. */
export function useLiveRunElapsedMs(snapshot: HudSessionSnapshot): number {
  const anchor = syncRunTimerSnapshot(snapshot);
  const [displayMs, setDisplayMs] = useState(() => computeLiveRunElapsedMs(anchor, Date.now()));

  useEffect(() => {
    const nextAnchor = syncRunTimerSnapshot(snapshot);
    setDisplayMs(computeLiveRunElapsedMs(nextAnchor, Date.now()));
    if (nextAnchor.runningSinceMs === null) return;

    const id = window.setInterval(() => {
      setDisplayMs((prev) => {
        const currentAnchor = syncRunTimerSnapshot(snapshot);
        const next = computeLiveRunElapsedMs(currentAnchor, Date.now());
        return Math.floor(next / 1000) === Math.floor(prev / 1000) ? prev : next;
      });
    }, TICK_POLL_MS);

    return () => window.clearInterval(id);
  }, [snapshot]);

  return displayMs;
}
