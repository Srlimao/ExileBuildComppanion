import type { CatalogCadenceMode } from "@exile-hud/core";

export const HOT_INTERVAL_MS = 48 * 60 * 60 * 1000;
export const COOL_INTERVAL_MS = 168 * 60 * 60 * 1000;
export const PRE_LEAGUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const POST_LEAGUE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const SCRAPER_USER_AGENT = "ExileCompanionHUD/0.1 (https://exile.dunhas.com)";

export interface DetectedLeagueInfo {
  leagueName: string;
  startAtIso: string | null;
}

export interface ScheduleEvalState {
  activeLeagueName: string;
  activeLeagueStartAt: string | null;
  nextLeagueOverrideName: string | null;
  nextLeagueOverrideStartAt: string | null;
  lastSyncedAt: number | null;
}

export interface SyncScheduleDecision {
  shouldRun: boolean;
  cadenceMode: CatalogCadenceMode;
  reason: string;
  nextDueAtMs: number;
  effectiveLeagueName: string;
  effectiveLeagueStartAt: string | null;
}

interface GggLeagueRecord {
  id?: string;
  realm?: string;
  startAt?: string | null;
  endAt?: string | null;
}

const PERMANENT_OR_VARIANT_REGEX =
  /^(standard|hardcore|solo self-found|hardcore ssf|ruthless|hardcore ruthless|ssf |hc )/i;

/** Queries GGG's public leagues list to locate the latest PC challenge league and its startAt date. */
export async function fetchActivePoeLeague(
  fetcher: typeof fetch = fetch,
): Promise<DetectedLeagueInfo | null> {
  try {
    const res = await fetcher("https://api.pathofexile.com/leagues?type=main&compact=1", {
      headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as GggLeagueRecord[];
    if (!Array.isArray(rows)) return null;

    const challengeLeagues = rows
      .filter(
        (r) =>
          r.id &&
          (!r.realm || r.realm === "pc") &&
          !PERMANENT_OR_VARIANT_REGEX.test(r.id.trim()) &&
          Boolean(r.startAt),
      )
      .sort((a, b) => Date.parse(b.startAt ?? "") - Date.parse(a.startAt ?? ""));

    const latest = challengeLeagues[0];
    if (!latest?.id) return null;
    return {
      leagueName: latest.id.trim(),
      startAtIso: latest.startAt ?? null,
    };
  } catch {
    return null;
  }
}

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evaluates whether the scheduled daily cron should run a full catalog scrape:
 * - Hot window (every 48h): 7 days before league start through 30 days after, OR when a new patch drops.
 * - Cool-off window (every 7 days): outside the active launch window.
 */
export function evaluateSyncSchedule(
  state: ScheduleEvalState,
  nowMs: number,
  detectedLeague: DetectedLeagueInfo | null,
  newlyDetectedPatch = false,
): SyncScheduleDecision {
  const overrideMs = parseIsoMs(state.nextLeagueOverrideStartAt);
  const overrideStillRelevant =
    overrideMs !== null && nowMs <= overrideMs + POST_LEAGUE_WINDOW_MS;

  const effectiveLeagueName = overrideStillRelevant
    ? state.nextLeagueOverrideName?.trim() || detectedLeague?.leagueName || state.activeLeagueName
    : detectedLeague?.leagueName || state.activeLeagueName;
  const effectiveLeagueStartAt = overrideStillRelevant
    ? state.nextLeagueOverrideStartAt
    : detectedLeague?.startAtIso || state.activeLeagueStartAt;

  const refStartMs = parseIsoMs(effectiveLeagueStartAt);
  const inHotLeagueWindow =
    refStartMs !== null &&
    nowMs >= refStartMs - PRE_LEAGUE_WINDOW_MS &&
    nowMs <= refStartMs + POST_LEAGUE_WINDOW_MS;

  const cadenceMode: CatalogCadenceMode =
    inHotLeagueWindow || newlyDetectedPatch ? "hot_2d" : "cool_weekly";
  const intervalMs = cadenceMode === "hot_2d" ? HOT_INTERVAL_MS : COOL_INTERVAL_MS;

  if (!state.lastSyncedAt) {
    return {
      shouldRun: true,
      cadenceMode,
      reason: "initial_sync",
      nextDueAtMs: nowMs,
      effectiveLeagueName,
      effectiveLeagueStartAt,
    };
  }

  const elapsed = nowMs - state.lastSyncedAt;
  const nextDueAtMs = state.lastSyncedAt + intervalMs;
  const shouldRun = elapsed >= intervalMs || newlyDetectedPatch;
  const reason = newlyDetectedPatch
    ? "new_patch_detected"
    : inHotLeagueWindow
      ? "league_hot_window"
      : "weekly_cooloff";

  return {
    shouldRun,
    cadenceMode,
    reason,
    nextDueAtMs,
    effectiveLeagueName,
    effectiveLeagueStartAt,
  };
}
