import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAccountCharactersIpc,
  type GggAccountCharacter,
} from "../host_coordinator/tauri_ipc_adapter.js";
import {
  deriveLeagueOptions,
  filterAndSortCharactersForLeague,
  hasAccountDiscriminator,
  pickPreferredLeague,
  type DerivedLeagueOption,
  type RankedAccountCharacter,
} from "./account_roster_helpers.js";

interface UseAccountCharacterRosterParams {
  accountName: string;
  selectedLeague: string;
  characterName: string;
  onChangeAccount: (nextAccount: string) => void;
  onChangeLeague: (nextLeague: string) => void;
  onSelectCharacter: (nextChar: string, nextAccount?: string) => void;
}

export interface UseAccountCharacterRosterResult {
  characters: GggAccountCharacter[];
  leagues: DerivedLeagueOption[];
  filteredCharacters: RankedAccountCharacter[];
  effectiveLeague: string;
  loading: boolean;
  rosterError: string | null;
  manualMode: boolean;
  setManualMode: (manual: boolean) => void;
  refreshRoster: (explicitAccount?: string) => Promise<void>;
  handleSelectLeague: (nextLeague: string) => void;
}

export function useAccountCharacterRoster({
  accountName,
  selectedLeague,
  characterName,
  onChangeAccount,
  onChangeLeague,
  onSelectCharacter,
}: UseAccountCharacterRosterParams): UseAccountCharacterRosterResult {
  const [characters, setCharacters] = useState<GggAccountCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const requestSeqRef = useRef(0);
  const lastFetchedAccountRef = useRef<string>("");
  const latestPropsRef = useRef({ selectedLeague, characterName, onChangeAccount, onChangeLeague, onSelectCharacter });
  latestPropsRef.current = { selectedLeague, characterName, onChangeAccount, onChangeLeague, onSelectCharacter };

  const refreshRoster = useCallback(async (explicitAccount?: string) => {
    const rawAccount = (explicitAccount ?? accountName).trim();
    if (!rawAccount) {
      setCharacters([]);
      setRosterError(null);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setRosterError(null);

    try {
      const res = await fetchAccountCharactersIpc(rawAccount);
      if (seq !== requestSeqRef.current) return;

      if (!res.ok) {
        setRosterError(res.error ?? `HTTP ${res.statusCode}`);
        return;
      }

      lastFetchedAccountRef.current = res.normalizedAccount;
      if (res.normalizedAccount && res.normalizedAccount !== rawAccount) {
        latestPropsRef.current.onChangeAccount(res.normalizedAccount);
      }

      setCharacters(res.characters);
      setManualMode(false);

      const props = latestPropsRef.current;
      const leagues = deriveLeagueOptions(res.characters);
      const matchedChar = res.characters.find(
        (c) => c.name.toLowerCase() === props.characterName.trim().toLowerCase(),
      );
      const seedLeague =
        !props.selectedLeague && matchedChar ? matchedChar.league : props.selectedLeague;
      const nextLeague = pickPreferredLeague(leagues, seedLeague);

      if (nextLeague !== props.selectedLeague) {
        props.onChangeLeague(nextLeague);
      }

      const nextFiltered = filterAndSortCharactersForLeague(res.characters, nextLeague);
      const isDefaultPlaceholder = !props.characterName.trim() || props.characterName === "ExileRunner";
      const missingFromAccount = !matchedChar;

      if ((isDefaultPlaceholder || missingFromAccount) && nextFiltered[0]) {
        props.onSelectCharacter(nextFiltered[0].name, res.normalizedAccount);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        setRosterError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    const trimmed = accountName.trim();
    if (!trimmed) {
      lastFetchedAccountRef.current = "";
      setCharacters([]);
      setRosterError(null);
      return;
    }

    const normalizedPreview = trimmed.replace(/-(\d{4})$/, "#$1");
    if (normalizedPreview === lastFetchedAccountRef.current) return;

    const isInitialMount = lastFetchedAccountRef.current === "";
    if (!isInitialMount && !hasAccountDiscriminator(trimmed)) return;

    const delayMs = isInitialMount ? 50 : 650;
    const timer = window.setTimeout(() => {
      void refreshRoster(trimmed);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [accountName, refreshRoster]);

  const leagues = useMemo(() => deriveLeagueOptions(characters), [characters]);
  const effectiveLeague = useMemo(
    () => pickPreferredLeague(leagues, selectedLeague),
    [leagues, selectedLeague],
  );
  const filteredCharacters = useMemo(
    () => filterAndSortCharactersForLeague(characters, effectiveLeague),
    [characters, effectiveLeague],
  );

  const handleSelectLeague = useCallback(
    (nextLeague: string) => {
      onChangeLeague(nextLeague);
      const nextFiltered = filterAndSortCharactersForLeague(characters, nextLeague);
      if (nextFiltered.length > 0 && !nextFiltered.some((c) => c.name === characterName)) {
        onSelectCharacter(nextFiltered[0]!.name);
      }
    },
    [characters, characterName, onChangeLeague, onSelectCharacter],
  );

  return {
    characters,
    leagues,
    filteredCharacters,
    effectiveLeague,
    loading,
    rosterError,
    manualMode,
    setManualMode,
    refreshRoster,
    handleSelectLeague,
  };
}
