import {
  buildInitialSessionSnapshot,
  reduceTelemetrySession,
  resetSnapshotProgress,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  clearRunTimerAnchorCache,
  computeLiveRunElapsedMs,
  formatRunTimerClock,
  syncRunTimerSnapshot,
} from "@exile-hud/hud-ui";
import { beforeEach, describe, expect, it } from "vitest";

function createTestSnapshot(overrides?: Partial<HudSessionSnapshot>): HudSessionSnapshot {
  const build = validateAndEnrichPobBuild(
    {
      buildName: "TimerContinuityBuild",
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      bandit: "None",
      buildLevel: 10,
      skillSets: [],
      treeSpecs: [],
      itemSets: [],
      uniqueRequiredGems: [],
    },
    poe1GameAdapter,
  );
  const base = buildInitialSessionSnapshot({
    roomId: "TIMER1",
    profileId: "prof-timer",
    build,
    checkpoints: [
      {
        id: "cp_1",
        sectionAct: 1,
        areaId: "1_1_2",
        areaName: "The Coast",
        title: "Touch Waypoint",
        category: "MANDATORY_PATH",
        stepKind: "waypoint",
        completed: false,
        softCompleted: false,
      },
    ],
    gemSteps: [
      {
        id: "gem_1",
        gemName: "Frostblink",
        gemId: "Metadata/Items/Gems/SkillGemFrostblink",
        color: "B",
        act: 1,
        townAreaId: "1_1_town",
        townName: "Lioneye's Watch",
        acquireVia: "quest",
        questName: "Enemy at the Gate",
        vendorName: "Nessa",
        costCurrency: "Free",
        manualCompleted: false,
        softAcquired: false,
        verifiedByApi: false,
      },
    ],
    adapter: poe1GameAdapter,
  });

  return {
    ...base,
    poeRunning: true,
    runTimerRunning: true,
    runElapsedMs: 142_000,
    ...overrides,
  };
}

