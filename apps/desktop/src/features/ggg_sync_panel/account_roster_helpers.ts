import { poe1GameAdapter } from "@exile-hud/game-data";
import type { GggAccountCharacter } from "../host_coordinator/tauri_ipc_adapter.js";

export const ALL_LEAGUES_VALUE = "__ALL__";

export type LeagueRulesetBadge = "SSF" | "HC" | "Ruthless";

export interface DerivedLeagueOption {
  id: string;
  count: number;
  latestLogin: number;
}

export interface RankedAccountCharacter extends GggAccountCharacter {
  isMostRecent: boolean;
}

const STANDARD_LEAGUE_NAMES = new Set(["standard", "hardcore", "ssf standard", "ssf hardcore"]);

const ASCENDANCY_TO_BASE_CLASS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>([["raider", "Ranger"]]);
  for (const cls of poe1GameAdapter.getPassiveTreeGraphMeta().classes) {
    map.set(cls.name.toLowerCase(), cls.name);
    for (const asc of cls.ascendancies) {
      map.set(asc.toLowerCase(), cls.name);
    }
  }
  return map;
})();

/** Checks whether a PoE account input includes a `#1234` or `-1234` discriminator. */
export function hasAccountDiscriminator(accountName: string): boolean {
  return /\S[#\-]\d{4}$/.test(accountName.trim());
}

function recencyScore(char: GggAccountCharacter): number {
  if (char.lastActive) return Number.MAX_SAFE_INTEGER;
  return char.lastLoginTime ?? 0;
}

/** Derives unique league dropdown options ordered by recent activity and challenge priority. */
export function deriveLeagueOptions(characters: readonly GggAccountCharacter[]): DerivedLeagueOption[] {
  const byLeague = new Map<string, DerivedLeagueOption>();
  for (const char of characters) {
    const league = char.league.trim() || "Standard";
    const score = recencyScore(char);
    const existing = byLeague.get(league);
    if (existing) {
      existing.count += 1;
      if (score > existing.latestLogin) existing.latestLogin = score;
    } else {
      byLeague.set(league, { id: league, count: 1, latestLogin: score });
    }
  }

  return [...byLeague.values()].sort((a, b) => {
    if (b.latestLogin !== a.latestLogin) return b.latestLogin - a.latestLogin;
    const aPerm = STANDARD_LEAGUE_NAMES.has(a.id.toLowerCase());
    const bPerm = STANDARD_LEAGUE_NAMES.has(b.id.toLowerCase());
    if (aPerm !== bPerm) return aPerm ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}

/** Picks a saved league if still present (or All Leagues), falling back to the top active league. */
export function pickPreferredLeague(leagues: readonly DerivedLeagueOption[], savedLeague: string): string {
  if (savedLeague === ALL_LEAGUES_VALUE) return ALL_LEAGUES_VALUE;
  if (savedLeague && leagues.some((l) => l.id === savedLeague)) return savedLeague;
  return leagues[0]?.id ?? "";
}

/** Filters characters to the selected league and sorts by recent login, then level. */
export function filterAndSortCharactersForLeague(
  characters: readonly GggAccountCharacter[],
  leagueId: string,
): RankedAccountCharacter[] {
  const filtered =
    !leagueId || leagueId === ALL_LEAGUES_VALUE
      ? [...characters]
      : characters.filter((c) => (c.league.trim() || "Standard") === leagueId);

  filtered.sort(
    (a, b) =>
      recencyScore(b) - recencyScore(a) ||
      b.level - a.level ||
      a.name.localeCompare(b.name),
  );

  const topScore = filtered[0] ? recencyScore(filtered[0]) : 0;
  return filtered.map((char, idx) => ({
    ...char,
    isMostRecent: idx === 0 && topScore > 0,
  }));
}

/** Extracts SSF / HC / Ruthless ruleset tags from a GGG league name. */
export function detectLeagueRulesetBadges(leagueName: string): LeagueRulesetBadge[] {
  const name = leagueName.trim();
  if (!name || name === ALL_LEAGUES_VALUE) return [];
  const badges: LeagueRulesetBadge[] = [];
  if (/\bssf\b|solo self-found/i.test(name)) badges.push("SSF");
  if (/\bhardcore\b|\bhc\b/i.test(name)) badges.push("HC");
  if (/\bruthless\b|^(?:hc\s+)?(?:ssf\s+)?r\s+/i.test(name)) badges.push("Ruthless");
  return badges;
}

/** Maps a GGG base class or ascendancy name back to the canonical PoE base class. */
export function resolveBaseClassFromGggClass(gggClass: string): string | null {
  const key = gggClass.trim().toLowerCase();
  if (!key) return null;
  return ASCENDANCY_TO_BASE_CLASS.get(key) ?? null;
}
