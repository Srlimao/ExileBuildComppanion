import { useHudI18n } from "@exile-hud/hud-ui";
import {
  ArrowUp,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import {
  getFolderBreadcrumbs,
  getParentFolderPath,
  type BuildLibraryEntrySummary,
  type BuildSortKey,
} from "./build_library_types.js";

interface BuildLibraryNavigationBarProps {
  activeEntry: BuildLibraryEntrySummary | null;
  currentFolder: string;
  searchQuery: string;
  sortKey: BuildSortKey;
  canOpenNativeFolder: boolean;
  busy: boolean;
  onEditActive: (relativePath: string) => Promise<void>;
  onOpenCreateEditor: () => void;
  onCreateFolder: (parentFolder: string, folderName: string) => Promise<void>;
  onOpenLibraryFolder: () => Promise<string | null>;
  onChangeFolder: (folderPath: string) => void;
  onChangeSearch: (query: string) => void;
  onChangeSort: (key: BuildSortKey) => void;
}

export function BuildLibraryNavigationBar({
  activeEntry,
  currentFolder,
  searchQuery,
  sortKey,
  canOpenNativeFolder,
  busy,
  onEditActive,
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
    <>
      {activeEntry && (
        <div className="rounded-md bg-hud-subtle/70 border border-hud-hairline px-2.5 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.1em] text-hud-accent font-semibold">
              {appMsg.desktop.activeBuildPillLabel}
            </div>
            <div className="text-xs font-semibold text-hud-text truncate">{activeEntry.name}</div>
            <div className="text-[10px] text-hud-muted truncate">
              {activeEntry.summary.ascendancyName || activeEntry.summary.characterClass}
              {activeEntry.characterName ? ` · ${activeEntry.characterName}` : ""}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEditActive(activeEntry.relativePath)}
            className="shrink-0 rounded-md bg-hud-bg/70 hover:bg-hud-bg px-2.5 py-1 text-[11px] font-medium text-hud-text inline-flex items-center gap-1 cursor-pointer"
          >
            <Pencil className="h-3 w-3 text-hud-accent" />
            {appMsg.desktop.editActiveBuild}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.desktop.buildLibraryTitle}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={onOpenCreateEditor}
            className="rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {appMsg.desktop.newBuildBtn}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreatingFolder((v) => !v)}
            className="rounded-md bg-hud-subtle hover:bg-hud-hairline/50 px-2.5 py-1 text-[11px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-hud-accent" />
            {appMsg.desktop.newFolderBtn}
          </button>
          {canOpenNativeFolder && (
            <button
              type="button"
              onClick={() => void onOpenLibraryFolder()}
              title={appMsg.desktop.openBuildsFolderBtn}
              className="rounded-md hover:bg-hud-subtle px-2 py-1 text-[11px] text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-hud-accent" />
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
            className="flex-1 min-w-0 rounded-md bg-hud-subtle border-b border-hud-accent px-2.5 py-1.5 text-xs text-hud-text focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !newFolderName.trim()}
            onClick={() => void submitNewFolder()}
            className="rounded-md bg-hud-accent text-hud-accent-fg disabled:opacity-45 px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer"
          >
            {appMsg.desktop.createBtn}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName("");
            }}
            className="rounded-md px-2 py-1.5 text-[11px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 text-[11px] text-hud-muted overflow-x-auto pb-0.5">
        {currentFolder && (
          <button
            type="button"
            onClick={() => onChangeFolder(getParentFolderPath(currentFolder))}
            title={appMsg.desktop.goUpFolderTitle}
            className="p-1 rounded hover:bg-hud-subtle text-hud-text cursor-pointer shrink-0"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onChangeFolder("")}
          className={`px-1.5 py-0.5 rounded cursor-pointer shrink-0 ${
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
              className={`px-1.5 py-0.5 rounded cursor-pointer ${
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

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 text-hud-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={appMsg.desktop.searchBuildsPlaceholder}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline pl-8 pr-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => onChangeSort(e.target.value as BuildSortKey)}
          aria-label={appMsg.desktop.sortLabel}
          className="rounded-md bg-hud-subtle border-b border-hud-hairline px-2 py-1.5 text-[11px] text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
        >
          {(["updated", "name", "class", "level"] as BuildSortKey[]).map((key) => (
            <option key={key} value={key} className="bg-hud-surface text-hud-text">
              {appMsg.desktop.sortOptions[key]}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
