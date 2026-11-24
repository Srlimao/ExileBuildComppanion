import type { CharacterSyncStatus, SupportedGameId } from "@exile-hud/core";
import { localizeConnectionOrSyncMessage, useHudI18n } from "@exile-hud/hud-ui";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import {
  ALL_LEAGUES_VALUE,
  detectLeagueRulesetBadges,
  resolveBaseClassFromGggClass,
} from "./account_roster_helpers.js";
import { useAccountCharacterRoster } from "./use_account_character_roster.js";

interface CharacterSyncSettingsCardProps {
  gameId?: SupportedGameId;
  accountName: string;
  selectedLeague: string;
  characterName: string;
  pobCharacterClass: string | null;
  syncStatus: CharacterSyncStatus;
  syncMessage: string | null;
  onChangeAccount: (nextAccount: string) => void;
  onChangeLeague: (nextLeague: string) => void;
  onChangeCharacter: (nextChar: string) => void;
  onSelectCharacter: (nextChar: string, nextAccount?: string) => void;
  onForceSync: () => Promise<void>;
}

const STATUS_STYLE: Record<CharacterSyncStatus, string> = {
  ONLINE_PUBLIC: "text-hud-ok",
  OFFLINE_FALLBACK: "text-hud-warn",
  UNCONFIGURED: "text-hud-muted",
};

