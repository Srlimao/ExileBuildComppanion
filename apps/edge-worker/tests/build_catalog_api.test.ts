import { describe, expect, it } from "vitest";
import { upsertCatalogEntries } from "../src/features/build_catalog/build_catalog_d1_repository.js";
import { handleBuildCatalogRequest } from "../src/features/build_catalog/build_catalog_http_handler.js";

function createMockD1() {
  const catalog = new Map<string, Record<string, unknown>>();
  let syncState: Record<string, unknown> | null = null;

  const prepare = (sql: string) => {
    const makeStmt = (args: unknown[]) => ({
      bind(...b: unknown[]) {
        return makeStmt(b);
      },
      async first<T>() {
        if (sql.includes("FROM exile_catalog_sync_state")) return syncState as T;
        return null;
      },
      async all<T>() {
        if (sql.includes("FROM exile_build_catalog") && sql.includes("GROUP BY game_id")) {
          const counts = new Map<string, number>();
          for (const row of catalog.values()) {
            const g = String(row.game_id);
            counts.set(g, (counts.get(g) ?? 0) + 1);
          }
          return {
            results: [...counts.entries()].map(([game_id, cnt]) => ({ game_id, cnt })) as T[],
          };
        }
        if (sql.includes("FROM exile_build_catalog")) {
          const gameId = args[0];
          const pobOnly = sql.includes("has_pob_import = 1");
          const results = [...catalog.values()].filter(
            (r) => r.game_id === gameId && (!pobOnly || r.has_pob_import === 1),
          );
          return { results: results as T[] };
        }
        return { results: [] as T[] };
      },
      async run() {
        if (sql.startsWith("INSERT INTO exile_catalog_sync_state")) {
          syncState = {
            id: 1,
            active_league_name: args[0],
            active_league_start_at: args[1],
            next_league_override_name: args[2],
            next_league_override_start_at: args[3],
            latest_detected_patch_poe1: args[4],
            latest_detected_patch_poe2: args[5],
            cadence_mode: args[6],
            last_synced_at: args[7],
            last_sync_status: args[8],
            last_sync_summary_json: args[9],
            updated_at: args[10],
          };
        } else if (sql.startsWith("INSERT INTO exile_build_catalog")) {
          const key = `${args[2]}:${args[1]}:${args[3]}`;
          catalog.set(key, {
            id: args[0],
            game_id: args[1],
            source: args[2],
            source_key: args[3],
            title: args[4],
            author: args[5],
            base_class: args[6],
            ascendancy: args[7],
            main_skill: args[8],
            patch_version: args[9],
            league_name: args[10],
            playstyle_tags_json: args[11],
            goal_tags_json: args[12],
            damage_tags_json: args[13],
            excerpt: args[14],
            guide_url: args[15],
            video_url: args[16],
            pob_url: args[17],
            pob_kind: args[18],
            has_pob_import: args[19],
            popularity_score: args[20],
            source_published_at: args[21],
            source_updated_at: args[22],
            detail_checked_at: args[23],
            scraped_at: args[24],
            is_active: 1,
          });
        }
        return { success: true };
      },
    });
    return makeStmt([]);
  };

  return {
    prepare,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      for (const s of stmts) await s.run();
      return [];
    },
  } as unknown as D1Database;
}

describe("build_catalog_http_handler", () => {
  it("serves filtered catalog & facets, blocks non-allowlisted resolve-pob, and guards admin endpoints", async () => {
    const db = createMockD1();
    await upsertCatalogEntries(db, [
      {
        id: "maxroll:poe1:1",
        gameId: "poe1",
        source: "maxroll",
        sourceKey: "1",
        title: "RF Chieftain",
        author: "Pohx",
        baseClass: "Marauder",
        ascendancy: "Chieftain",
        mainSkill: "Righteous Fire",
        patchVersion: "3.30",
        leagueName: "Covens",
        playstyleTags: ["dot_rf"],
        goalTags: ["league_starter", "mapper"],
        damageTags: ["fire"],
        excerpt: "Tanky RF starter",
        guideUrl: "https://maxroll.gg/poe/build-guides/rf-chieftain",
        videoUrl: null,
        pobUrl: "https://maxroll.gg/poe/pob/abc123",
        pobKind: "maxroll_pob",
        hasPobImport: true,
        popularityScore: 50000,
        sourcePublishedAt: 1000,
        sourceUpdatedAt: 2000,
        detailCheckedAt: 3000,
        scrapedAt: 3000,
      },
      {
        id: "poebuilds:poe1:2",
        gameId: "poe1",
        source: "poebuilds",
        sourceKey: "2",
        title: "Video Only Bow",
        author: "Creator",
        baseClass: "Ranger",
        ascendancy: "Deadeye",
        mainSkill: "",
        patchVersion: "3.30",
        leagueName: "3.30 Covens",
        playstyleTags: ["ranged"],
        goalTags: ["mapper"],
        damageTags: ["cold"],
        excerpt: "",
        guideUrl: "https://youtube.com/watch?v=123",
        videoUrl: "https://youtube.com/watch?v=123",
        pobUrl: null,
        pobKind: "none",
        hasPobImport: false,
        popularityScore: 10000,
        sourcePublishedAt: null,
        sourceUpdatedAt: 1500,
        detailCheckedAt: 3000,
        scrapedAt: 3000,
      },
    ]);

    const catRes = await handleBuildCatalogRequest(
      new Request("https://exile.dunhas.com/api/builds/catalog?gameId=poe1&pobOnly=true&goal=league_starter"),
      { BUILD_CATALOG_DB: db },
    );
    expect(catRes.status).toBe(200);
    const catJson = (await catRes.json()) as { total: number; items: Array<{ title: string }> };
    expect(catJson.total).toBe(1);
    expect(catJson.items[0]!.title).toBe("RF Chieftain");

    const facetRes = await handleBuildCatalogRequest(
      new Request("https://exile.dunhas.com/api/builds/facets?gameId=poe1"),
      { BUILD_CATALOG_DB: db },
    );
    const facetJson = (await facetRes.json()) as { totalBuilds: number; pobReadyBuilds: number };
    expect(facetJson.totalBuilds).toBe(2);
    expect(facetJson.pobReadyBuilds).toBe(1);

    const ssrfRes = await handleBuildCatalogRequest(
      new Request("https://exile.dunhas.com/api/builds/resolve-pob?url=http://169.254.169.254/latest"),
      { BUILD_CATALOG_DB: db },
    );
    expect(ssrfRes.status).toBe(400);

    const noSecretRes = await handleBuildCatalogRequest(
      new Request("https://exile.dunhas.com/api/builds/sync", { method: "POST" }),
      { BUILD_CATALOG_DB: db },
    );
    expect(noSecretRes.status).toBe(503);

    const badAuthRes = await handleBuildCatalogRequest(
      new Request("https://exile.dunhas.com/api/builds/sync", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      { BUILD_CATALOG_DB: db, CATALOG_ADMIN_KEY: "top-secret" },
    );
    expect(badAuthRes.status).toBe(401);
  });
});
