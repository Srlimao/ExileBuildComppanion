import type {
  HudSessionSnapshot,
  PobSetSelection,
  SupportedGameId,
  ValidatedPobBuild,
} from "@exile-hud/core";
import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { persistActiveBuildCharacterLink } from "../host_coordinator/campaign_progress_persistence_client.js";
import { inspectPobBuildSets } from "../host_coordinator/desktop_telemetry_bridge.js";
import type { HostRunTimerClock } from "../host_coordinator/host_run_timer_clock.js";
import type { BuildEditorSubmitPayload } from "./build_library_editor_panel.js";
import {
  applyCharacterLinkToListing,
  applySnapshotSummaryToListing,
  createBuildLibraryCrudHandlers,
  createStarterBuildRecordForGame,
} from "./build_library_game_scope.js";
import {
  listBuildLibraryIpc,
  loadBuildFileIpc,
  openBuildsLibraryFolderIpc,
  saveBuildFileIpc,
  setActiveBuildPathIpc,
} from "./build_library_ipc_client.js";
import {
  bootstrapLibrarySession,
  compileAndHydrateBuildRecord,
  flushOutgoingBuildToDisk,
  saveBuildEditorRecord,
} from "./build_library_session_lifecycle.js";
import type { BuildEditorMode, BuildLibraryListing } from "./build_library_types.js";

interface UseBuildLibrarySessionParams {
  roomId: string;
  activeGameId: SupportedGameId;
  activeBuildPathRef: MutableRefObject<string | null>;
  snapshotRef: MutableRefObject<HudSessionSnapshot | null>;
  activeBuildRef: MutableRefObject<ValidatedPobBuild | null>;
  timerClockRef: MutableRefObject<HostRunTimerClock>;
  syncPrefsRef: MutableRefObject<{ accountName: string; characterName: string; simulatedOutage: boolean }>;
  getLiveSnapshot: () => HudSessionSnapshot | null;
  setSnapshot: (s: HudSessionSnapshot) => void;
  setActiveBuild: (b: ValidatedPobBuild | null) => void;
  setCharacterName: (name: string) => void;
  setSelectedLeague: (league: string) => void;
  pushPatch: (next: HudSessionSnapshot, eventTag: string) => void;
  runGggSync: (force: boolean) => void;
}

