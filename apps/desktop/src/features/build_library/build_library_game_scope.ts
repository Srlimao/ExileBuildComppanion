import { createEmptyCampaignProgress, type HudSessionSnapshot, type SupportedGameId } from "@exile-hud/core";
import type { MutableRefObject } from "react";
import { DEFAULT_STARTER_POB_XML } from "../host_coordinator/desktop_telemetry_bridge.js";
import {
  createFolderEntry,
  deleteBuildEntry,
  deleteFolderEntry,
  duplicateBuildEntry,
  moveBuildEntry,
  renameFolderEntry,
} from "./build_library_crud_actions.js";
import {
  buildSummaryFromSnapshot,
  createEmptyBuildProgressSummary,
  createNewBuildId,
  type BuildLibraryEntrySummary,
  type BuildLibraryListing,
  type SavedBuildFileRecord,
} from "./build_library_types.js";

export const DEFAULT_STARTER_POE2_POB_XML = `<PathOfBuilding2>
  <Build className="Monk" ascendClassName="Invoker" bandit="None" level="1" buildName="PoE 2 Starter Invoker"/>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="Campaign Starter (Lv 1-45)">
      <Skill enabled="true" label="Ice Strike Clear">
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemIceStrike" nameSpec="Ice Strike" level="1" quality="0"/>
        <Gem enabled="true" gemId="Metadata/Items/Gems/SupportGemMartialTempo" nameSpec="Rapid Attacks I" level="1" quality="0"/>
      </Skill>
      <Skill enabled="true" label="Tempest Bell Boss">
        <Gem enabled="true" gemId="Metadata/Items/Gem/SkillGemTempestBell" nameSpec="Tempest Bell" level="1" quality="0"/>
      </Skill>
      <Skill enabled="true" label="Herald of Ice (Spirit)">
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemHeraldOfIce" nameSpec="Herald of Ice" level="1" quality="0"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec id="1" title="Act 1-4 Campaign" treeVersion="poe2_0_5" nodes="44683,10364,42857,20024,44223,7576,33866,52980,18970"><WeaponSet1 nodes="20024,44223"/><WeaponSet2 nodes="7576,33866"/></Spec></Tree>
</PathOfBuilding2>`;

/** Creates the initial starter build record scoped to PoE 1 or PoE 2. */
export function createStarterBuildRecordForGame(
  gameId: SupportedGameId,
  nowMs: number,
): SavedBuildFileRecord {
  const isPoe2 = gameId === "poe2";
  const starterXml = isPoe2 ? DEFAULT_STARTER_POE2_POB_XML : DEFAULT_STARTER_POB_XML;
  return {
    schemaVersion: 1,
    gameId,
    id: createNewBuildId(),
    name: isPoe2 ? "PoE 2 Starter Invoker" : "Starter RF Elementalist",
    notes: "",
    rawInput: starterXml,
    cachedXml: starterXml,
    leagueStart: true,
    customRouteText: "",
    selection: null,
    characterName: "",
    selectedLeague: "",
    summary: createEmptyBuildProgressSummary(),
    progress: createEmptyCampaignProgress(nowMs),
    runElapsedMs: 0,
    actSplitsMs: {},
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

/** Updates the active build entry's progress summary in React listing state. */
export function applySnapshotSummaryToListing(
  prev: BuildLibraryListing | null,
  activePath: string,
  snapshot: HudSessionSnapshot,
): BuildLibraryListing | null {
  if (!prev) return prev;
  const summary = buildSummaryFromSnapshot(snapshot);
  return {
    ...prev,
    builds: prev.builds.map((b) =>
      b.relativePath === activePath
        ? {
            ...b,
            summary,
            characterName: snapshot.characterName || b.characterName,
            runElapsedMs: snapshot.runElapsedMs,
            updatedAtMs: Date.now(),
          }
        : b,
    ),
  };
}

/** Updates the active build entry's linked character/league in React listing state. */
export function applyCharacterLinkToListing(
  prev: BuildLibraryListing | null,
  activePath: string,
  characterName: string,
  selectedLeague?: string,
): BuildLibraryListing | null {
  if (!prev) return prev;
  return {
    ...prev,
    builds: prev.builds.map((b) =>
      b.relativePath === activePath
        ? { ...b, characterName, ...(selectedLeague !== undefined ? { selectedLeague } : {}) }
        : b,
    ),
  };
}

interface BuildLibraryCrudHandlerDeps {
  gameIdRef: MutableRefObject<SupportedGameId>;
  activeBuildPathRef: MutableRefObject<string | null>;
  currentFolder: string;
  setCurrentFolder: (folder: string) => void;
  runAction: (fn: () => Promise<void>) => Promise<void>;
  ensureValidActive: (nextActive: string | null, targetGameId?: SupportedGameId) => Promise<void>;
  refreshListing: (targetGameId?: SupportedGameId) => Promise<BuildLibraryListing>;
}

/** Creates game-scoped CRUD callbacks bound to the active build library session. */
export function createBuildLibraryCrudHandlers(deps: BuildLibraryCrudHandlerDeps) {
  const {
    gameIdRef, activeBuildPathRef, currentFolder, setCurrentFolder,
    runAction, ensureValidActive, refreshListing,
  } = deps;
  return {
    handleDuplicateBuild: (entry: BuildLibraryEntrySummary, copyLabel: string) => {
      const targetGame = gameIdRef.current;
      return runAction(async () => {
        await duplicateBuildEntry(entry, copyLabel, targetGame);
        await refreshListing(targetGame);
      });
    },
    handleMoveBuild: (relativePath: string, targetFolder: string) => {
      const targetGame = gameIdRef.current;
      return runAction(async () => {
        const movedPath = await moveBuildEntry(relativePath, targetFolder, targetGame);
        if (relativePath === activeBuildPathRef.current) activeBuildPathRef.current = movedPath;
        await refreshListing(targetGame);
      });
    },
    handleDeleteBuild: (relativePath: string) => {
      const targetGame = gameIdRef.current;
      return runAction(() =>
        deleteBuildEntry({
          relativePath,
          gameId: targetGame,
          activeBuildPath: activeBuildPathRef.current,
          clearActiveBuildRef: () => { activeBuildPathRef.current = null; },
          ensureValidActive: (nextActive) => ensureValidActive(nextActive, targetGame),
          refreshListing: () => refreshListing(targetGame),
        }),
      );
    },
    handleCreateFolder: (parentFolder: string, folderName: string) => {
      const targetGame = gameIdRef.current;
      return runAction(async () => {
        await createFolderEntry(parentFolder, folderName, targetGame);
        await refreshListing(targetGame);
      });
    },
    handleRenameFolder: (oldFolder: string, newName: string) => {
      const targetGame = gameIdRef.current;
      return runAction(async () => {
        await renameFolderEntry({ oldFolder, newName, gameId: targetGame, currentFolder, setCurrentFolder });
        await refreshListing(targetGame);
      });
    },
    handleDeleteFolder: (folderPath: string, recursive: boolean) => {
      const targetGame = gameIdRef.current;
      return runAction(() =>
        deleteFolderEntry({
          folderPath,
          recursive,
          gameId: targetGame,
          activeBuildPath: activeBuildPathRef.current,
          currentFolder,
          clearActiveBuildRef: () => { activeBuildPathRef.current = null; },
          setCurrentFolder,
          ensureValidActive: (nextActive) => ensureValidActive(nextActive, targetGame),
          refreshListing: () => refreshListing(targetGame),
        }),
      );
    },
  };
}
