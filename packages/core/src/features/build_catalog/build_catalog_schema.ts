import { z } from "zod";

export const BuildCatalogSourceSchema = z.enum(["maxroll", "poebuilds", "poeforum"]);
export type BuildCatalogSource = z.infer<typeof BuildCatalogSourceSchema>;

export const BuildPlaystyleTagSchema = z.enum([
  "melee",
  "caster",
  "ranged",
  "minion",
  "totem_brand",
  "trap_mine",
  "dot_rf",
  "trigger",
]);
export type BuildPlaystyleTag = z.infer<typeof BuildPlaystyleTagSchema>;

export const BuildGoalTagSchema = z.enum([
  "league_starter",
  "endgame",
  "bosser",
  "mapper",
  "ssf_friendly",
  "hc_friendly",
  "budget",
]);
export type BuildGoalTag = z.infer<typeof BuildGoalTagSchema>;

export const BuildDamageTagSchema = z.enum([
  "physical",
  "fire",
  "cold",
  "lightning",
  "chaos",
  "elemental",
]);
export type BuildDamageTag = z.infer<typeof BuildDamageTagSchema>;

export const BuildPobKindSchema = z.enum(["pobbin", "maxroll_pob", "none"]);
export type BuildPobKind = z.infer<typeof BuildPobKindSchema>;

export const CatalogCadenceModeSchema = z.enum(["hot_2d", "cool_weekly"]);
export type CatalogCadenceMode = z.infer<typeof CatalogCadenceModeSchema>;

export const BuildCatalogEntrySchema = z.object({
  id: z.string(),
  gameId: z.enum(["poe1", "poe2"]),
  source: BuildCatalogSourceSchema,
  sourceKey: z.string(),
  title: z.string(),
  author: z.string(),
  baseClass: z.string(),
  ascendancy: z.string(),
  mainSkill: z.string(),
  patchVersion: z.string(),
  leagueName: z.string(),
  playstyleTags: z.array(BuildPlaystyleTagSchema),
  goalTags: z.array(BuildGoalTagSchema),
  damageTags: z.array(BuildDamageTagSchema),
  excerpt: z.string(),
  guideUrl: z.string(),
  videoUrl: z.string().nullable(),
  pobUrl: z.string().nullable(),
  pobKind: BuildPobKindSchema,
  hasPobImport: z.boolean(),
  popularityScore: z.number(),
  sourcePublishedAt: z.number().nullable(),
  sourceUpdatedAt: z.number().nullable(),
  scrapedAt: z.number(),
});
export type BuildCatalogEntry = z.infer<typeof BuildCatalogEntrySchema>;

export const BuildCatalogQueryResponseSchema = z.object({
  items: z.array(BuildCatalogEntrySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  latestPatch: z.string(),
  activeLeague: z.string(),
  lastSyncedAt: z.number().nullable(),
  cadenceMode: CatalogCadenceModeSchema,
});
export type BuildCatalogQueryResponse = z.infer<typeof BuildCatalogQueryResponseSchema>;

export const BuildCatalogClassFacetSchema = z.object({
  baseClass: z.string(),
  count: z.number().int().nonnegative(),
  ascendancies: z.array(
    z.object({
      name: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export type BuildCatalogClassFacet = z.infer<typeof BuildCatalogClassFacetSchema>;

export const BuildCatalogFacetsResponseSchema = z.object({
  gameId: z.enum(["poe1", "poe2"]),
  totalBuilds: z.number().int().nonnegative(),
  pobReadyBuilds: z.number().int().nonnegative(),
  latestPatch: z.string(),
  activeLeague: z.string(),
  lastSyncedAt: z.number().nullable(),
  classes: z.array(BuildCatalogClassFacetSchema),
  playstyleTags: z.record(z.number().int().nonnegative()),
  goalTags: z.record(z.number().int().nonnegative()),
  sources: z.record(z.number().int().nonnegative()),
});
export type BuildCatalogFacetsResponse = z.infer<typeof BuildCatalogFacetsResponseSchema>;

export const CatalogSyncStatusSchema = z.object({
  activeLeagueName: z.string(),
  activeLeagueStartAt: z.string().nullable(),
  nextLeagueOverrideName: z.string().nullable(),
  nextLeagueOverrideStartAt: z.string().nullable(),
  latestDetectedPatchPoe1: z.string(),
  latestDetectedPatchPoe2: z.string(),
  cadenceMode: CatalogCadenceModeSchema,
  lastSyncedAt: z.number().nullable(),
  lastSyncStatus: z.string(),
  totalBuildsPoe1: z.number().int().nonnegative(),
  totalBuildsPoe2: z.number().int().nonnegative(),
});
export type CatalogSyncStatus = z.infer<typeof CatalogSyncStatusSchema>;
