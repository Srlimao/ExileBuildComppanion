import type { HudSessionSnapshot, PobBuildPreview, PobSetSelection, SupportedGameId } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { useState } from "react";
import { ActiveBuildRunCard } from "./active_build_run_card.js";
import {
  BuildLibraryEditorPanel,
  type BuildEditorSubmitPayload,
} from "./build_library_editor_panel.js";
import { BuildLibraryFolderRow } from "./build_library_folder_row.js";
import { BuildLibraryNavigationBar } from "./build_library_navigation_bar.js";
import { BuildLibraryRowItem } from "./build_library_row_item.js";
import {
  countBuildsInFolder,
  filterAndSortBuilds,
  getChildFolders,
  type BuildEditorMode,
  type BuildLibraryEntrySummary,
  type BuildLibraryListing,
  type BuildSortKey,
} from "./build_library_types.js";

interface BuildLibraryManagerViewProps {
  activeGameId?: SupportedGameId;
  listing: BuildLibraryListing | null;
  snapshot: HudSessionSnapshot | null;
  currentFolder: string;
  editorMode: BuildEditorMode;
  busy: boolean;
  error: string | null;
  onChangeFolder: (folderPath: string) => void;
  onOpenCreateEditor: () => void;
  onOpenEditEditor: (relativePath: string) => Promise<void>;
  onCloseEditor: () => void;
  onInspectBuild: (
    rawPobInput: string,
    cachedXml?: string | null,
    previousSelection?: PobSetSelection | null,
  ) => Promise<{ decodedXml: string; preview: PobBuildPreview; selection: PobSetSelection }>;
  onSaveFromEditor: (payload: BuildEditorSubmitPayload) => Promise<void>;
  onActivateBuild: (relativePath: string) => Promise<void>;
  onDuplicateBuild: (entry: BuildLibraryEntrySummary) => Promise<void>;
  onMoveBuild: (relativePath: string, targetFolder: string) => Promise<void>;
  onDeleteBuild: (relativePath: string) => Promise<void>;
  onCreateFolder: (parentFolder: string, folderName: string) => Promise<void>;
  onRenameFolder: (folderPath: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderPath: string, recursive: boolean) => Promise<void>;
  onOpenLibraryFolder: () => Promise<string | null>;
  onOpenFindBuild?: () => void;
  onResetProgress: () => void;
}

/** Builds tab view: unified Active Run card, folder/search toolbar, and minimalist build rows. */
export function BuildLibraryManagerView(props: BuildLibraryManagerViewProps) {
  const { appMsg } = useHudI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<BuildSortKey>("updated");

  if (props.editorMode.kind !== "closed") {
    return (
      <BuildLibraryEditorPanel
        activeGameId={props.activeGameId}
        mode={props.editorMode}
        allFolders={props.listing?.folders ?? []}
        activeBuildPath={props.listing?.activeBuildPath ?? null}
        busy={props.busy}
        error={props.error}
        onInspectBuild={props.onInspectBuild}
        onSave={props.onSaveFromEditor}
        onCancel={props.onCloseEditor}
        onOpenFindBuild={props.onOpenFindBuild}
      />
    );
  }

  const allFolders = props.listing?.folders ?? [];
  const allBuilds = props.listing?.builds ?? [];
  const activePath = props.listing?.activeBuildPath ?? null;
  const activeEntry = allBuilds.find((b) => b.relativePath === activePath) ?? null;
  const searching = searchQuery.trim().length > 0;
  const childFolders = searching ? [] : getChildFolders(allFolders, props.currentFolder);
  const visibleBuilds = filterAndSortBuilds(allBuilds, props.currentFolder, searchQuery, sortKey);
  const canOpenNativeFolder =
    Boolean(props.listing?.rootDir) && !props.listing!.rootDir.startsWith("Browser ");

  return (
    <div className="space-y-3.5">
      <ActiveBuildRunCard
        activeEntry={activeEntry}
        snapshot={props.snapshot}
        busy={props.busy}
        onEditActive={props.onOpenEditEditor}
        onResetProgress={props.onResetProgress}
      />

      <BuildLibraryNavigationBar
        currentFolder={props.currentFolder}
        searchQuery={searchQuery}
        sortKey={sortKey}
        rootDir={props.listing?.rootDir}
        canOpenNativeFolder={canOpenNativeFolder}
        busy={props.busy}
        onOpenCreateEditor={props.onOpenCreateEditor}
        onCreateFolder={props.onCreateFolder}
        onOpenLibraryFolder={props.onOpenLibraryFolder}
        onChangeFolder={props.onChangeFolder}
        onChangeSearch={setSearchQuery}
        onChangeSort={setSortKey}
      />

      {props.error && (
        <p className="border-l-2 border-hud-danger pl-2.5 py-0.5 text-[11px] text-hud-danger">
          {props.error}
        </p>
      )}

      <div className="space-y-1.5">
        {childFolders.map((folder) => (
          <BuildLibraryFolderRow
            key={folder}
            folderPath={folder}
            buildCount={countBuildsInFolder(allBuilds, folder)}
            busy={props.busy}
            onOpen={props.onChangeFolder}
            onRename={props.onRenameFolder}
            onDelete={props.onDeleteFolder}
          />
        ))}

        {visibleBuilds.map((entry) => (
          <BuildLibraryRowItem
            key={entry.relativePath}
            entry={entry}
            isActive={entry.relativePath === activePath}
            showFolderBadge={searching}
            allFolders={allFolders}
            busy={props.busy}
            onActivate={props.onActivateBuild}
            onEdit={props.onOpenEditEditor}
            onDuplicate={props.onDuplicateBuild}
            onMove={props.onMoveBuild}
            onDelete={props.onDeleteBuild}
          />
        ))}

        {childFolders.length === 0 && visibleBuilds.length === 0 && (
          <div className="rounded-xl bg-hud-subtle/30 border border-hud-hairline/50 px-3 py-6 text-center text-xs text-hud-muted">
            {searching ? appMsg.desktop.emptySearchMsg : appMsg.desktop.emptyFolderMsg}
          </div>
        )}
      </div>
    </div>
  );
}