export function useBuildLibrarySession(params: UseBuildLibrarySessionParams) {
  const {
    roomId, activeGameId, activeBuildPathRef, snapshotRef, activeBuildRef, timerClockRef, syncPrefsRef,
    getLiveSnapshot, setSnapshot, setActiveBuild, setCharacterName, setSelectedLeague, pushPatch, runGggSync,
  } = params;

  const gameIdRef = useRef<SupportedGameId>(activeGameId);
  gameIdRef.current = activeGameId;

  const [listing, setListing] = useState<BuildLibraryListing | null>(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [editorMode, setEditorMode] = useState<BuildEditorMode>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshListing = useCallback(
    async (targetGameId: SupportedGameId = gameIdRef.current) => {
      const next = await listBuildLibraryIpc(targetGameId);
      setListing(next);
      activeBuildPathRef.current = next.activeBuildPath;
      return next;
    },
    [activeBuildPathRef],
  );

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const bootstrapInitialLibraryBuild = useCallback(
    async (savedLogPath?: string | null) => {
      const targetGame = gameIdRef.current;
      const booted = await bootstrapLibrarySession(roomId, targetGame, savedLogPath);
      activeBuildPathRef.current = booted.activePath;
      setActiveBuild(booted.build);
      activeBuildRef.current = booted.build;
      setCharacterName(booted.snapshot.characterName);
      if (booted.record.selectedLeague) setSelectedLeague(booted.record.selectedLeague);
      syncPrefsRef.current = { ...syncPrefsRef.current, characterName: booted.snapshot.characterName };
      setListing(booted.listing);
      timerClockRef.current.syncBaseSnapshot(booted.snapshot);
      setSnapshot(booted.snapshot);
      snapshotRef.current = booted.snapshot;
      return booted;
    },
    [activeBuildPathRef, activeBuildRef, roomId, setActiveBuild, setCharacterName, setSelectedLeague, setSnapshot, snapshotRef, syncPrefsRef, timerClockRef],
  );

  const applyActivatedRecord = useCallback(
    async (
      relativePath: string,
      skipFlushOutgoing = false,
      targetGameId: SupportedGameId = gameIdRef.current,
      outgoingGameId: SupportedGameId = gameIdRef.current,
    ) => {
      if (!skipFlushOutgoing) {
        await flushOutgoingBuildToDisk(activeBuildPathRef.current, getLiveSnapshot(), outgoingGameId);
      }
      const record = await loadBuildFileIpc(relativePath, targetGameId);
      const { build, snapshot } = await compileAndHydrateBuildRecord({
        roomId,
        gameId: targetGameId,
        record,
        previousSnapshot: snapshotRef.current,
      });
      await setActiveBuildPathIpc(relativePath, targetGameId);
      activeBuildPathRef.current = relativePath;
      setActiveBuild(build);
      activeBuildRef.current = build;
      setCharacterName(snapshot.characterName);
      setSelectedLeague(record.selectedLeague);
      syncPrefsRef.current = { ...syncPrefsRef.current, characterName: snapshot.characterName };
      timerClockRef.current.syncBaseSnapshot(snapshot);
      pushPatch(snapshot, "switch_build");
      setListing(await listBuildLibraryIpc(targetGameId));
      setEditorMode({ kind: "closed" });
      if (targetGameId === "poe1" && syncPrefsRef.current.accountName.trim() && snapshot.characterName.trim()) {
        runGggSync(false);
      }
    },
    [activeBuildPathRef, activeBuildRef, getLiveSnapshot, pushPatch, roomId, runGggSync, setActiveBuild, setCharacterName, setSelectedLeague, snapshotRef, syncPrefsRef, timerClockRef],
  );

  const ensureValidActive = useCallback(
    async (nextActive: string | null, targetGameId: SupportedGameId = gameIdRef.current) => {
      if (nextActive) {
        await applyActivatedRecord(nextActive, true, targetGameId, targetGameId);
        return;
      }
      const saved = await saveBuildFileIpc({
        folderPath: "",
        record: createStarterBuildRecordForGame(targetGameId, Date.now()),
        setActive: true,
        gameId: targetGameId,
      });
      await applyActivatedRecord(saved.relativePath, true, targetGameId, targetGameId);
    },
    [applyActivatedRecord],
  );

  const switchLibraryToGame = useCallback(
    async (nextGameId: SupportedGameId, prevGameId: SupportedGameId) => {
      await runAction(async () => {
        await flushOutgoingBuildToDisk(activeBuildPathRef.current, getLiveSnapshot(), prevGameId);
        gameIdRef.current = nextGameId;
        setCurrentFolder("");
        const nextListing = await listBuildLibraryIpc(nextGameId);
        if (nextListing.builds.length === 0) {
          await ensureValidActive(null, nextGameId);
          return;
        }
        const nextPath = nextListing.activeBuildPath ?? nextListing.builds[0]!.relativePath;
        await applyActivatedRecord(nextPath, true, nextGameId, prevGameId);
      });
    },
    [activeBuildPathRef, applyActivatedRecord, ensureValidActive, getLiveSnapshot, runAction],
  );

  const saveFromEditor = useCallback(
    async (payload: BuildEditorSubmitPayload) => {
      const targetGame = gameIdRef.current;
      await runAction(async () => {
        const saved = await saveBuildEditorRecord({
          roomId, gameId: targetGame, payload, activeBuildPath: activeBuildPathRef.current,
          currentSnapshot: snapshotRef.current, liveSnapshot: getLiveSnapshot(),
        });
        if (saved.isEditingActive) {
          activeBuildPathRef.current = saved.relativePath;
          setActiveBuild(saved.compiledBuild);
          activeBuildRef.current = saved.compiledBuild;
          setCharacterName(saved.activeSnapshot.characterName);
          setSelectedLeague(payload.selectedLeague);
          syncPrefsRef.current = { ...syncPrefsRef.current, characterName: saved.activeSnapshot.characterName };
          pushPatch(saved.activeSnapshot, "build_updated");
          await refreshListing(targetGame);
          setEditorMode({ kind: "closed" });
        } else if (payload.activateAfterSave) {
          await applyActivatedRecord(saved.relativePath, false, targetGame, targetGame);
        } else {
          await refreshListing(targetGame);
          setEditorMode({ kind: "closed" });
        }
      });
    },
    [activeBuildPathRef, activeBuildRef, applyActivatedRecord, getLiveSnapshot, pushPatch, refreshListing, roomId, runAction, setActiveBuild, setCharacterName, setSelectedLeague, snapshotRef, syncPrefsRef],
  );

  const updateActiveListingSummary = useCallback((snapshot: HudSessionSnapshot) => {
    const activePath = activeBuildPathRef.current;
    if (!activePath) return;
    setListing((prev) => applySnapshotSummaryToListing(prev, activePath, snapshot));
  }, [activeBuildPathRef]);

  const persistCharacterLink = useCallback((characterName: string, selectedLeague?: string) => {
    const activePath = activeBuildPathRef.current;
    if (!activePath) return;
    persistActiveBuildCharacterLink(activePath, characterName, selectedLeague, gameIdRef.current);
    setListing((prev) => applyCharacterLinkToListing(prev, activePath, characterName, selectedLeague));
  }, [activeBuildPathRef]);

  const crudHandlers = createBuildLibraryCrudHandlers({
    gameIdRef, activeBuildPathRef, currentFolder, setCurrentFolder,
    runAction, ensureValidActive, refreshListing,
  });

  return {
    listing, currentFolder, setCurrentFolder, editorMode, busy, error, activeBuildPathRef,
    openCreateEditor: () => setEditorMode({ kind: "create", targetFolder: currentFolder }),
    closeEditor: () => setEditorMode({ kind: "closed" }),
    openEditEditor: (relativePath: string) =>
      runAction(async () => {
        const record = await loadBuildFileIpc(relativePath, gameIdRef.current);
        const idx = relativePath.lastIndexOf("/");
        setEditorMode({ kind: "edit", targetPath: relativePath, targetFolder: idx === -1 ? "" : relativePath.slice(0, idx), record });
      }),
    bootstrapInitialLibraryBuild,
    switchLibraryToGame,
    activateBuild: (relativePath: string) => runAction(() => applyActivatedRecord(relativePath, false)),
    saveFromEditor,
    ...crudHandlers,
    openBuildsFolder: () => openBuildsLibraryFolderIpc(gameIdRef.current),
    updateActiveListingSummary,
    persistCharacterLink,
    inspectBuild: (rawPobInput: string, cachedXml?: string | null, previousSelection?: PobSetSelection | null) =>
      inspectPobBuildSets({ rawPobInput, cachedXml, previousSelection, gameId: gameIdRef.current }),
  };
}
