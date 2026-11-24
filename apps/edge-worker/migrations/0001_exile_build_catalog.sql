-- Build Catalog & League-Aware Sync State tables in general-db (e5a10825-7799-438a-926d-1b296afcccdd)

CREATE TABLE IF NOT EXISTS exile_build_catalog (
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
);

CREATE INDEX IF NOT EXISTS idx_exile_catalog_game_class
  ON exile_build_catalog (game_id, is_active, has_pob_import DESC, base_class, popularity_score DESC);

CREATE INDEX IF NOT EXISTS idx_exile_catalog_source_updated
  ON exile_build_catalog (source, game_id, source_updated_at DESC);

CREATE TABLE IF NOT EXISTS exile_catalog_sync_state (
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
);
