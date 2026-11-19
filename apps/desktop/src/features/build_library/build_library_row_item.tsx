import { formatRunTimerClock, useHudI18n } from "@exile-hud/hud-ui";
import { Copy, FolderInput, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BuildLibraryEntrySummary } from "./build_library_types.js";

interface BuildLibraryRowItemProps {
  entry: BuildLibraryEntrySummary;
  isActive: boolean;
  showFolderBadge: boolean;
  allFolders: readonly string[];
  busy: boolean;
  onActivate: (relativePath: string) => Promise<void>;
  onEdit: (relativePath: string) => Promise<void>;
  onDuplicate: (entry: BuildLibraryEntrySummary) => Promise<void>;
  onMove: (relativePath: string, targetFolder: string) => Promise<void>;
  onDelete: (relativePath: string) => Promise<void>;
}

export function BuildLibraryRowItem({
  entry,
  isActive,
  showFolderBadge,
  allFolders,
  busy,
  onActivate,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
}: BuildLibraryRowItemProps) {
  const { appMsg } = useHudI18n();
  const [moving, setMoving] = useState(false);
  const [targetFolder, setTargetFolder] = useState(entry.folderPath);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const classLabel = entry.summary.ascendancyName || entry.summary.characterClass || "PoB";
  const levelLabel = entry.summary.buildLevel > 0 ? `Lv ${entry.summary.buildLevel}` : "";

  return (
    <div
      className={`rounded-md px-2.5 py-2 space-y-1.5 border-l-2 transition-colors ${
        isActive
          ? "border-hud-accent bg-hud-subtle/85"
          : "border-transparent bg-hud-subtle/35 hover:bg-hud-subtle/65"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!isActive) void onActivate(entry.relativePath);
          }}
          className={`min-w-0 flex-1 text-left ${isActive ? "cursor-default" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-hud-text truncate">{entry.name}</span>
            {isActive && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-hud-accent/15 text-hud-accent shrink-0">
                {appMsg.desktop.activeBadge}
              </span>
            )}
            {!entry.leagueStart && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-hud-warn/15 text-hud-warn shrink-0">
                {appMsg.desktop.twinkBadge}
              </span>
            )}
            {showFolderBadge && entry.folderPath && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-hud-bg/70 text-hud-muted truncate max-w-[110px]">
                {entry.folderPath}
              </span>
            )}
          </div>

          <div className="text-[11px] text-hud-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
            <span>
              {classLabel}
              {levelLabel ? ` · ${levelLabel}` : ""}
            </span>
            {entry.characterName && (
              <span className="font-mono text-hud-text/90">
                · {entry.characterName}
                {entry.selectedLeague ? ` (${entry.selectedLeague})` : ""}
              </span>
            )}
            {entry.summary.totalCheckpoints > 0 && (
              <span className="font-mono text-[10px]">
                ·{" "}
                {appMsg.desktop.stepsShort(
                  entry.summary.completedCheckpoints,
                  entry.summary.totalCheckpoints,
                  entry.summary.currentAct || 1,
                )}
              </span>
            )}
            {entry.runElapsedMs > 0 && (
              <span className="font-mono text-[10px] text-hud-ok">
                · {formatRunTimerClock(entry.runElapsedMs)}
              </span>
            )}
          </div>

          {entry.notes && (
            <p className="text-[10px] text-hud-muted truncate mt-0.5">{entry.notes}</p>
          )}
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          {!isActive && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onActivate(entry.relativePath)}
              title={appMsg.desktop.openBuildBtn}
              className="rounded px-1.5 py-1 text-[10px] font-semibold text-hud-accent hover:bg-hud-bg/70 inline-flex items-center gap-1 cursor-pointer"
            >
              <Play className="h-3 w-3" />
              {appMsg.desktop.openBuildBtn}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEdit(entry.relativePath)}
            title={appMsg.desktop.editBuildBtn}
            className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-bg/60 cursor-pointer"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDuplicate(entry)}
            title={appMsg.desktop.duplicateBuildBtn}
            className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-bg/60 cursor-pointer"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTargetFolder(entry.folderPath);
              setMoving((v) => !v);
              setConfirmDelete(false);
            }}
            title={appMsg.desktop.moveBuildBtn}
            className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-bg/60 cursor-pointer"
          >
            <FolderInput className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmDelete((v) => !v);
              setMoving(false);
            }}
            title={appMsg.desktop.deleteBuildBtn}
            className="p-1 rounded text-hud-muted hover:text-hud-danger hover:bg-hud-bg/60 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {moving && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-hud-hairline/70">
          <select
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
            className="flex-1 min-w-0 rounded bg-hud-bg border border-hud-hairline px-2 py-1 text-[11px] text-hud-text focus:outline-none focus:border-hud-accent"
          >
            <option value="">{appMsg.desktop.moveTargetRoot}</option>
            {allFolders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || targetFolder === entry.folderPath}
            onClick={() => {
              setMoving(false);
              void onMove(entry.relativePath, targetFolder);
            }}
            className="rounded bg-hud-accent text-hud-accent-fg disabled:opacity-45 px-2 py-1 text-[10px] font-semibold cursor-pointer"
          >
            {appMsg.desktop.moveHereBtn}
          </button>
          <button
            type="button"
            onClick={() => setMoving(false)}
            className="rounded px-1.5 py-1 text-[10px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-hud-hairline/70">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmDelete(false);
              void onDelete(entry.relativePath);
            }}
            className="rounded bg-hud-danger px-2.5 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
          >
            {appMsg.desktop.deleteBuildBtn}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded px-2 py-0.5 text-[10px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
