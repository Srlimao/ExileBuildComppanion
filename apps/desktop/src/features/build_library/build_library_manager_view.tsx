import type { PobBuildPreview, PobSetSelection } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { useState } from "react";
import { LeagueStarterFilterCard } from "../loot_filter/league_starter_filter_card.js";
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
  listing: BuildLibraryListing | null;
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
}

export function BuildLibraryManagerView(props: BuildLibraryManagerViewProps) {
  const { appMsg } = useHudI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<BuildSortKey>("updated");

  if (props.editorMode.kind !== "closed") {
    return (
      <BuildLibraryEditorPanel
        mode={props.editorMode}
        allFolders={props.listing?.folders ?? []}
        activeBuildPath={props.listing?.activeBuildPath ?? null}
        busy={props.busy}
        error={props.error}
        onInspectBuild={props.onInspectBuild}
        onSave={props.onSaveFromEditor}
        onCancel={props.onCloseEditor}
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
    <div className="space-y-4">
      <section className="space-y-2.5">
        <BuildLibraryNavigationBar
          activeEntry={activeEntry}
          currentFolder={props.currentFolder}
          searchQuery={searchQuery}
          sortKey={sortKey}
          canOpenNativeFolder={canOpenNativeFolder}
          busy={props.busy}
          onEditActive={props.onOpenEditEditor}
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

        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
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
            <div className="rounded-md bg-hud-subtle/25 px-3 py-5 text-center text-xs text-hud-muted">
              {searching ? appMsg.desktop.emptySearchMsg : appMsg.desktop.emptyFolderMsg}
            </div>
          )}
        </div>

        {props.listing?.rootDir && (
          <div className="pt-1 text-[10px] text-hud-muted truncate" title={props.listing.rootDir}>
            <span>{appMsg.desktop.buildsFolderFooter} </span>
            <span className="font-mono text-hud-text">{props.listing.rootDir}</span>
          </div>
        )}
      </section>

      <div className="border-t border-hud-hairline pt-4">
        <LeagueStarterFilterCard />
      </div>
    </div>
  );
}
