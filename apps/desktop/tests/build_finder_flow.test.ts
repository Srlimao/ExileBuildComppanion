import type { BuildCatalogEntry, BuildCatalogFacetsResponse, BuildCatalogQueryResponse } from "@exile-hud/core";
import { HudI18nProvider } from "@exile-hud/hud-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildFinderClassStep } from "../src/features/build_finder/build_finder_class_step.js";
import {
  fetchBuildCatalogEntries,
  fetchBuildCatalogFacets,
  resolveBuildPobInputForSelection,
} from "../src/features/build_finder/build_finder_ipc_and_api.js";
import { BuildFinderResultsStep } from "../src/features/build_finder/build_finder_results_step.js";
import { BuildFinderTagsStep } from "../src/features/build_finder/build_finder_tags_step.js";
import { BuildFinderWindowApp } from "../src/features/build_finder/build_finder_window_app.js";

const SAMPLE_ENTRY: BuildCatalogEntry = {
  id: "maxroll:poe1:64626",
  gameId: "poe1",
  source: "maxroll",
  sourceKey: "64626",
  title: "Carrion Golems & Zombies Necromancer",
  author: "helmbreaker",
  baseClass: "Witch",
  ascendancy: "Necromancer",
  mainSkill: "Summon Carrion Golem",
  patchVersion: "3.30",
  leagueName: "Covens",
  playstyleTags: ["minion"],
  goalTags: ["league_starter", "bosser"],
  damageTags: ["chaos"],
  excerpt: "All-rounder minion starter.",
  guideUrl: "https://maxroll.gg/poe/build-guides/carrion-golems",
  videoUrl: null,
  pobUrl: "https://maxroll.gg/poe/pob/dtjsf0o0",
  pobKind: "maxroll_pob",
  hasPobImport: true,
  popularityScore: 50000,
  sourcePublishedAt: 1000,
  sourceUpdatedAt: 2000,
  scrapedAt: 3000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("build_finder_flow", () => {
  it("fetches facets, catalog queries, and resolves Maxroll PoB codes via relay", async () => {
    const facetsPayload: BuildCatalogFacetsResponse = {
      gameId: "poe1",
      totalBuilds: 12,
      pobReadyBuilds: 9,
      latestPatch: "3.30",
      activeLeague: "Covens",
      lastSyncedAt: 5000,
      classes: [{ baseClass: "Witch", count: 4, ascendancies: [{ name: "Necromancer", count: 3 }] }],
      playstyleTags: { minion: 3 },
      goalTags: { league_starter: 7 },
      sources: { maxroll: 5 },
    };
    const queryPayload: BuildCatalogQueryResponse = {
      items: [SAMPLE_ENTRY],
      total: 1,
      limit: 60,
      offset: 0,
      latestPatch: "3.30",
      activeLeague: "Covens",
      lastSyncedAt: 5000,
      cadenceMode: "hot_2d",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/builds/facets")) {
        return new Response(JSON.stringify(facetsPayload), { status: 200 });
      }
      if (url.includes("/api/builds/catalog")) {
        return new Response(JSON.stringify(queryPayload), { status: 200 });
      }
      if (url.includes("/api/builds/resolve-pob")) {
        return new Response(JSON.stringify({ pobCode: "eNrMockPobCode" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const facets = await fetchBuildCatalogFacets("https://exile.dunhas.com", "poe1", true);
    expect(facets.totalBuilds).toBe(12);

    const catalog = await fetchBuildCatalogEntries("https://exile.dunhas.com", {
      gameId: "poe1",
      baseClass: "Witch",
      playstyleTags: ["minion"],
      goalTags: ["league_starter"],
      pobOnly: true,
      sort: "recommended",
    });
    expect(catalog.items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("playstyle=minion"),
      expect.anything(),
    );

    const resolved = await resolveBuildPobInputForSelection("https://exile.dunhas.com", SAMPLE_ENTRY);
    expect(resolved).toBe("eNrMockPobCode");
  });

  it("renders all 3 Build Finder steps cleanly in SSR markup", () => {
    const step1Html = renderToStaticMarkup(
      createElement(
        HudI18nProvider,
        null,
        createElement(BuildFinderClassStep, {
          gameId: "poe1",
          facets: null,
          selectedBaseClass: "Witch",
          selectedAscendancy: "Necromancer",
          onSelectClass: () => undefined,
          onNext: () => undefined,
          onSkipToAll: () => undefined,
        }),
      ),
    );
    expect(step1Html).toContain("Necromancer");
    expect(step1Html).toContain("Ver Todas as Builds");

    const step2Html = renderToStaticMarkup(
      createElement(
        HudI18nProvider,
        null,
        createElement(BuildFinderTagsStep, {
          facets: null,
          playstyleTags: ["minion"],
          goalTags: ["league_starter"],
          pobOnly: true,
          matchingCount: 4,
          onTogglePlaystyle: () => undefined,
          onToggleGoal: () => undefined,
          onTogglePobOnly: () => undefined,
          onBack: () => undefined,
          onShowResults: () => undefined,
        }),
      ),
    );
    expect(step2Html).toContain("Mostrar 4 Builds");
    expect(step2Html).toContain("Somente com PoB");

    const step3Html = renderToStaticMarkup(
      createElement(
        HudI18nProvider,
        null,
        createElement(BuildFinderResultsStep, {
          gameId: "poe1",
          items: [SAMPLE_ENTRY],
          total: 1,
          latestPatch: "3.30",
          loading: false,
          error: null,
          importingId: null,
          baseClass: "Witch",
          ascendancy: "Necromancer",
          playstyleTags: ["minion"],
          goalTags: ["league_starter"],
          sourceFilter: "",
          pobOnly: true,
          searchQuery: "",
          sortKey: "recommended",
          onChangeClass: () => undefined,
          onRemovePlaystyle: () => undefined,
          onRemoveGoal: () => undefined,
          onChangeSource: () => undefined,
          onTogglePobOnly: () => undefined,
          onChangeSearch: () => undefined,
          onChangeSort: () => undefined,
          onResetFilters: () => undefined,
          onRetry: () => undefined,
          onImportBuild: () => undefined,
          onOpenGuide: () => undefined,
        }),
      ),
    );
    expect(step3Html).toContain("Carrion Golems &amp; Zombies Necromancer");
    expect(step3Html).toContain("Importar Build");

    const rootHtml = renderToStaticMarkup(
      createElement(HudI18nProvider, null, createElement(BuildFinderWindowApp)),
    );
    expect(rootHtml).toContain("Buscar Build");
  });
});
