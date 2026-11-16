import { describe, expect, it } from "vitest";
import {
  ALL_LEAGUES_VALUE,
  deriveLeagueOptions,
  detectLeagueRulesetBadges,
  filterAndSortCharactersForLeague,
  hasAccountDiscriminator,
  pickPreferredLeague,
  resolveBaseClassFromGggClass,
} from "../src/features/ggg_sync_panel/account_roster_helpers.js";
import type { GggAccountCharacter } from "../src/features/host_coordinator/tauri_ipc_adapter.js";

const SAMPLE_ROSTER: GggAccountCharacter[] = [
  {
    name: "OldStandardBoss",
    class: "Juggernaut",
    league: "Standard",
    level: 100,
    lastLoginTime: 1_700_000_000,
    lastActive: false,
  },
  {
    name: "CovensStarter",
    class: "Elementalist",
    league: "Covens",
    level: 44,
    lastLoginTime: 1_790_000_500,
    lastActive: false,
  },
  {
    name: "CovensAlt",
    class: "Warden",
    league: "Covens",
    level: 89,
    lastLoginTime: 1_790_000_100,
    lastActive: false,
  },
  {
    name: "HardcoreRunner",
    class: "Slayer",
    league: "HC SSF Covens",
    level: 18,
    lastLoginTime: 1_780_000_000,
    lastActive: false,
  },
];

describe("account_roster_helpers", () => {
  it("validates #1234 and -1234 account discriminators", () => {
    expect(hasAccountDiscriminator("SrLimao#1234")).toBe(true);
    expect(hasAccountDiscriminator("SrLimao-1234")).toBe(true);
    expect(hasAccountDiscriminator("SrLimao")).toBe(false);
    expect(hasAccountDiscriminator("SrLimao#12")).toBe(false);
  });

  it("derives league options sorted by most recent activity and preserves valid saved preference", () => {
    const leagues = deriveLeagueOptions(SAMPLE_ROSTER);
    expect(leagues.map((l) => [l.id, l.count])).toEqual([
      ["Covens", 2],
      ["HC SSF Covens", 1],
      ["Standard", 1],
    ]);

    expect(pickPreferredLeague(leagues, "")).toBe("Covens");
    expect(pickPreferredLeague(leagues, "ExpiredLeague")).toBe("Covens");
    expect(pickPreferredLeague(leagues, "HC SSF Covens")).toBe("HC SSF Covens");
    expect(pickPreferredLeague(leagues, ALL_LEAGUES_VALUE)).toBe(ALL_LEAGUES_VALUE);
  });

  it("filters and sorts characters within the selected league by recency then level", () => {
    const covens = filterAndSortCharactersForLeague(SAMPLE_ROSTER, "Covens");
    expect(covens.map((c) => [c.name, c.isMostRecent])).toEqual([
      ["CovensStarter", true],
      ["CovensAlt", false],
    ]);

    const all = filterAndSortCharactersForLeague(SAMPLE_ROSTER, ALL_LEAGUES_VALUE);
    expect(all.map((c) => c.name)).toEqual([
      "CovensStarter",
      "CovensAlt",
      "HardcoreRunner",
      "OldStandardBoss",
    ]);
  });

  it("detects SSF, HC, and Ruthless ruleset badges accurately", () => {
    expect(detectLeagueRulesetBadges("HC SSF Covens")).toEqual(["SSF", "HC"]);
    expect(detectLeagueRulesetBadges("Ruthless Covens")).toEqual(["Ruthless"]);
    expect(detectLeagueRulesetBadges("HC Ruthless Covens")).toEqual(["HC", "Ruthless"]);
    expect(detectLeagueRulesetBadges("Standard")).toEqual([]);
    expect(detectLeagueRulesetBadges(ALL_LEAGUES_VALUE)).toEqual([]);
  });

  it("maps GGG ascendancy and base class names back to canonical base classes", () => {
    expect(resolveBaseClassFromGggClass("Elementalist")).toBe("Witch");
    expect(resolveBaseClassFromGggClass("Warden")).toBe("Ranger");
    expect(resolveBaseClassFromGggClass("Raider")).toBe("Ranger");
    expect(resolveBaseClassFromGggClass("Marauder")).toBe("Marauder");
    expect(resolveBaseClassFromGggClass("UnknownClass")).toBeNull();
  });
});
