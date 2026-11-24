import {
  extractPatchVersion,
  normalizeBuildTags,
  normalizeClassAndAscendancy,
} from "@exile-hud/core";
import type { CatalogDetailCacheItem, CatalogEntryUpsertRow } from "./build_catalog_d1_schema.js";
import { SCRAPER_USER_AGENT } from "./league_window_schedule_evaluator.js";

interface MaxrollGuideHit {
  id?: string | number;
  post_title?: string;
  excerpt?: string;
  permalink?: string;
  post_author?: { display_name?: string };
  post_date_unix?: number;
  post_modified_unix?: number;
  taxonomies?: {
    classes?: string[];
    metas?: string[];
    misc?: string[];
    num?: string[];
    damage_type?: string[];
    game_version?: string[];
    post_tag?: string[];
  };
}

function stripHtmlTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Parses Maxroll Remix SSR HTML index for PoE 1 or PoE 2 build guides. */
export function parseMaxrollRemixIndexHtml(
  html: string,
  gameId: "poe1" | "poe2",
  nowMs = Date.now(),
): CatalogEntryUpsertRow[] {
  const match = /window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (!match?.[1]) return [];

  let loaderData: Record<string, any>;
  try {
    const ctx = JSON.parse(match[1]) as { state?: { loaderData?: Record<string, any> } };
    loaderData = ctx.state?.loaderData ?? {};
  } catch {
    return [];
  }

  const routeKey = gameId === "poe2" ? "-build-guides-poe2" : "-build-guides-poe";
  const hits = loaderData[routeKey]?.searchData?.initialSearchResponse?.hits;
  if (!Array.isArray(hits)) return [];

  const entries: CatalogEntryUpsertRow[] = [];
  for (const hit of hits as MaxrollGuideHit[]) {
    const title = stripHtmlTags(hit.post_title ?? "");
    const guideUrl = (hit.permalink ?? "").trim();
    if (!title || !guideUrl) continue;

    const slug = guideUrl.split("/").filter(Boolean).pop() ?? String(hit.id ?? title);
    const sourceKey = String(hit.id ?? slug);
    const tax = hit.taxonomies ?? {};
    const rawTaxTokens = [
      ...(tax.metas ?? []),
      ...(tax.misc ?? []),
      ...(tax.num ?? []),
      ...(tax.damage_type ?? []),
    ];
    const { baseClass, ascendancy } = normalizeClassAndAscendancy(gameId, tax.classes ?? []);
    const { playstyleTags, goalTags, damageTags } = normalizeBuildTags(title, rawTaxTokens);
    const patchTokens = [...(tax.game_version ?? []), ...(tax.post_tag ?? []), title];
    const patchVersion = extractPatchVersion(patchTokens);
    const leagueName = (tax.game_version ?? [])[0]?.replace(/-/g, " ") ?? "";

    entries.push({
      id: `maxroll:${gameId}:${sourceKey}`,
      gameId,
      source: "maxroll",
      sourceKey,
      title,
      author: hit.post_author?.display_name?.trim() || "Maxroll",
      baseClass,
      ascendancy,
      mainSkill: "",
      patchVersion,
      leagueName,
      playstyleTags,
      goalTags,
      damageTags,
      excerpt: stripHtmlTags(hit.excerpt ?? "").slice(0, 260),
      guideUrl,
      videoUrl: null,
      pobUrl: null,
      pobKind: "none",
      hasPobImport: false,
      popularityScore: 50000,
      sourcePublishedAt: hit.post_date_unix ? hit.post_date_unix * 1000 : null,
      sourceUpdatedAt: hit.post_modified_unix ? hit.post_modified_unix * 1000 : null,
      detailCheckedAt: null,
      scrapedAt: nowMs,
    });
  }

  return entries;
}

/** Extracts the primary Maxroll PoB link or pobb.in link from a Maxroll guide page HTML. */
export function extractMaxrollGuidePobLink(
  guideHtml: string,
): { pobUrl: string; pobKind: "maxroll_pob" | "pobbin" } | null {
  const maxrollPob = /https?:\/\/(?:www\.)?maxroll\.gg\/poe\/pob\/[A-Za-z0-9_-]+/i.exec(guideHtml);
  if (maxrollPob?.[0]) {
    return { pobUrl: maxrollPob[0], pobKind: "maxroll_pob" };
  }
  const pobbin = /https?:\/\/(?:www\.)?pobb\.in\/[A-Za-z0-9_-]+/i.exec(guideHtml);
  if (pobbin?.[0]) {
    return { pobUrl: pobbin[0], pobKind: "pobbin" };
  }
  return null;
}

/** Fetches Maxroll's guide index and incrementally resolves PoB links within subrequest budget. */
export async function scrapeMaxrollBuilds(
  gameId: "poe1" | "poe2",
  detailCache: Map<string, CatalogDetailCacheItem>,
  detailBudget: number,
  fetcher: typeof fetch = fetch,
  nowMs = Date.now(),
): Promise<CatalogEntryUpsertRow[]> {
  const indexUrl =
    gameId === "poe2"
      ? "https://maxroll.gg/poe2/build-guides"
      : "https://maxroll.gg/poe/build-guides";
  const res = await fetcher(indexUrl, {
    headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`Maxroll ${gameId} index returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const entries = parseMaxrollRemixIndexHtml(html, gameId, nowMs);

  let remainingBudget = detailBudget;
  for (const entry of entries) {
    const cached = detailCache.get(entry.sourceKey);
    const cacheFresh =
      cached &&
      cached.detailCheckedAt !== null &&
      (entry.sourceUpdatedAt === null ||
        (cached.sourceUpdatedAt !== null && entry.sourceUpdatedAt <= cached.sourceUpdatedAt));

    if (cacheFresh && cached.pobUrl) {
      entry.pobUrl = cached.pobUrl;
      entry.pobKind = cached.pobUrl.includes("maxroll.gg") ? "maxroll_pob" : "pobbin";
      entry.hasPobImport = true;
      entry.detailCheckedAt = cached.detailCheckedAt;
      continue;
    }

    if (remainingBudget <= 0 || gameId !== "poe1") continue;
    if (cacheFresh) continue;

    remainingBudget -= 1;
    try {
      const detailRes = await fetcher(entry.guideUrl, {
        headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/html" },
      });
      if (!detailRes.ok) continue;
      const detailHtml = await detailRes.text();
      entry.detailCheckedAt = nowMs;
      const extracted = extractMaxrollGuidePobLink(detailHtml);
      if (extracted) {
        entry.pobUrl = extracted.pobUrl;
        entry.pobKind = extracted.pobKind;
        entry.hasPobImport = true;
      }
    } catch {
      // Skip individual detail failures without aborting the index run
    }
  }

  return entries;
}