/** Public-profile GGG character roster and manual sync card inside the Connect tab. */
export function CharacterSyncSettingsCard({
  gameId = "poe1",
  accountName,
  selectedLeague,
  characterName,
  pobCharacterClass,
  syncStatus,
  syncMessage,
  onChangeAccount,
  onChangeLeague,
  onChangeCharacter,
  onSelectCharacter,
  onForceSync,
}: CharacterSyncSettingsCardProps) {
  const { locale, appMsg } = useHudI18n();
  const roster = useAccountCharacterRoster({
    accountName,
    selectedLeague,
    characterName,
    onChangeAccount,
    onChangeLeague,
    onSelectCharacter,
  });

  if (gameId === "poe2") {
    return (
      <section className="rounded-2xl bg-hud-surface border border-hud-hairline p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-hud-text truncate">
            {appMsg.desktop.gggSyncTitle}
          </h2>
          <span className="text-[10px] font-mono text-hud-muted shrink-0">
            {appMsg.poe2.gameShortLabels.poe2}
          </span>
        </div>
        <div className="border-l-2 border-hud-accent pl-3 py-1 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-hud-text">
            <Info className="h-3.5 w-3.5 text-hud-accent shrink-0" />
            <span>{appMsg.poe2.oauthPendingTitle}</span>
          </div>
          <p className="text-[11px] text-hud-muted leading-relaxed">{appMsg.poe2.oauthPendingBody}</p>
        </div>
      </section>
    );
  }

  const activeEntry = roster.characters.find((c) => c.name === characterName) ?? null;
  const activeLeagueName = activeEntry?.league || roster.effectiveLeague;
  const rulesetBadges = detectLeagueRulesetBadges(activeLeagueName);
  const charBaseClass = activeEntry ? resolveBaseClassFromGggClass(activeEntry.class) : null;
  const hasClassMismatch = Boolean(
    charBaseClass && pobCharacterClass && charBaseClass.toLowerCase() !== pobCharacterClass.toLowerCase(),
  );

  const statusErrorOrHint = localizeConnectionOrSyncMessage(
    roster.rosterError ?? syncMessage,
    locale,
  );
  const charDropdownValue = roster.filteredCharacters.some((c) => c.name === characterName)
    ? characterName
    : "";

  return (
    <section className="rounded-2xl bg-hud-surface border border-hud-hairline p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="text-xs font-semibold text-hud-text truncate">
            {appMsg.desktop.gggSyncTitle}
          </h2>
          {rulesetBadges.map((badge) => (
            <span
              key={badge}
              className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-hud-subtle text-hud-quest border border-hud-hairline shrink-0"
            >
              {badge}
            </span>
          ))}
        </div>
        <span className={`text-[10px] font-mono shrink-0 ${STATUS_STYLE[syncStatus] ?? "text-hud-muted"}`}>
          {appMsg.desktop.syncStatuses[syncStatus]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block truncate">{appMsg.desktop.accountLabel}</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={accountName}
              onChange={(e) => onChangeAccount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void roster.refreshRoster();
                }
              }}
              placeholder={appMsg.desktop.accountPlaceholder}
              className="w-full min-w-0 rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
            />
            <button
              type="button"
              disabled={roster.loading || !accountName.trim()}
              onClick={() => void roster.refreshRoster()}
              title={appMsg.desktop.fetchCharactersBtn}
              className="p-1.5 rounded-lg bg-hud-subtle border border-hud-hairline hover:bg-hud-hairline/40 disabled:opacity-45 text-hud-text cursor-pointer shrink-0 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${roster.loading ? "animate-spin text-hud-accent" : ""}`} />
            </button>
          </div>
        </label>

        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block truncate">{appMsg.desktop.leagueLabel}</span>
          <select
            disabled={roster.leagues.length === 0}
            value={roster.effectiveLeague}
            onChange={(e) => roster.handleSelectLeague(e.target.value)}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent disabled:opacity-55 cursor-pointer"
          >
            {roster.leagues.length === 0 ? (
              <option value="" className="bg-hud-surface text-hud-text">
                {roster.loading
                  ? appMsg.desktop.fetchingRoster
                  : accountName.trim()
                    ? appMsg.desktop.noCharactersFound
                    : appMsg.desktop.enterAccountFirst}
              </option>
            ) : (
              <>
                {roster.leagues.map((league) => (
                  <option key={league.id} value={league.id} className="bg-hud-surface text-hud-text">
                    {league.id} ({league.count})
                  </option>
                ))}
                <option value={ALL_LEAGUES_VALUE} className="bg-hud-surface text-hud-text">
                  {appMsg.desktop.allLeaguesOption(roster.characters.length)}
                </option>
              </>
            )}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-hud-muted">{appMsg.desktop.activeCharacterLabel}</span>
          <button
            type="button"
            onClick={() => roster.setManualMode(!roster.manualMode)}
            className="text-[11px] text-hud-accent hover:underline cursor-pointer"
          >
            {roster.manualMode ? appMsg.desktop.dropdownSelectToggle : appMsg.desktop.manualEntryToggle}
          </button>
        </div>

        {roster.manualMode ? (
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacter(e.target.value)}
            placeholder={appMsg.desktop.activeCharacterPlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        ) : (
          <select
            disabled={roster.filteredCharacters.length === 0}
            value={charDropdownValue}
            onChange={(e) => {
              if (e.target.value) onSelectCharacter(e.target.value);
            }}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent disabled:opacity-55 cursor-pointer"
          >
            {roster.filteredCharacters.length === 0 ? (
              <option value="" className="bg-hud-surface text-hud-text">
                {roster.loading
                  ? appMsg.desktop.fetchingRoster
                  : accountName.trim()
                    ? characterName || appMsg.desktop.noCharactersFound
                    : appMsg.desktop.enterAccountFirst}
              </option>
            ) : (
              roster.filteredCharacters.map((char) => (
                <option key={char.name} value={char.name} className="bg-hud-surface text-hud-text">
                  {char.isMostRecent ? "★ " : ""}
                  {char.name} — Lv {char.level} {char.class}
                  {roster.effectiveLeague === ALL_LEAGUES_VALUE ? ` · ${char.league}` : ""}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {hasClassMismatch && activeEntry && pobCharacterClass && (
        <div className="border-l-2 border-hud-warn pl-2.5 py-0.5 text-[11px] text-hud-warn flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{appMsg.desktop.classMismatchHint(activeEntry.class, pobCharacterClass)}</span>
        </div>
      )}

      <p
        className={`text-[11px] truncate ${roster.rosterError ? "text-hud-warn" : "text-hud-muted"}`}
        title={statusErrorOrHint ?? undefined}
      >
        {statusErrorOrHint ?? appMsg.desktop.defaultSyncHint}
      </p>

      <button
        type="button"
        onClick={() => void onForceSync()}
        className="w-full rounded-xl bg-hud-accent text-hud-accent-fg hover:opacity-90 px-3 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {appMsg.desktop.forceSync}
      </button>
    </section>
  );
}
