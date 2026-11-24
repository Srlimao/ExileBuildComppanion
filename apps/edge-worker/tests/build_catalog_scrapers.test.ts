import { describe, expect, it } from "vitest";
import {
  extractMaxrollGuidePobLink,
  parseMaxrollRemixIndexHtml,
} from "../src/features/build_catalog/maxroll_build_scraper.js";
import {
  extractFirstPobbinFromThreadHtml,
  parsePoeForumIndexHtml,
} from "../src/features/build_catalog/poe_forum_build_scraper.js";
import { parsePoebuildsCardsHtml } from "../src/features/build_catalog/poebuilds_cc_scraper.js";

describe("build_catalog_scrapers", () => {
  it("parses Maxroll PoE 1 & PoE 2 Remix SSR JSON and extracts PoB links", () => {
    const mockRemix = {
      state: {
        loaderData: {
          "-build-guides-poe": {
            searchData: {
              initialSearchResponse: {
                hits: [
                  {
                    id: "64626",
                    post_title: "Carrion Golems Necromancer League Starter",
                    excerpt: "<p>Powerful all-rounder Minion build.</p>",
                    permalink: "https://maxroll.gg/poe/build-guides/carrion-golems-necromancer",
                    post_author: { display_name: "helmbreaker" },
                    post_date_unix: 1772497380,
                    post_modified_unix: 1795512999,
                    taxonomies: {
                      classes: ["poe-necromancer", "poe-witch"],
                      metas: ["poe-bossing", "poe-mapping"],
                      misc: ["poe-endgame", "poe-league-starter"],
                      num: ["poe-minions"],
                      damage_type: ["chaos"],
                      game_version: ["3-30-covens-of-umbra"],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    };
    const html = `<html><script>window.__remixContext = ${JSON.stringify(mockRemix)};</script></html>`;
    const rows = parseMaxrollRemixIndexHtml(html, "poe1", 1000);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.baseClass).toBe("Witch");
    expect(rows[0]!.ascendancy).toBe("Necromancer");
    expect(rows[0]!.patchVersion).toBe("3.30");
    expect(rows[0]!.playstyleTags).toContain("minion");
    expect(rows[0]!.goalTags).toEqual(expect.arrayContaining(["league_starter", "bosser", "endgame"]));

    expect(
      extractMaxrollGuidePobLink('<a href="https://maxroll.gg/poe/pob/dtjsf0o0">PoB</a>'),
    ).toEqual({ pobUrl: "https://maxroll.gg/poe/pob/dtjsf0o0", pobKind: "maxroll_pob" });
  });

  it("parses PoEBuilds.cc build cards with pobb.in, class, views, and tags", () => {
    const html = `
      <div class="build-card" data-class-slug="marauder">
        <div class="build-card-portrait"><img src="/x.webp" alt="Berserker"></div>
        <div class="build-card-body">
          <a href="https://www.youtube.com/watch?v=PE9U1dy9zDA" class="build-card-title">Bladestorm Rage Vortex 3.30</a>
          <div class="build-card-tags-line">
            <span class="build-card-tag build-card-tag--metric build-card-tag--icon"><img src="/x">130k</span>
            <span class="build-card-tag build-card-tag--version build-card-tag--version-current">3.30 Covens</span>
            <span class="build-card-tag build-card-tag--class" data-class-slug="marauder">Marauder</span>
            <span class="build-card-tag">Melee</span>
          </div>
          <div class="build-card-tags-line">
            <a href="/poe1/author/exiled-cat" class="build-card-tag build-card-tag--author">Exiled Cat</a>
            <a href="https://pobb.in/Wpo4TuYfRXFT" class="build-card-tag build-card-tag--ext build-card-tag--pobbin">pobb.in</a>
          </div>
        </div>
      </div>`;
    const rows = parsePoebuildsCardsHtml(html, "poe1", 2000);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.baseClass).toBe("Marauder");
    expect(rows[0]!.ascendancy).toBe("Berserker");
    expect(rows[0]!.popularityScore).toBe(130000);
    expect(rows[0]!.hasPobImport).toBe(true);
    expect(rows[0]!.pobUrl).toBe("https://pobb.in/Wpo4TuYfRXFT");
    expect(rows[0]!.playstyleTags).toContain("melee");
  });

  it("filters PoE forum threads to target patch and extracts OP pobb.in", () => {
    const indexHtml = `
      <a href="/forum/view-thread/4016791">[3.30] RF Chieftain League Starter</a>
      <a href="/forum/view-thread/3418310">[3.22] Old Flicker Juggernaut</a>
      <a href="/forum/view-thread/1457463">[3.30] Marauder Build List & Guide Index</a>`;
    const candidates = parsePoeForumIndexHtml(indexHtml, "Marauder", "3.30");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.threadId).toBe("4016791");

    expect(extractFirstPobbinFromThreadHtml('<div>PoB: https://pobb.in/AbCd1234</div>')).toBe(
      "https://pobb.in/AbCd1234",
    );
    expect(extractFirstPobbinFromThreadHtml("<div>No PoB here yet</div>")).toBeNull();
  });
});
