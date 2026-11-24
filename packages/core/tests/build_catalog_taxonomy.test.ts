import { describe, expect, it } from "vitest";
import {
  extractPatchVersion,
  normalizeBuildTags,
  normalizeClassAndAscendancy,
} from "../src/features/build_catalog/build_catalog_taxonomy.js";

describe("build_catalog_taxonomy", () => {
  it("normalizes PoE 1 class and ascendancy tokens", () => {
    expect(normalizeClassAndAscendancy("poe1", ["poe-necromancer", "poe-witch"])).toEqual({
      baseClass: "Witch",
      ascendancy: "Necromancer",
    });
    expect(normalizeClassAndAscendancy("poe1", ["marauder", "Berserker"])).toEqual({
      baseClass: "Marauder",
      ascendancy: "Berserker",
    });
    expect(normalizeClassAndAscendancy("poe1", ["duelist"])).toEqual({
      baseClass: "Duelist",
      ascendancy: "",
    });
  });

  it("normalizes PoE 2 class and ascendancy tokens", () => {
    expect(normalizeClassAndAscendancy("poe2", ["disciple-of-varashta", "sorceress"])).toEqual({
      baseClass: "Sorceress",
      ascendancy: "Disciple of Varashta",
    });
    expect(normalizeClassAndAscendancy("poe2", ["poe2-invoker"])).toEqual({
      baseClass: "Monk",
      ascendancy: "Invoker",
    });
  });

  it("extracts playstyle, goal, and damage tags from titles and taxonomies", () => {
    const tags = normalizeBuildTags(
      "[3.30] Righteous Fire Chieftain League Starter | Tanky Bossing & Mapping",
      ["poe-dot", "poe-league-starter", "fire"],
    );
    expect(tags.playstyleTags).toContain("dot_rf");
    expect(tags.goalTags).toEqual(
      expect.arrayContaining(["league_starter", "bosser", "mapper", "hc_friendly"]),
    );
    expect(tags.damageTags).toContain("fire");
  });

  it("extracts normalized patch versions", () => {
    expect(extractPatchVersion(["3.30 Covens"])).toBe("3.30");
    expect(extractPatchVersion(["3-30-covens-of-umbra"])).toBe("3.30");
    expect(extractPatchVersion(["the-forbidden-rites-0-5-5"])).toBe("0.5");
    expect(extractPatchVersion(["[3.29] Boneshatter"])).toBe("3.29");
  });
});
