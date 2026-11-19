import type { HudSessionSnapshot, PobSetSelection, ValidatedPobBuild } from "@exile-hud/core";
import { useCallback, useState, type MutableRefObject } from "react";
import { persistActiveBuildCharacterLink } from "../host_coordinator/campaign_progress_persistence_client.js";
import { inspectPobBuildSets } from "../host_coordinator/desktop_telemetry_bridge.js";
import type { HostRunTimerClock } from "../host_coordinator/host_run_timer_clock.js";
import {
  createFolderEntry,
  deleteBuildEntry,
  deleteFolderEntry,
  duplicateBuildEntry,
  moveBuildEntry,
  renameFolderEntry,
} from "./build_library_crud_actions.js";
import type { BuildEditorSubmitPayload } from "./build_library_editor_panel.js";
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
  createStarterBuildRecord,
  flushOutgoingBuildToDisk,
  saveBuildEditorRecord,
} from "./build_library_session_lifecycle.js";
import {
  buildSummaryFromSnapshot,
  type BuildEditorMode,
  type BuildLibraryEntrySummary,
  type BuildLibraryListing,
} from "./build_library_types.js";

interface UseBuildLibrarySessionParams {
  roomId: string;
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
    roomId, activeBuildPathRef, snapshotRef, activeBuildRef, timerClockRef, syncPrefsRef,
    getLiveSnapshot, setSnapshot, setActiveBuild, setCharacterName, setSelectedLeague, pushPatch, runGggSync,
  } = params;

  const [listing, setListing] = useState<BuildLibraryListing | null>(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [editorMode, setEditorMode] = useState<BuildEditorMode>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshListing = useCallback(async () => {
    const next = await listBuildLibraryIpc();
    setListing(next);
    activeBuildPathRef.current = next.activeBuildPath;
    return next;
  }, [activeBuildPathRef]);

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

  const bootstrapInitialLibraryBuild = useCallback(async () => {
    const booted = await bootstrapLibrarySession(roomId);
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
  }, [activeBuildPathRef, activeBuildRef, roomId, setActiveBuild, setCharacterName, setSelectedLeague, setSnapshot, snapshotRef, syncPrefsRef, timerClockRef]);

  const applyActivatedRecord = useCallback(
    async (relativePath: string, skipFlushOutgoing = false) => {
      if (!skipFlushOutgoing) {
        await flushOutgoingBuildToDisk(activeBuildPathRef.current, getLiveSnapshot());
      }
      const record = await loadBuildFileIpc(relativePath);
      const { build, snapshot } = await compileAndHydrateBuildRecord({
        roomId,
        record,
        previousSnapshot: snapshotRef.current,
      });
      await setActiveBuildPathIpc(relativePath);
      activeBuildPathRef.current = relativePath;
      setActiveBuild(build);
      activeBuildRef.current = build;
      setCharacterName(snapshot.characterName);
      setSelectedLeague(record.selectedLeague);
      syncPrefsRef.current = { ...syncPrefsRef.current, characterName: snapshot.characterName };
      timerClockRef.current.syncBaseSnapshot(snapshot);
      pushPatch(snapshot, "switch_build");
      setListing(await listBuildLibraryIpc());
      setEditorMode({ kind: "closed" });
      if (syncPrefsRef.current.accountName.trim() && snapshot.characterName.trim()) {
        runGggSync(false);
      }
    },
    [activeBuildPathRef, activeBuildRef, getLiveSnapshot, pushPatch, roomId, runGggSync, setActiveBuild, setCharacterName, setSelectedLeague, snapshotRef, syncPrefsRef, timerClockRef],
  );

  const ensureValidActive = useCallback(
    async (nextActive: string | null) => {
      if (nextActive) {
        await applyActivatedRecord(nextActive, true);
        return;
      }
      const saved = await saveBuildFileIpc({
        folderPath: "",
        record: createStarterBuildRecord(Date.now()),
        setActive: true,
      });
      await applyActivatedRecord(saved.relativePath, true);
    },
    [applyActivatedRecord],
  );

  const saveFromEditor = useCallback(
    async (payload: BuildEditorSubmitPayload) => {
      await runAction(async () => {
        const saved = await saveBuildEditorRecord({
          roomId, payload, activeBuildPath: activeBuildPathRef.current,
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
          await refreshListing();
          setEditorMode({ kind: "closed" });
        } else if (payload.activateAfterSave) {
          await applyActivatedRecord(saved.relativePath, false);
        } else {
          await refreshListing();
          setEditorMode({ kind: "closed" });
        }
      });
    },
    [activeBuildPathRef, activeBuildRef, applyActivatedRecord, getLiveSnapshot, pushPatch, refreshListing, roomId, runAction, setActiveBuild, setCharacterName, setSelectedLeague, snapshotRef, syncPrefsRef],
  );

  const updateActiveListingSummary = useCallback((snapshot: HudSessionSnapshot) => {
    const activePath = activeBuildPathRef.current;
    if (!activePath) return;
    const summary = buildSummaryFromSnapshot(snapshot);
    setListing((prev) =>
      prev
        ? {
            ...prev,
            builds: prev.builds.map((b) =>
              b.relativePath === activePath
                ? { ...b, summary, characterName: snapshot.characterName || b.characterName, runElapsedMs: snapshot.runElapsedMs, updatedAtMs: Date.now() }
                : b,
            ),
          }
        : prev,
    );
  }, [activeBuildPathRef]);

  const persistCharacterLink = useCallback((characterName: string, selectedLeague?: string) => {
    const activePath = activeBuildPathRef.current;
    if (!activePath) return;
    persistActiveBuildCharacterLink(activePath, characterName, selectedLeague);
    setListing((prev) =>
      prev
        ? {
            ...prev,
            builds: prev.builds.map((b) =>
              b.relativePath === activePath
                ? { ...b, characterName, ...(selectedLeague !== undefined ? { selectedLeague } : {}) }
                : b,
            ),
          }
        : prev,
    );
  }, [activeBuildPathRef]);

  return {
    listing, currentFolder, setCurrentFolder, editorMode, busy, error, activeBuildPathRef,
    openCreateEditor: () => setEditorMode({ kind: "create", targetFolder: currentFolder }),
    closeEditor: () => setEditorMode({ kind: "closed" }),
    openEditEditor: (relativePath: string) =>
      runAction(async () => {
        const record = await loadBuildFileIpc(relativePath);
        const idx = relativePath.lastIndexOf("/");
        setEditorMode({ kind: "edit", targetPath: relativePath, targetFolder: idx === -1 ? "" : relativePath.slice(0, idx), record });
      }),
    bootstrapInitialLibraryBuild,
    activateBuild: (relativePath: string) => runAction(() => applyActivatedRecord(relativePath, false)),
    saveFromEditor,
    handleDuplicateBuild: (entry: BuildLibraryEntrySummary, copyLabel: string) =>
      runAction(async () => { await duplicateBuildEntry(entry, copyLabel); await refreshListing(); }),
    handleMoveBuild: (relativePath: string, targetFolder: string) =>
      runAction(async () => {
        const movedPath = await moveBuildEntry(relativePath, targetFolder);
        if (relativePath === activeBuildPathRef.current) activeBuildPathRef.current = movedPath;
        await refreshListing();
      }),
    handleDeleteBuild: (relativePath: string) =>
      runAction(() =>
        deleteBuildEntry({
          relativePath,
          activeBuildPath: activeBuildPathRef.current,
          clearActiveBuildRef: () => { activeBuildPathRef.current = null; },
          ensureValidActive,
          refreshListing,
        }),
      ),
    handleCreateFolder: (parentFolder: string, folderName: string) =>
      runAction(async () => { await createFolderEntry(parentFolder, folderName); await refreshListing(); }),
    handleRenameFolder: (oldFolder: string, newName: string) =>
      runAction(async () => {
        await renameFolderEntry({ oldFolder, newName, currentFolder, setCurrentFolder });
        await refreshListing();
      }),
    handleDeleteFolder: (folderPath: string, recursive: boolean) =>
      runAction(() =>
        deleteFolderEntry({
          folderPath,
          recursive,
          activeBuildPath: activeBuildPathRef.current,
          currentFolder,
          clearActiveBuildRef: () => { activeBuildPathRef.current = null; },
          setCurrentFolder,
          ensureValidActive,
          refreshListing,
        }),
      ),
    openBuildsFolder: openBuildsLibraryFolderIpc,
    updateActiveListingSummary,
    persistCharacterLink,
    inspectBuild: (rawPobInput: string, cachedXml?: string | null, previousSelection?: PobSetSelection | null) =>
      inspectPobBuildSets({ rawPobInput, cachedXml, previousSelection }),
  };
}
