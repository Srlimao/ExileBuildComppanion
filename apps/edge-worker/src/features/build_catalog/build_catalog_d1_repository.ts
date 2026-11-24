import type { BuildCatalogSource } from "@exile-hud/core";
import {
  countBuildsByGame,
  queryCatalog,
  queryCatalogFacets,
} from "./build_catalog_d1_queries.js";
import {
  ensureCatalogSchema,
  type CatalogDetailCacheItem,
  type CatalogEntryUpsertRow,
  type CatalogQueryParams,
  type CatalogSyncStateRecord,
} from "./build_catalog_d1_schema.js";

export type {
  CatalogDetailCacheItem,
  CatalogEntryUpsertRow,
  CatalogQueryParams,
  CatalogSyncStateRecord,
};
export { countBuildsByGame, queryCatalog, queryCatalogFacets };

export async function getSyncState(db: D1Database): Promise<CatalogSyncStateRecord> {
  await ensureCatalogSchema(db);
  const row = await db
    .prepare("SELECT * FROM exile_catalog_sync_state WHERE id = 1")
    .first<Record<string, unknown>>();
  if (!row) {
    return {
      activeLeagueName: "",
      activeLeagueStartAt: null,
      nextLeagueOverrideName: null,
      nextLeagueOverrideStartAt: null,
      latestDetectedPatchPoe1: "",
      latestDetectedPatchPoe2: "",
      cadenceMode: "cool_weekly",
      lastSyncedAt: null,
      lastSyncStatus: "idle",
      lastSyncSummaryJson: "{}",
      updatedAt: 0,
    };
  }
  return {
    activeLeagueName: String(row.active_league_name ?? ""),
    activeLeagueStartAt: (row.active_league_start_at as string | null) ?? null,
    nextLeagueOverrideName: (row.next_league_override_name as string | null) ?? null,
    nextLeagueOverrideStartAt: (row.next_league_override_start_at as string | null) ?? null,
    latestDetectedPatchPoe1: String(row.latest_detected_patch_poe1 ?? ""),
    latestDetectedPatchPoe2: String(row.latest_detected_patch_poe2 ?? ""),
    cadenceMode: row.cadence_mode === "hot_2d" ? "hot_2d" : "cool_weekly",
    lastSyncedAt: typeof row.last_synced_at === "number" ? row.last_synced_at : null,
    lastSyncStatus: String(row.last_sync_status ?? "idle"),
    lastSyncSummaryJson: String(row.last_sync_summary_json ?? "{}"),
    updatedAt: typeof row.updated_at === "number" ? row.updated_at : 0,
  };
}

