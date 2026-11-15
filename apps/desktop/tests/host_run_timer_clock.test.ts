import {
  buildInitialSessionSnapshot,
  reduceTelemetrySession,
  resetSnapshotProgress,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import { createHostRunTimerClock } from "../src/features/host_coordinator/host_run_timer_clock.js";

function makeSnapshot(overrides?: Partial<HudSessionSnapshot>): HudSessionSnapshot {
  const build = validateAndEnrichPobBuild(
    {
      buildName: "HostTimerTest",
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      bandit: "None",
      buildLevel: 1,
      skillSets: [],
      treeSpecs: [],
      itemSets: [],
      uniqueRequiredGems: [],
    },
    poe1GameAdapter,
  );
  return {
    ...buildInitialSessionSnapshot({
      roomId: "HOST1",
      profileId: "prof-host",
      build,
      checkpoints: [],
      gemSteps: [],
      adapter: poe1GameAdapter,
    }),
    poeRunning: true,
    runTimerRunning: true,
    ...overrides,
  };
}

describe("host_run_timer_clock", () => {
  it("accumulates elapsed ms across log advances, overlay hydration, pause/resume, and reset", () => {
    let now = 10_000;
    const clock = createHostRunTimerClock(() => now);
    const snapshotRef: { current: HudSessionSnapshot | null } = {
      current: clock.syncBaseSnapshot(makeSnapshot({ runElapsedMs: 0 })),
    };

    // 15 seconds pass before a log check that does not produce a patch (non-matching log line)
    now = 25_000;
    const afterCheck = clock.advanceSnapshotRef(snapshotRef);
    expect(afterCheck?.runElapsedMs).toBe(15_000);
    expect(snapshotRef.current?.runElapsedMs).toBe(15_000);

    // 10 more seconds pass, then PoE closes -> reconcileOutgoingSnapshot stamps full 25s
    now = 35_000;
    const pausedRaw = reduceTelemetrySession(snapshotRef.current!, { type: "process_state", running: false }, poe1GameAdapter);
    const pausedNext = clock.reconcileOutgoingSnapshot(snapshotRef.current, pausedRaw, "poe_process");
    snapshotRef.current = pausedNext;
    expect(pausedNext.runElapsedMs).toBe(25_000);
    expect(pausedNext.runTimerRunning).toBe(false);

    // 60 seconds pass while paused -> advanceSnapshotRef adds 0ms
    now = 95_000;
    expect(clock.advanceSnapshotRef(snapshotRef)?.runElapsedMs).toBe(25_000);

    // PoE restarts at t=95_000; 5s later viewer hydrates overlay via advanceSnapshotRef -> 30s
    const resumedRaw = reduceTelemetrySession(snapshotRef.current!, { type: "process_state", running: true }, poe1GameAdapter);
    snapshotRef.current = clock.reconcileOutgoingSnapshot(snapshotRef.current, resumedRaw, "poe_process");
    now = 100_000;
    expect(clock.advanceSnapshotRef(snapshotRef)?.runElapsedMs).toBe(30_000);

    // Explicit reset zeroes elapsed time without carrying prior delta
    now = 120_000;
    const resetRaw = resetSnapshotProgress(snapshotRef.current!);
    const resetNext = clock.reconcileOutgoingSnapshot(snapshotRef.current, resetRaw, "reset_progress");
    expect(resetNext.runElapsedMs).toBe(0);
    expect(resetNext.actSplitsMs).toEqual({});
  });
});
