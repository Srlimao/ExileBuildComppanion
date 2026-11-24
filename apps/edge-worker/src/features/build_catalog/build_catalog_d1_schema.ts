import type {
  BuildCatalogEntry,
  BuildCatalogSource,
  BuildDamageTag,
  BuildGoalTag,
  BuildPlaystyleTag,
  CatalogCadenceMode,
} from "@exile-hud/core";

export interface CatalogEntryUpsertRow extends BuildCatalogEntry {
  detailCheckedAt: number | null;
}

export interface CatalogDetailCacheItem {
  pobUrl: string | null;
  sourceUpdatedAt: number | null;
  detailCheckedAt: number | null;
}

export interface CatalogSyncStateRecord {
  activeLeagueName: string;
  activeLeagueStartAt: string | null;
  nextLeagueOverrideName: string | null;
  nextLeagueOverrideStartAt: string | null;
  latestDetectedPatchPoe1: string;
  latestDetectedPatchPoe2: string;
  cadenceMode: CatalogCadenceMode;
  lastSyncedAt: number | null;
  lastSyncStatus: string;
  lastSyncSummaryJson: string;
  updatedAt: number;
}

export interface CatalogQueryParams {
  gameId: "poe1" | "poe2";
  baseClass?: string;
  ascendancy?: string;
  playstyleTags: BuildPlaystyleTag[];
  goalTags: BuildGoalTag[];
  damageTags: BuildDamageTag[];
  source?: BuildCatalogSource;
  pobOnly: boolean;
  search?: string;
  sort: "recommended" | "updated" | "popular";
  limit: number;
  offset: number;
}

export interface RawCatalogRow {
  id: string;
  game_id: "poe1" | "poe2";
  source: BuildCatalogSource;
  source_key: string;
  title: string;
  author: string;
  base_class: string;
  ascendancy: string;
  main_skill: string;
  patch_version: string;
  league_name: string;
  playstyle_tags_json: string;
  goal_tags_json: string;
  damage_tags_json: string;
  excerpt: string;
  guide_url: string;
  video_url: string | null;
  pob_url: string | null;
  pob_kind: "pobbin" | "maxroll_pob" | "none";
  has_pob_import: number;
  popularity_score: number;
  source_published_at: number | null;
  source_updated_at: number | null;
  detail_checked_at: number | null;
  scraped_at: number;
}

const initializedDbs = new WeakSet<D1Database>();

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS exile_build_catalog (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_key TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    base_class TEXT NOT NULL DEFAULT 'Unknown',
    ascendancy TEXT NOT NULL DEFAULT '',
    main_skill TEXT NOT NULL DEFAULT '',
    patch_version TEXT NOT NULL DEFAULT '',
    league_name TEXT NOT NULL DEFAULT '',
    playstyle_tags_json TEXT NOT NULL DEFAULT '[]',
    goal_tags_json TEXT NOT NULL DEFAULT '[]',
    damage_tags_json TEXT NOT NULL DEFAULT '[]',
    excerpt TEXT NOT NULL DEFAULT '',
    guide_url TEXT NOT NULL,
    video_url TEXT,
    pob_url TEXT,
    pob_kind TEXT NOT NULL DEFAULT 'none',
    has_pob_import INTEGER NOT NULL DEFAULT 0,
    popularity_score INTEGER NOT NULL DEFAULT 0,
    source_published_at INTEGER,
    source_updated_at INTEGER,
    detail_checked_at INTEGER,
    scraped_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(source, game_id, source_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_exile_catalog_game_class
    ON exile_build_catalog (game_id, is_active, has_pob_import DESC, base_class, popularity_score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_exile_catalog_source_updated
    ON exile_build_catalog (source, game_id, source_updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS exile_catalog_sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_league_name TEXT NOT NULL DEFAULT '',
    active_league_start_at TEXT,
    next_league_override_name TEXT,
    next_league_override_start_at TEXT,
    latest_detected_patch_poe1 TEXT NOT NULL DEFAULT '',
    latest_detected_patch_poe2 TEXT NOT NULL DEFAULT '',
    cadence_mode TEXT NOT NULL DEFAULT 'cool_weekly',
    last_synced_at INTEGER,
    last_sync_status TEXT NOT NULL DEFAULT 'idle',
    last_sync_summary_json TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  )`,
];

function parseJsonStringArray<T extends string>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as T[]) : [];
  } catch {
    return [];
  }
}

export function mapRawCatalogRow(row: RawCatalogRow): BuildCatalogEntry {
  return {
    id: row.id,
    gameId: row.game_id,
    source: row.source,
    sourceKey: row.source_key,
    title: row.title,
    author: row.author,
    baseClass: row.base_class,
    ascendancy: row.ascendancy,
    mainSkill: row.main_skill,
    patchVersion: row.patch_version,
    leagueName: row.league_name,
    playstyleTags: parseJsonStringArray<BuildPlaystyleTag>(row.playstyle_tags_json),
    goalTags: parseJsonStringArray<BuildGoalTag>(row.goal_tags_json),
    damageTags: parseJsonStringArray<BuildDamageTag>(row.damage_tags_json),
    excerpt: row.excerpt,
    guideUrl: row.guide_url,
    videoUrl: row.video_url,
    pobUrl: row.pob_url,
    pobKind: row.pob_kind,
    hasPobImport: row.has_pob_import === 1,
    popularityScore: row.popularity_score,
    sourcePublishedAt: row.source_published_at,
    sourceUpdatedAt: row.source_updated_at,
    scrapedAt: row.scraped_at,
  };
}

export async function ensureCatalogSchema(db: D1Database): Promise<void> {
  if (initializedDbs.has(db)) return;
  await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)));
  initializedDbs.add(db);
}