describe("run_timer_clock_tracker continuity across tabs and modes", () => {
  beforeEach(() => {
    clearRunTimerAnchorCache();
  });

  it("preserves continuous elapsed time across FIELD -> TOWN -> TREE -> LAB -> FIELD switches", () => {
    const snap = createTestSnapshot({ runElapsedMs: 142_000 });
    const t0 = 1_000_000;

    // Mounted in FIELD
    const fieldStart = syncRunTimerSnapshot(snap, t0);
    expect(computeLiveRunElapsedMs(fieldStart, t0)).toBe(142_000);

    // 12 seconds later: user switches to TOWN (RunTimerWidget unmounted)
    const townAnchor = syncRunTimerSnapshot({ ...snap, mode: "TOWN" }, t0 + 12_000);
    expect(computeLiveRunElapsedMs(townAnchor, t0 + 12_000)).toBe(154_000);

    // 30 seconds later: user switches to TREE tab (grid unmounted)
    const treeAnchor = syncRunTimerSnapshot(snap, t0 + 42_000);
    expect(computeLiveRunElapsedMs(treeAnchor, t0 + 42_000)).toBe(184_000);

    // 18 seconds later: user switches to LAB, then back to FIELD — must NOT reset to 142_000
    const labAnchor = syncRunTimerSnapshot({ ...snap, mode: "LAB" }, t0 + 60_000);
    expect(computeLiveRunElapsedMs(labAnchor, t0 + 60_000)).toBe(202_000);
    expect(formatRunTimerClock(computeLiveRunElapsedMs(labAnchor, t0 + 60_000))).toBe("00:03:22");
  });

  it("primes the clock anchor even if initial load starts on TOWN or TREE without RunTimerWidget", () => {
    const snap = createTestSnapshot({ runElapsedMs: 60_000, mode: "TOWN" });
    syncRunTimerSnapshot(snap, 50_000);

    // 25 seconds spent shopping in TOWN / checking TREE before switching to FIELD
    const remountAnchor = syncRunTimerSnapshot({ ...snap, mode: "FIELD" }, 75_000);
    expect(computeLiveRunElapsedMs(remountAnchor, 75_000)).toBe(85_000);
  });

  it("keeps elapsed time continuous across local checkpoint and gem toggles", () => {
    const start = createTestSnapshot({ runElapsedMs: 100_000 });
    syncRunTimerSnapshot(start, 10_000);

    const toggledCp = reduceTelemetrySession(start, { type: "toggle_checkpoint", checkpointId: "cp_1" }, poe1GameAdapter);
    syncRunTimerSnapshot(toggledCp, 15_400);

    const toggledGem = reduceTelemetrySession(toggledCp, { type: "toggle_gem", gemStepId: "gem_1" }, poe1GameAdapter);
    const afterToggle = syncRunTimerSnapshot(toggledGem, 20_900);

    expect(computeLiveRunElapsedMs(afterToggle, 20_900)).toBe(110_900);
  });

  it("freezes on pause while viewing TREE and resumes cleanly without counting standby downtime", () => {
    const running = createTestSnapshot({ runElapsedMs: 120_000 });
    syncRunTimerSnapshot(running, 10_000);

    // User pauses PoE 15 seconds later while in TREE tab
    const pausedSnap = reduceTelemetrySession(running, { type: "process_state", running: false }, poe1GameAdapter);
    const pausedAnchor = syncRunTimerSnapshot(pausedSnap, 25_000);
    expect(computeLiveRunElapsedMs(pausedAnchor, 25_000)).toBe(135_000);
    expect(computeLiveRunElapsedMs(pausedAnchor, 625_000)).toBe(135_000);

    // 10 minutes later PoE restarts
    const resumedSnap = reduceTelemetrySession(pausedSnap, { type: "process_state", running: true }, poe1GameAdapter);
    const resumedAnchor = syncRunTimerSnapshot(resumedSnap, 625_000);
    expect(computeLiveRunElapsedMs(resumedAnchor, 635_000)).toBe(145_000);
  });

  it("reconciles authoritative host runElapsedMs advances smoothly within network jitter", () => {
    const start = createTestSnapshot({ runElapsedMs: 100_000 });
    syncRunTimerSnapshot(start, 10_000);

    // Host reports +10_000ms after 10_500ms local time (500ms lag window -> no 1s backward flicker)
    const minorLagSnap: HudSessionSnapshot = { ...start, version: start.version + 1, runElapsedMs: 110_000 };
    const lagAnchor = syncRunTimerSnapshot(minorLagSnap, 20_500);
    expect(computeLiveRunElapsedMs(lagAnchor, 20_500)).toBe(110_500);

    // Host jumps further ahead (e.g., catch-up after reconnect)
    const aheadSnap: HudSessionSnapshot = { ...minorLagSnap, version: minorLagSnap.version + 1, runElapsedMs: 130_000 };
    const aheadAnchor = syncRunTimerSnapshot(aheadSnap, 25_000);
    expect(computeLiveRunElapsedMs(aheadAnchor, 25_000)).toBe(130_000);
  });

  it("resets timer and act splits on resetSnapshotProgress even when host runElapsedMs was still 0", () => {
    const dirtyFromNonZero = createTestSnapshot({ runElapsedMs: 142_000, actSplitsMs: { act_1: 120_000 } });
    syncRunTimerSnapshot(dirtyFromNonZero, 10_000);
    const resetNonZero = resetSnapshotProgress(dirtyFromNonZero);
    expect(resetNonZero.runElapsedMs).toBe(0);
    expect(resetNonZero.actSplitsMs).toEqual({});
    const resetAnchor1 = syncRunTimerSnapshot(resetNonZero, 30_000);
    expect(computeLiveRunElapsedMs(resetAnchor1, 30_000)).toBe(0);

    // Case where runElapsedMs was still 0, client ticked locally for 20s, and user hit Reset Progress
    clearRunTimerAnchorCache();
    let dirtyAtZero = createTestSnapshot({ runElapsedMs: 0, version: 1 });
    dirtyAtZero = reduceTelemetrySession(dirtyAtZero, { type: "toggle_checkpoint", checkpointId: "cp_1" }, poe1GameAdapter);
    syncRunTimerSnapshot(dirtyAtZero, 10_000);
    expect(computeLiveRunElapsedMs(syncRunTimerSnapshot(dirtyAtZero, 30_000), 30_000)).toBe(20_000);

    const resetAtZero = resetSnapshotProgress(dirtyAtZero);
    const resetAnchor2 = syncRunTimerSnapshot(resetAtZero, 30_000);
    expect(computeLiveRunElapsedMs(resetAnchor2, 30_000)).toBe(0);
  });
});
