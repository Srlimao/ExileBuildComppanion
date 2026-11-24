import {
  extractPatchVersion,
  normalizeBuildTags,
  normalizeClassAndAscendancy,
} from "@exile-hud/core";
import type { CatalogDetailCacheItem, CatalogEntryUpsertRow } from "./build_catalog_d1_schema.js";
import { SCRAPER_USER_AGENT } from "./league_window_schedule_evaluator.js";

const POE_CLASS_FORUMS: ReadonlyArray<{ slug: string; baseClass: string }> = [
  { slug: "marauder", baseClass: "Marauder" },
  { slug: "ranger", baseClass: "Ranger" },
  { slug: "witch", baseClass: "Witch" },
  { slug: "duelist", baseClass: "Duelist" },
  { slug: "templar", baseClass: "Templar" },
  { slug: "shadow", baseClass: "Shadow" },
  { slug: "scion", baseClass: "Scion" },
];

export interface ForumThreadCandidate {
  threadId: string;
  title: string;
  baseClass: string;
  guideUrl: string;
  patchVersion: string;
}

function decodeHtml(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const EXCLUDE_THREAD_REGEX = /\b(build list|guide index|help|question|looking for|lf build|suggestion)\b/i;

/** Parses a PoE official class forum index page and filters to current-patch build candidates. */
export function parsePoeForumIndexHtml(
  html: string,
  baseClass: string,
  targetPatch: string,
): ForumThreadCandidate[] {
  const results: ForumThreadCandidate[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a href="(\/forum\/view-thread\/(\d+))"[^>]*>\s*([^<]{8,140})\s*<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const relPath = match[1];
    const threadId = match[2];
    const title = decodeHtml(match[3] ?? "");
    if (!relPath || !threadId || !title || seen.has(threadId)) continue;
    seen.add(threadId);
    if (EXCLUDE_THREAD_REGEX.test(title)) continue;

    const patchVersion = extractPatchVersion([title]);
    if (!patchVersion) continue;
    if (targetPatch && patchVersion !== targetPatch) continue;

    results.push({
      threadId,
      title,
      baseClass,
      guideUrl: `https://www.pathofexile.com${relPath}`,
      patchVersion,
    });
  }

  return results;
}

/** Extracts the first `pobb.in` link from a PoE forum thread's opening post HTML. */
export function extractFirstPobbinFromThreadHtml(html: string): string | null {
  const opSlice = html.slice(0, 60_000);
  const match = /https?:\/\/(?:www\.)?pobb\.in\/[A-Za-z0-9_-]+/i.exec(opSlice);
  return match?.[0] ?? null;
}

/** Scrapes PoE 1 class forums for current-patch guides that contain a verified `pobb.in` link. */
export async function scrapePoeForumBuilds(
  targetPatch: string,
  detailCache: Map<string, CatalogDetailCacheItem>,
  detailBudget: number,
  fetcher: typeof fetch = fetch,
  nowMs = Date.now(),
): Promise<CatalogEntryUpsertRow[]> {
  const candidates: ForumThreadCandidate[] = [];
  for (const forum of POE_CLASS_FORUMS) {
    try {
      const res = await fetcher(`https://www.pathofexile.com/forum/view-forum/${forum.slug}`, {
        headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/html" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      candidates.push(...parsePoeForumIndexHtml(html, forum.baseClass, targetPatch));
    } catch {
      // Skip failing forum page without blocking others
    }
  }

  const emitted: CatalogEntryUpsertRow[] = [];
  let remainingBudget = detailBudget;

  for (const candidate of candidates) {
    const cached = detailCache.get(candidate.threadId);
    let pobUrl: string | null = cached?.pobUrl ?? null;

    if (!pobUrl && cached?.detailCheckedAt !== undefined && cached?.detailCheckedAt !== null) {
      continue;
    }

    if (!pobUrl) {
      if (remainingBudget <= 0) continue;
      remainingBudget -= 1;
      try {
        const res = await fetcher(candidate.guideUrl, {
          headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/html" },
        });
        if (!res.ok) continue;
        const html = await res.text();
        pobUrl = extractFirstPobbinFromThreadHtml(html);
      } catch {
        continue;
      }
    }

    if (!pobUrl) continue;

    const { baseClass, ascendancy } = normalizeClassAndAscendancy("poe1", [
      candidate.title,
      candidate.baseClass,
    ]);
    const { playstyleTags, goalTags, damageTags } = normalizeBuildTags(candidate.title, []);

    emitted.push({
      id: `poeforum:poe1:${candidate.threadId}`,
      gameId: "poe1",
      source: "poeforum",
      sourceKey: candidate.threadId,
      title: candidate.title,
      author: "PoE Forum",
      baseClass: baseClass === "Unknown" ? candidate.baseClass : baseClass,
      ascendancy,
      mainSkill: "",
      patchVersion: candidate.patchVersion,
      leagueName: "",
      playstyleTags,
      goalTags,
      damageTags,
      excerpt: "",
      guideUrl: candidate.guideUrl,
      videoUrl: null,
      pobUrl,
      pobKind: "pobbin",
      hasPobImport: true,
      popularityScore: 1000,
      sourcePublishedAt: null,
      sourceUpdatedAt: nowMs,
      detailCheckedAt: nowMs,
      scrapedAt: nowMs,
    });
  }

  return emitted;
}
