import { useHudI18n } from "@exile-hud/hud-ui";
import { ArrowUp, ChevronRight, FolderOpen, FolderPlus, Plus, Search } from "lucide-react";
import { useState } from "react";
import {
  getFolderBreadcrumbs,
  getParentFolderPath,
  type BuildSortKey,
} from "./build_library_types.js";

interface BuildLibraryNavigationBarProps {
  currentFolder: string;
  searchQuery: string;
  sortKey: BuildSortKey;
  rootDir?: string;
  canOpenNativeFolder: boolean;
  busy: boolean;
  onOpenCreateEditor: () => void;
  onCreateFolder: (parentFolder: string, folderName: string) => Promise<void>;
  onOpenLibraryFolder: () => Promise<string | null>;
  onChangeFolder: (folderPath: string) => void;
  onChangeSearch: (query: string) => void;
  onChangeSort: (key: BuildSortKey) => void;
}

/** Compact search, sort, new-build action, and folder breadcrumb bar for the Build Library. */
export function BuildLibraryNavigationBar({
  currentFolder,
  searchQuery,
  sortKey,
  rootDir,
  canOpenNativeFolder,
  busy,
  onOpenCreateEditor,
  onCreateFolder,
  onOpenLibraryFolder,
  onChangeFolder,
  onChangeSearch,
  onChangeSort,
}: BuildLibraryNavigationBarProps) {
  const { appMsg } = useHudI18n();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const breadcrumbs = getFolderBreadcrumbs(currentFolder);

  const submitNewFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await onCreateFolder(currentFolder, trimmed);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 text-hud-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={appMsg.desktop.searchBuildsPlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline pl-8 pr-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => onChangeSort(e.target.value as BuildSortKey)}
          aria-label={appMsg.desktop.sortLabel}
          className="rounded-lg bg-hud-subtle border border-hud-hairline px-2 py-1.5 text-[11px] text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer shrink-0"
        >
          {(["updated", "name", "class", "level"] as BuildSortKey[]).map((key) => (
            <option key={key} value={key} className="bg-hud-surface text-hud-text">
              {appMsg.desktop.sortOptions[key]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={onOpenCreateEditor}
          className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-45 px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {appMsg.desktop.newBuildBtn}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-hud-muted overflow-x-auto min-w-0">
          {currentFolder && (
            <button
              type="button"
              onClick={() => onChangeFolder(getParentFolderPath(currentFolder))}
              title={appMsg.desktop.goUpFolderTitle}
              className="p-1 rounded-md hover:bg-hud-subtle text-hud-text cursor-pointer shrink-0"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChangeFolder("")}
            className={`px-1.5 py-0.5 rounded-md cursor-pointer shrink-0 ${
              currentFolder === "" ? "text-hud-text font-semibold bg-hud-subtle" : "hover:text-hud-text"
            }`}
          >
            {appMsg.desktop.buildsRootCrumb}
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.path} className="inline-flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3 w-3 opacity-60" />
              <button
                type="button"
                onClick={() => onChangeFolder(crumb.path)}
                className={`px-1.5 py-0.5 rounded-md cursor-pointer ${
                  idx === breadcrumbs.length - 1
                    ? "text-hud-text font-semibold bg-hud-subtle"
                    : "hover:text-hud-text"
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreatingFolder((v) => !v)}
            title={appMsg.desktop.newFolderBtn}
            aria-label={appMsg.desktop.newFolderBtn}
            className={`p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer ${
              creatingFolder ? "bg-hud-subtle text-hud-accent" : ""
            }`}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          {canOpenNativeFolder && (
            <button
              type="button"
              onClick={() => void onOpenLibraryFolder()}
              title={
                rootDir
                  ? `${appMsg.desktop.openBuildsFolderBtn} (${rootDir})`
                  : appMsg.desktop.openBuildsFolderBtn
              }
              aria-label={appMsg.desktop.openBuildsFolderBtn}
              className="p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {creatingFolder && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitNewFolder();
              } else if (e.key === "Escape") {
                setCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            placeholder={appMsg.desktop.newFolderPlaceholder}
            className="flex-1 min-w-0 rounded-lg bg-hud-subtle border border-hud-accent px-2.5 py-1.5 text-xs text-hud-text focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !newFolderName.trim()}
            onClick={() => void submitNewFolder()}
            className="rounded-lg bg-hud-accent text-hud-accent-fg disabled:opacity-45 px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer"
          >
            {appMsg.desktop.createBtn}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName("");
            }}
            className="rounded-lg px-2 py-1.5 text-[11px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
