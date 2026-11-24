import {
  extractPatchVersion,
  normalizeBuildTags,
  normalizeClassAndAscendancy,
} from "@exile-hud/core";
import type { CatalogEntryUpsertRow } from "./build_catalog_d1_schema.js";
import { SCRAPER_USER_AGENT } from "./league_window_schedule_evaluator.js";

const POE1_CLASS_PATHS = [
  "/",
  "/poe1/duelist",
  "/poe1/marauder",
  "/poe1/ranger",
  "/poe1/scion",
  "/poe1/shadow",
  "/poe1/templar",
  "/poe1/witch",
];

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMetricViews(raw: string): number {
  const clean = raw.trim().toLowerCase().replace(/,/g, "");
  const m = /^(\d+(?:\.\d+)?)([km])?$/.exec(clean);
  if (!m?.[1]) return 0;
  const num = Number.parseFloat(m[1]);
  if (m[2] === "m") return Math.round(num * 1_000_000);
  if (m[2] === "k") return Math.round(num * 1_000);
  return Math.round(num);
}

function deriveSourceKey(guideUrl: string, pobUrl: string | null, title: string): string {
  const ytMatch = /[?&]v=([A-Za-z0-9_-]{6,})|youtu\.be\/([A-Za-z0-9_-]{6,})/.exec(guideUrl);
  if (ytMatch) return `yt_${ytMatch[1] ?? ytMatch[2]}`;
  const forumMatch = /view-thread\/(\d+)/.exec(guideUrl);
  if (forumMatch?.[1]) return `forum_${forumMatch[1]}`;
  if (pobUrl) {
    const pobId = pobUrl.split("/").pop();
    if (pobId) return `pob_${pobId}`;
  }
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64);
}

/** Parses server-rendered `.build-card` blocks from PoEBuilds.cc HTML pages. */
export function parsePoebuildsCardsHtml(
  html: string,
  gameId: "poe1" | "poe2",
  nowMs = Date.now(),
): CatalogEntryUpsertRow[] {
  const chunks = html.split('<div class="build-card"').slice(1);
  const byKey = new Map<string, CatalogEntryUpsertRow>();

  for (const rawChunk of chunks) {
    const chunk = rawChunk.slice(0, 2600);
    const classSlug = /data-class-slug="([^"]+)"/.exec(chunk)?.[1] ?? "";
    const ascAlt = /class="build-card-portrait"[\s\S]*?alt="([^"]+)"/.exec(chunk)?.[1] ?? "";
    const titleMatch = /<a href="([^"]+)"[^>]*class="build-card-title"[^>]*>([\s\S]*?)<\/a>/.exec(
      chunk,
    );
    if (!titleMatch?.[1] || !titleMatch?.[2]) continue;

    const primaryHref = decodeHtmlEntities(titleMatch[1]);
    const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]*>/g, ""));
    if (!title || classSlug === "misc") continue;

    const viewsRaw =
      /class="build-card-tag build-card-tag--metric[^"]*"[^>]*>[\s\S]*?>\s*([0-9.,]+[km]?)\s*<\/span>/i.exec(
        chunk,
      )?.[1] ?? "0";
    const versionRaw = decodeHtmlEntities(
      /class="build-card-tag build-card-tag--version[^"]*"[^>]*>([^<]+)<\/span>/.exec(chunk)?.[1] ??
        "",
    );
    const author = decodeHtmlEntities(
      /class="build-card-tag build-card-tag--author"[^>]*>([^<]+)<\/a>/.exec(chunk)?.[1] ?? "",
    );
    const pobUrl =
      /href="(https?:\/\/(?:www\.)?pobb\.in\/[A-Za-z0-9_-]+)"/.exec(chunk)?.[1] ?? null;
    const forumUrl =
      /href="(https?:\/\/(?:www\.)?pathofexile\.com\/forum\/view-thread\/\d+[^"]*)"/.exec(
        chunk,
      )?.[1] ?? null;
    const detailPageRel = /href="(\/poe[12]\/build\/[^"]+)"/.exec(chunk)?.[1] ?? null;
    const youtubeUrl =
      /youtube\.com|youtu\.be/i.test(primaryHref)
        ? primaryHref
        : (/href="(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"]+)"/.exec(chunk)?.[1] ?? null);

    const tagMatches = [...chunk.matchAll(/<span class="build-card-tag">([^<]+)<\/span>/g)].map(
      (m) => decodeHtmlEntities(m[1] ?? ""),
    );
    const { baseClass, ascendancy } = normalizeClassAndAscendancy(gameId, [ascAlt, classSlug]);
    const { playstyleTags, goalTags, damageTags } = normalizeBuildTags(title, tagMatches);
    const patchVersion = extractPatchVersion([versionRaw, title]);

    const guideUrl = primaryHref.startsWith("/")
      ? `https://www.poebuilds.cc${primaryHref}`
      : primaryHref || forumUrl || (detailPageRel ? `https://www.poebuilds.cc${detailPageRel}` : "");
    if (!guideUrl) continue;

    const sourceKey = deriveSourceKey(guideUrl, pobUrl, title);
    const candidate: CatalogEntryUpsertRow = {
      id: `poebuilds:${gameId}:${sourceKey}`,
      gameId,
      source: "poebuilds",
      sourceKey,
      title,
      author: author || "Community",
      baseClass,
      ascendancy,
      mainSkill: "",
      patchVersion,
      leagueName: versionRaw,
      playstyleTags,
      goalTags,
      damageTags,
      excerpt: tagMatches.length > 0 ? `Tags: ${tagMatches.join(" · ")}` : "",
      guideUrl,
      videoUrl: youtubeUrl,
      pobUrl,
      pobKind: pobUrl ? "pobbin" : "none",
      hasPobImport: Boolean(pobUrl),
      popularityScore: parseMetricViews(viewsRaw),
      sourcePublishedAt: null,
      sourceUpdatedAt: nowMs,
      detailCheckedAt: nowMs,
      scrapedAt: nowMs,
    };

    const existing = byKey.get(sourceKey);
    if (!existing || (!existing.hasPobImport && candidate.hasPobImport)) {
      byKey.set(sourceKey, candidate);
    }
  }

  return [...byKey.values()];
}

/** Scrapes PoEBuilds.cc homepage/class listings for PoE 1 or `/poe2` for PoE 2. */
export async function scrapePoebuildsCc(
  gameId: "poe1" | "poe2",
  fetcher: typeof fetch = fetch,
  nowMs = Date.now(),
): Promise<CatalogEntryUpsertRow[]> {
  const paths = gameId === "poe2" ? ["/poe2"] : POE1_CLASS_PATHS;
  const merged = new Map<string, CatalogEntryUpsertRow>();

  for (const path of paths) {
    try {
      const res = await fetcher(`https://www.poebuilds.cc${path}`, {
        headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/html" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      for (const row of parsePoebuildsCardsHtml(html, gameId, nowMs)) {
        const prev = merged.get(row.sourceKey);
        if (!prev || (!prev.hasPobImport && row.hasPobImport)) {
          merged.set(row.sourceKey, row);
        }
      }
    } catch {
      // Continue remaining class pages if a single page fails
    }
  }

  return [...merged.values()];
}
