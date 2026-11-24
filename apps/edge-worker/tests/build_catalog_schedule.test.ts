import { describe, expect, it } from "vitest";
import {
  COOL_INTERVAL_MS,
  evaluateSyncSchedule,
  HOT_INTERVAL_MS,
} from "../src/features/build_catalog/league_window_schedule_evaluator.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("league_window_schedule_evaluator", () => {
  const leagueStart = Date.parse("2026-11-13T19:00:00Z");

  it("uses 48h hot cadence from 7 days before league start through 30 days after", () => {
    const sixDaysBefore = leagueStart - 6 * DAY_MS;
    const d1 = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: null,
        nextLeagueOverrideStartAt: null,
        lastSyncedAt: sixDaysBefore - 36 * 60 * 60 * 1000,
      },
      sixDaysBefore,
      { leagueName: "Covens", startAtIso: "2026-11-13T19:00:00Z" },
    );
    expect(d1.cadenceMode).toBe("hot_2d");
    expect(d1.shouldRun).toBe(false);

    const twentyDaysAfter = leagueStart + 20 * DAY_MS;
    const d2 = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: null,
        nextLeagueOverrideStartAt: null,
        lastSyncedAt: twentyDaysAfter - HOT_INTERVAL_MS - 1000,
      },
      twentyDaysAfter,
      { leagueName: "Covens", startAtIso: "2026-11-13T19:00:00Z" },
    );
    expect(d2.cadenceMode).toBe("hot_2d");
    expect(d2.shouldRun).toBe(true);
  });

  it("cools off to 7-day weekly cadence after 30 days post-launch", () => {
    const fortyDaysAfter = leagueStart + 40 * DAY_MS;
    const d = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: null,
        nextLeagueOverrideStartAt: null,
        lastSyncedAt: fortyDaysAfter - 3 * DAY_MS,
      },
      fortyDaysAfter,
      { leagueName: "Covens", startAtIso: "2026-11-13T19:00:00Z" },
    );
    expect(d.cadenceMode).toBe("cool_weekly");
    expect(d.shouldRun).toBe(false);

    const due = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: null,
        nextLeagueOverrideStartAt: null,
        lastSyncedAt: fortyDaysAfter - COOL_INTERVAL_MS - 1000,
      },
      fortyDaysAfter,
      { leagueName: "Covens", startAtIso: "2026-11-13T19:00:00Z" },
    );
    expect(due.cadenceMode).toBe("cool_weekly");
    expect(due.shouldRun).toBe(true);
  });

  it("switches to hot_2d immediately when an upcoming league override or new patch is detected", () => {
    const now = Date.parse("2026-12-20T06:00:00Z");
    const withOverride = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: "NextLeague",
        nextLeagueOverrideStartAt: "2026-12-25T19:00:00Z",
        lastSyncedAt: now - 3 * DAY_MS,
      },
      now,
      null,
    );
    expect(withOverride.cadenceMode).toBe("hot_2d");
    expect(withOverride.effectiveLeagueName).toBe("NextLeague");
    expect(withOverride.shouldRun).toBe(true);

    const patchSurge = evaluateSyncSchedule(
      {
        activeLeagueName: "Covens",
        activeLeagueStartAt: "2026-11-13T19:00:00Z",
        nextLeagueOverrideName: null,
        nextLeagueOverrideStartAt: null,
        lastSyncedAt: now - 1000,
      },
      now,
      null,
      true,
    );
    expect(patchSurge.cadenceMode).toBe("hot_2d");
    expect(patchSurge.shouldRun).toBe(true);
  });
});
