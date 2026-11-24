import type { CatalogCadenceMode } from "@exile-hud/core";
import {
  getDetailCacheMap,
  getSyncState,
  saveSyncState,
  upsertCatalogEntries,
} from "./build_catalog_d1_repository.js";
import type { CatalogEntryUpsertRow } from "./build_catalog_d1_schema.js";
import {
  evaluateSyncSchedule,
  fetchActivePoeLeague,
} from "./league_window_schedule_evaluator.js";
import { scrapeMaxrollBuilds } from "./maxroll_build_scraper.js";
import { scrapePoeForumBuilds } from "./poe_forum_build_scraper.js";
import { scrapePoebuildsCc } from "./poebuilds_cc_scraper.js";

export type CatalogSyncSourceFilter = "all" | "maxroll" | "poebuilds" | "poeforum";

export interface CatalogSyncEnv {
  BUILD_CATALOG_DB?: D1Database;
}

export interface CatalogSyncRunResult {
  executed: boolean;
  reason: string;
  cadenceMode: CatalogCadenceMode;
  upsertedCount: number;
  bySource: Record<string, number>;
  errors: string[];
  latestPatchPoe1: string;
  latestPatchPoe2: string;
  activeLeague: string;
}

function comparePatchStrings(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function pickHighestPatch(entries: readonly CatalogEntryUpsertRow[], fallback: string): string {
  let best = fallback;
  for (const e of entries) {
    if (e.patchVersion && (!best || comparePatchStrings(e.patchVersion, best) > 0)) {
      best = e.patchVersion;
    }
  }
  return best;
}

/**
 * Runs a scheduled or manual build catalog sync against Cloudflare D1 (`general-db`).
 * Respects the 48h hot league window (`[startAt - 7d, startAt + 30d]`) vs 7d cool-off unless `force` is true.
 */
export async function runCatalogSync(
  env: CatalogSyncEnv,
  options: {
    force?: boolean;
    sourceFilter?: CatalogSyncSourceFilter;
    fetcher?: typeof fetch;
    nowMs?: number;
  } = {},
): Promise<CatalogSyncRunResult> {
  const db = env.BUILD_CATALOG_DB;
  if (!db) {
    return {
      executed: false,
      reason: "missing_d1_binding",
      cadenceMode: "cool_weekly",
      upsertedCount: 0,
      bySource: {},
      errors: ["BUILD_CATALOG_DB binding is not configured."],
      latestPatchPoe1: "",
      latestPatchPoe2: "",
      activeLeague: "",
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const nowMs = options.nowMs ?? Date.now();
  const sourceFilter = options.sourceFilter ?? "all";
  const state = await getSyncState(db);
  const detectedLeague = await fetchActivePoeLeague(fetcher);
  const preCheck = evaluateSyncSchedule(state, nowMs, detectedLeague, false);

  if (!options.force && !preCheck.shouldRun) {
    return {
      executed: false,
      reason: `skipped_${preCheck.reason}`,
      cadenceMode: preCheck.cadenceMode,
      upsertedCount: 0,
      bySource: {},
      errors: [],
      latestPatchPoe1: state.latestDetectedPatchPoe1,
      latestPatchPoe2: state.latestDetectedPatchPoe2,
      activeLeague: preCheck.effectiveLeagueName,
    };
  }

  const collected: CatalogEntryUpsertRow[] = [];
  const bySource: Record<string, number> = {};
  const errors: string[] = [];

  if (sourceFilter === "all" || sourceFilter === "maxroll") {
    for (const gameId of ["poe1", "poe2"] as const) {
      try {
        const cache = await getDetailCacheMap(db, "maxroll", gameId);
        const rows = await scrapeMaxrollBuilds(
          gameId,
          cache,
          gameId === "poe1" ? 10 : 0,
          fetcher,
          nowMs,
        );
        collected.push(...rows);
        bySource[`maxroll_${gameId}`] = rows.length;
      } catch (err) {
        errors.push(`maxroll_${gameId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (sourceFilter === "all" || sourceFilter === "poebuilds") {
    for (const gameId of ["poe1", "poe2"] as const) {
      try {
        const rows = await scrapePoebuildsCc(gameId, fetcher, nowMs);
        collected.push(...rows);
        bySource[`poebuilds_${gameId}`] = rows.length;
      } catch (err) {
        errors.push(`poebuilds_${gameId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const poe1Entries = collected.filter((e) => e.gameId === "poe1");
  const poe2Entries = collected.filter((e) => e.gameId === "poe2");
  const latestPatchPoe1 = pickHighestPatch(poe1Entries, state.latestDetectedPatchPoe1);
  const latestPatchPoe2 = pickHighestPatch(poe2Entries, state.latestDetectedPatchPoe2);

  if (sourceFilter === "all" || sourceFilter === "poeforum") {
    try {
      const forumCache = await getDetailCacheMap(db, "poeforum", "poe1");
      const forumRows = await scrapePoeForumBuilds(
        latestPatchPoe1,
        forumCache,
        8,
        fetcher,
        nowMs,
      );
      collected.push(...forumRows);
      bySource.poeforum_poe1 = forumRows.length;
    } catch (err) {
      errors.push(`poeforum_poe1: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const newlyDetectedPatch =
    (Boolean(state.latestDetectedPatchPoe1) &&
      comparePatchStrings(latestPatchPoe1, state.latestDetectedPatchPoe1) > 0) ||
    (Boolean(state.latestDetectedPatchPoe2) &&
      comparePatchStrings(latestPatchPoe2, state.latestDetectedPatchPoe2) > 0);

  const postSchedule = evaluateSyncSchedule(state, nowMs, detectedLeague, newlyDetectedPatch);
  const upsertedCount = await upsertCatalogEntries(db, collected);

  const statusLabel =
    errors.length === 0 ? "ok" : upsertedCount > 0 ? "partial" : "error";

  await saveSyncState(db, {
    ...state,
    activeLeagueName: postSchedule.effectiveLeagueName,
    activeLeagueStartAt: postSchedule.effectiveLeagueStartAt,
    latestDetectedPatchPoe1: latestPatchPoe1,
    latestDetectedPatchPoe2: latestPatchPoe2,
    cadenceMode: postSchedule.cadenceMode,
    lastSyncedAt: nowMs,
    lastSyncStatus: statusLabel,
    lastSyncSummaryJson: JSON.stringify({ upsertedCount, bySource, errors }),
    updatedAt: nowMs,
  });

  return {
    executed: true,
    reason: options.force ? "forced_sync" : preCheck.reason,
    cadenceMode: postSchedule.cadenceMode,
    upsertedCount,
    bySource,
    errors,
    latestPatchPoe1,
    latestPatchPoe2,
    activeLeague: postSchedule.effectiveLeagueName,
  };
}
