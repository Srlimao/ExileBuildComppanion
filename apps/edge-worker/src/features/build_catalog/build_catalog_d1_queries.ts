import type {
  BuildCatalogEntry,
  BuildCatalogFacetsResponse,
  BuildCatalogQueryResponse,
} from "@exile-hud/core";
import { getClassCatalogForGame } from "@exile-hud/core";
import { getSyncState } from "./build_catalog_d1_repository.js";
import {
  ensureCatalogSchema,
  mapRawCatalogRow,
  type CatalogQueryParams,
  type RawCatalogRow,
} from "./build_catalog_d1_schema.js";

function matchesTagFilters(entry: BuildCatalogEntry, params: CatalogQueryParams): boolean {
  if (
    params.playstyleTags.length > 0 &&
    !params.playstyleTags.some((t) => entry.playstyleTags.includes(t))
  ) {
    return false;
  }
  if (params.goalTags.length > 0 && !params.goalTags.every((t) => entry.goalTags.includes(t))) {
    return false;
  }
  if (
    params.damageTags.length > 0 &&
    !params.damageTags.some((t) => entry.damageTags.includes(t))
  ) {
    return false;
  }
  return true;
}

export async function queryCatalog(
  db: D1Database,
  params: CatalogQueryParams,
): Promise<BuildCatalogQueryResponse> {
  await ensureCatalogSchema(db);
  const syncState = await getSyncState(db);
  const latestPatch =
    params.gameId === "poe2" ? syncState.latestDetectedPatchPoe2 : syncState.latestDetectedPatchPoe1;

  const where: string[] = ["game_id = ?", "is_active = 1"];
  const binds: unknown[] = [params.gameId];

  if (params.baseClass) {
    where.push("LOWER(base_class) = LOWER(?)");
    binds.push(params.baseClass);
  }
  if (params.ascendancy) {
    where.push("LOWER(ascendancy) = LOWER(?)");
    binds.push(params.ascendancy);
  }
  if (params.source) {
    where.push("source = ?");
    binds.push(params.source);
  }
  if (params.pobOnly) {
    where.push("has_pob_import = 1");
  }
  if (params.search?.trim()) {
    const q = `%${params.search.trim()}%`;
    where.push("(title LIKE ? OR author LIKE ? OR ascendancy LIKE ? OR main_skill LIKE ? OR excerpt LIKE ?)");
    binds.push(q, q, q, q, q);
  }

  const res = await db
    .prepare(`SELECT * FROM exile_build_catalog WHERE ${where.join(" AND ")}`)
    .bind(...binds)
    .all<RawCatalogRow>();

  const filtered = (res.results ?? [])
    .map(mapRawCatalogRow)
    .filter((entry) => matchesTagFilters(entry, params));

  filtered.sort((a, b) => {
    if (params.sort === "updated") {
      return (b.sourceUpdatedAt ?? b.scrapedAt) - (a.sourceUpdatedAt ?? a.scrapedAt);
    }
    if (params.sort === "popular") {
      return b.popularityScore - a.popularityScore;
    }
    if (a.hasPobImport !== b.hasPobImport) return a.hasPobImport ? -1 : 1;
    const aLatest = latestPatch && a.patchVersion === latestPatch ? 1 : 0;
    const bLatest = latestPatch && b.patchVersion === latestPatch ? 1 : 0;
    if (aLatest !== bLatest) return bLatest - aLatest;
    const scoreDiff = (b.popularityScore > 0 ? 1 : 0) - (a.popularityScore > 0 ? 1 : 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.sourceUpdatedAt ?? b.scrapedAt) - (a.sourceUpdatedAt ?? a.scrapedAt);
  });

  return {
    items: filtered.slice(params.offset, params.offset + params.limit),
    total: filtered.length,
    limit: params.limit,
    offset: params.offset,
    latestPatch,
    activeLeague: syncState.activeLeagueName,
    lastSyncedAt: syncState.lastSyncedAt,
    cadenceMode: syncState.cadenceMode,
  };
}

export async function queryCatalogFacets(
  db: D1Database,
  gameId: "poe1" | "poe2",
  pobOnly: boolean,
): Promise<BuildCatalogFacetsResponse> {
  await ensureCatalogSchema(db);
  const syncState = await getSyncState(db);
  const res = await db
    .prepare("SELECT * FROM exile_build_catalog WHERE game_id = ? AND is_active = 1")
    .bind(gameId)
    .all<RawCatalogRow>();
  const allEntries = (res.results ?? []).map(mapRawCatalogRow);
  const entries = pobOnly ? allEntries.filter((e) => e.hasPobImport) : allEntries;

  const classMap = new Map<string, { count: number; asc: Map<string, number> }>();
  for (const def of getClassCatalogForGame(gameId)) {
    const asc = new Map<string, number>();
    for (const a of def.ascendancies) asc.set(a, 0);
    classMap.set(def.baseClass, { count: 0, asc });
  }

  const playstyleTags: Record<string, number> = {};
  const goalTags: Record<string, number> = {};
  const sources: Record<string, number> = {};

  for (const entry of entries) {
    const bucket = classMap.get(entry.baseClass) ?? { count: 0, asc: new Map<string, number>() };
    bucket.count += 1;
    if (entry.ascendancy) {
      bucket.asc.set(entry.ascendancy, (bucket.asc.get(entry.ascendancy) ?? 0) + 1);
    }
    classMap.set(entry.baseClass, bucket);
    sources[entry.source] = (sources[entry.source] ?? 0) + 1;
    for (const t of entry.playstyleTags) playstyleTags[t] = (playstyleTags[t] ?? 0) + 1;
    for (const t of entry.goalTags) goalTags[t] = (goalTags[t] ?? 0) + 1;
  }

  return {
    gameId,
    totalBuilds: allEntries.length,
    pobReadyBuilds: allEntries.filter((e) => e.hasPobImport).length,
    latestPatch:
      gameId === "poe2" ? syncState.latestDetectedPatchPoe2 : syncState.latestDetectedPatchPoe1,
    activeLeague: syncState.activeLeagueName,
    lastSyncedAt: syncState.lastSyncedAt,
    classes: [...classMap.entries()].map(([baseClass, val]) => ({
      baseClass,
      count: val.count,
      ascendancies: [...val.asc.entries()].map(([name, count]) => ({ name, count })),
    })),
    playstyleTags,
    goalTags,
    sources,
  };
}

export async function countBuildsByGame(db: D1Database): Promise<{ poe1: number; poe2: number }> {
  await ensureCatalogSchema(db);
  const res = await db
    .prepare("SELECT game_id, COUNT(*) as cnt FROM exile_build_catalog WHERE is_active = 1 GROUP BY game_id")
    .all<{ game_id: string; cnt: number }>();
  let poe1 = 0;
  let poe2 = 0;
  for (const r of res.results ?? []) {
    if (r.game_id === "poe1") poe1 = Number(r.cnt ?? 0);
    if (r.game_id === "poe2") poe2 = Number(r.cnt ?? 0);
  }
  return { poe1, poe2 };
}