export async function saveSyncState(db: D1Database, next: CatalogSyncStateRecord): Promise<void> {
  await ensureCatalogSchema(db);
  await db
    .prepare(
      `INSERT INTO exile_catalog_sync_state (
        id, active_league_name, active_league_start_at, next_league_override_name,
        next_league_override_start_at, latest_detected_patch_poe1, latest_detected_patch_poe2,
        cadence_mode, last_synced_at, last_sync_status, last_sync_summary_json, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        active_league_name = excluded.active_league_name,
        active_league_start_at = excluded.active_league_start_at,
        next_league_override_name = excluded.next_league_override_name,
        next_league_override_start_at = excluded.next_league_override_start_at,
        latest_detected_patch_poe1 = excluded.latest_detected_patch_poe1,
        latest_detected_patch_poe2 = excluded.latest_detected_patch_poe2,
        cadence_mode = excluded.cadence_mode,
        last_synced_at = excluded.last_synced_at,
        last_sync_status = excluded.last_sync_status,
        last_sync_summary_json = excluded.last_sync_summary_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      next.activeLeagueName,
      next.activeLeagueStartAt,
      next.nextLeagueOverrideName,
      next.nextLeagueOverrideStartAt,
      next.latestDetectedPatchPoe1,
      next.latestDetectedPatchPoe2,
      next.cadenceMode,
      next.lastSyncedAt,
      next.lastSyncStatus,
      next.lastSyncSummaryJson,
      next.updatedAt,
    )
    .run();
}

export async function getDetailCacheMap(
  db: D1Database,
  source: BuildCatalogSource,
  gameId: "poe1" | "poe2",
): Promise<Map<string, CatalogDetailCacheItem>> {
  await ensureCatalogSchema(db);
  const res = await db
    .prepare(
      `SELECT source_key, pob_url, source_updated_at, detail_checked_at
       FROM exile_build_catalog WHERE source = ? AND game_id = ?`,
    )
    .bind(source, gameId)
    .all<{
      source_key: string;
      pob_url: string | null;
      source_updated_at: number | null;
      detail_checked_at: number | null;
    }>();
  const map = new Map<string, CatalogDetailCacheItem>();
  for (const row of res.results ?? []) {
    map.set(row.source_key, {
      pobUrl: row.pob_url,
      sourceUpdatedAt: row.source_updated_at,
      detailCheckedAt: row.detail_checked_at,
    });
  }
  return map;
}

export async function upsertCatalogEntries(
  db: D1Database,
  entries: readonly CatalogEntryUpsertRow[],
): Promise<number> {
  if (entries.length === 0) return 0;
  await ensureCatalogSchema(db);
  const stmt = db.prepare(
    `INSERT INTO exile_build_catalog (
      id, game_id, source, source_key, title, author, base_class, ascendancy, main_skill,
      patch_version, league_name, playstyle_tags_json, goal_tags_json, damage_tags_json,
      excerpt, guide_url, video_url, pob_url, pob_kind, has_pob_import, popularity_score,
      source_published_at, source_updated_at, detail_checked_at, scraped_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(source, game_id, source_key) DO UPDATE SET
      title = excluded.title,
      author = excluded.author,
      base_class = excluded.base_class,
      ascendancy = excluded.ascendancy,
      main_skill = excluded.main_skill,
      patch_version = excluded.patch_version,
      league_name = excluded.league_name,
      playstyle_tags_json = excluded.playstyle_tags_json,
      goal_tags_json = excluded.goal_tags_json,
      damage_tags_json = excluded.damage_tags_json,
      excerpt = excluded.excerpt,
      guide_url = excluded.guide_url,
      video_url = COALESCE(excluded.video_url, exile_build_catalog.video_url),
      pob_url = COALESCE(excluded.pob_url, exile_build_catalog.pob_url),
      pob_kind = CASE WHEN excluded.pob_url IS NOT NULL THEN excluded.pob_kind ELSE exile_build_catalog.pob_kind END,
      has_pob_import = CASE WHEN excluded.pob_url IS NOT NULL THEN 1 ELSE exile_build_catalog.has_pob_import END,
      popularity_score = MAX(excluded.popularity_score, exile_build_catalog.popularity_score),
      source_published_at = COALESCE(excluded.source_published_at, exile_build_catalog.source_published_at),
      source_updated_at = COALESCE(excluded.source_updated_at, exile_build_catalog.source_updated_at),
      detail_checked_at = COALESCE(excluded.detail_checked_at, exile_build_catalog.detail_checked_at),
      scraped_at = excluded.scraped_at,
      is_active = 1`,
  );

  for (let i = 0; i < entries.length; i += 40) {
    const chunk = entries.slice(i, i + 40);
    await db.batch(
      chunk.map((e) =>
        stmt.bind(
          e.id, e.gameId, e.source, e.sourceKey, e.title, e.author, e.baseClass, e.ascendancy,
          e.mainSkill, e.patchVersion, e.leagueName,
          JSON.stringify(e.playstyleTags), JSON.stringify(e.goalTags), JSON.stringify(e.damageTags),
          e.excerpt, e.guideUrl, e.videoUrl, e.pobUrl, e.pobKind, e.hasPobImport ? 1 : 0,
          e.popularityScore, e.sourcePublishedAt, e.sourceUpdatedAt, e.detailCheckedAt, e.scrapedAt,
        ),
      ),
    );
  }
  return entries.length;
}
