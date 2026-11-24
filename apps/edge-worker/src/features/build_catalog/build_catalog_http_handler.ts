import {
  BuildCatalogSourceSchema,
  BuildDamageTagSchema,
  BuildGoalTagSchema,
  BuildPlaystyleTagSchema,
  extractMaxrollPobId,
  extractPobbinId,
  fetchMaxrollPobCode,
  type BuildCatalogSource,
  type BuildDamageTag,
  type BuildGoalTag,
  type BuildPlaystyleTag,
  type CatalogSyncStatus,
} from "@exile-hud/core";
import {
  countBuildsByGame,
  getSyncState,
  queryCatalog,
  queryCatalogFacets,
  saveSyncState,
} from "./build_catalog_d1_repository.js";
import {
  runCatalogSync,
  type CatalogSyncSourceFilter,
} from "./build_catalog_sync_orchestrator.js";
import { SCRAPER_USER_AGENT } from "./league_window_schedule_evaluator.js";

export interface BuildCatalogEnv {
  BUILD_CATALOG_DB?: D1Database;
  CATALOG_ADMIN_KEY?: string;
}

function parseCsvEnum<T extends string>(
  raw: string | null,
  validator: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
): T[] {
  if (!raw) return [];
  const out: T[] = [];
  for (const part of raw.split(",")) {
    const res = validator.safeParse(part.trim());
    if (res.success && !out.includes(res.data)) out.push(res.data);
  }
  return out;
}

function authorizeAdminRequest(request: Request, env: BuildCatalogEnv): Response | null {
  const configured = env.CATALOG_ADMIN_KEY?.trim();
  if (!configured) {
    return Response.json(
      { error: "CATALOG_ADMIN_KEY is not configured on this worker." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== configured) {
    return Response.json({ error: "Unauthorized admin request." }, { status: 401 });
  }
  return null;
}

async function handleResolvePob(url: URL, fetcher: typeof fetch): Promise<Response> {
  const target = url.searchParams.get("url")?.trim() ?? "";
  if (!target) {
    return Response.json({ error: "Missing required ?url= parameter." }, { status: 400 });
  }

  const maxrollId = extractMaxrollPobId(target);
  if (maxrollId) {
    try {
      const pobCode = await fetchMaxrollPobCode(maxrollId, fetcher);
      return Response.json(
        { pobCode, sourceKind: "maxroll_pob" },
        { headers: { "Cache-Control": "public, max-age=1800" } },
      );
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to load Maxroll PoB." },
        { status: 502 },
      );
    }
  }

  const pobbinId = extractPobbinId(target);
  if (pobbinId) {
    try {
      const res = await fetcher(`https://pobb.in/${encodeURIComponent(pobbinId)}/raw`, {
        headers: { "User-Agent": SCRAPER_USER_AGENT },
      });
      if (!res.ok) {
        return Response.json({ error: `pobb.in returned HTTP ${res.status}` }, { status: 502 });
      }
      const pobCode = (await res.text()).trim();
      return Response.json(
        { pobCode, sourceKind: "pobbin" },
        { headers: { "Cache-Control": "public, max-age=1800" } },
      );
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to load pobb.in." },
        { status: 502 },
      );
    }
  }

  return Response.json(
    { error: "Only allowlisted maxroll.gg/poe/pob/* and pobb.in/* URLs are supported." },
    { status: 400 },
  );
}

