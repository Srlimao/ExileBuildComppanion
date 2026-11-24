import type { GameAdapter, LeagueStarterFilterMetadata, SupportedGameId } from "./game_adapter_contract.js";
import { poe1GameAdapter } from "./poe1_campaign_game_adapter.js";
import { poe2GameAdapter } from "./poe2_campaign_game_adapter.js";

/** Normalizes any optional/unknown game identifier string into a supported GameId. */
export function normalizeSupportedGameId(raw?: string | null): SupportedGameId {
  return raw?.trim().toLowerCase() === "poe2" ? "poe2" : "poe1";
}

/** Resolves the active GameAdapter instance for PoE 1 or PoE 2. */
export function getGameAdapter(gameId?: SupportedGameId | string | null): GameAdapter {
  return normalizeSupportedGameId(gameId) === "poe2" ? poe2GameAdapter : poe1GameAdapter;
}

/** Resolves baked NeverSink starter loot filter metadata for the specified game. */
export function getLeagueStarterFilterMetaForGame(
  gameId?: SupportedGameId | string | null,
): LeagueStarterFilterMetadata {
  return getGameAdapter(gameId).getLeagueStarterFilterMeta();
}