/** Handles all `/api/builds/*` catalog query, facet, PoB resolution, and admin sync routes. */
export async function handleBuildCatalogRequest(
  request: Request,
  env: BuildCatalogEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/builds/resolve-pob" && request.method === "GET") {
    return handleResolvePob(url, fetcher);
  }

  const db = env.BUILD_CATALOG_DB;
  if (!db) {
    return Response.json(
      { error: "Build catalog D1 binding (BUILD_CATALOG_DB) is not configured." },
      { status: 503 },
    );
  }

  if (path === "/api/builds/catalog" && request.method === "GET") {
    const gameId = url.searchParams.get("gameId") === "poe2" ? "poe2" : "poe1";
    const sourceParsed = BuildCatalogSourceSchema.safeParse(url.searchParams.get("source"));
    const sortParam = url.searchParams.get("sort");
    const sort = sortParam === "updated" || sortParam === "popular" ? sortParam : "recommended";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 48) || 48));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

    const payload = await queryCatalog(db, {
      gameId,
      baseClass: url.searchParams.get("baseClass")?.trim() || undefined,
      ascendancy: url.searchParams.get("ascendancy")?.trim() || undefined,
      playstyleTags: parseCsvEnum<BuildPlaystyleTag>(
        url.searchParams.get("playstyle"),
        BuildPlaystyleTagSchema,
      ),
      goalTags: parseCsvEnum<BuildGoalTag>(url.searchParams.get("goal"), BuildGoalTagSchema),
      damageTags: parseCsvEnum<BuildDamageTag>(
        url.searchParams.get("damage"),
        BuildDamageTagSchema,
      ),
      source: sourceParsed.success ? (sourceParsed.data as BuildCatalogSource) : undefined,
      pobOnly: url.searchParams.get("pobOnly") === "true" || url.searchParams.get("pobOnly") === "1",
      search: url.searchParams.get("search") ?? undefined,
      sort,
      limit,
      offset,
    });

    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  if (path === "/api/builds/facets" && request.method === "GET") {
    const gameId = url.searchParams.get("gameId") === "poe2" ? "poe2" : "poe1";
    const pobOnly =
      url.searchParams.get("pobOnly") === "true" || url.searchParams.get("pobOnly") === "1";
    const facets = await queryCatalogFacets(db, gameId, pobOnly);
    return Response.json(facets, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  if (path === "/api/builds/status" && request.method === "GET") {
    const [state, counts] = await Promise.all([getSyncState(db), countBuildsByGame(db)]);
    const status: CatalogSyncStatus = {
      activeLeagueName: state.activeLeagueName,
      activeLeagueStartAt: state.activeLeagueStartAt,
      nextLeagueOverrideName: state.nextLeagueOverrideName,
      nextLeagueOverrideStartAt: state.nextLeagueOverrideStartAt,
      latestDetectedPatchPoe1: state.latestDetectedPatchPoe1,
      latestDetectedPatchPoe2: state.latestDetectedPatchPoe2,
      cadenceMode: state.cadenceMode,
      lastSyncedAt: state.lastSyncedAt,
      lastSyncStatus: state.lastSyncStatus,
      totalBuildsPoe1: counts.poe1,
      totalBuildsPoe2: counts.poe2,
    };
    return Response.json(status, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  if (path === "/api/builds/sync" && request.method === "POST") {
    const denied = authorizeAdminRequest(request, env);
    if (denied) return denied;
    const rawSource = url.searchParams.get("source");
    const sourceFilter: CatalogSyncSourceFilter =
      rawSource === "maxroll" || rawSource === "poebuilds" || rawSource === "poeforum"
        ? rawSource
        : "all";
    const force = url.searchParams.get("force") !== "0";
    const result = await runCatalogSync(env, { force, sourceFilter, fetcher });
    return Response.json(result);
  }

  if (path === "/api/builds/league-window" && request.method === "PUT") {
    const denied = authorizeAdminRequest(request, env);
    if (denied) return denied;
    let body: { nextLeagueOverrideName?: string | null; nextLeagueOverrideStartAt?: string | null };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const state = await getSyncState(db);
    await saveSyncState(db, {
      ...state,
      nextLeagueOverrideName: body.nextLeagueOverrideName ?? null,
      nextLeagueOverrideStartAt: body.nextLeagueOverrideStartAt ?? null,
      updatedAt: Date.now(),
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown build catalog route." }, { status: 404 });
}
