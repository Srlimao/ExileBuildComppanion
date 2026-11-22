import { formatRunTimerClock, useHudI18n } from "@exile-hud/hud-ui";
import { Copy, FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** Minimalist 2-line build card with click-to-load primary action and overflow menu for secondary ops. */
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [targetFolder, setTargetFolder] = useState(entry.folderPath);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const classLabel = entry.summary.ascendancyName || entry.summary.characterClass || "PoB";
  const hasSteps = entry.summary.totalCheckpoints > 0;

  return (
    <div
      className={`relative rounded-xl px-3 py-2.5 border transition-colors space-y-2 ${
        isActive
          ? "bg-hud-surface border-hud-accent/45"
          : "bg-hud-subtle/40 hover:bg-hud-subtle/75 border-transparent"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={busy}
          title={entry.notes || undefined}
          onClick={() => {
            if (!isActive) void onActivate(entry.relativePath);
          }}
          className={`min-w-0 flex-1 text-left ${isActive ? "cursor-default" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-hud-text truncate">{entry.name}</span>
            {!entry.leagueStart && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-hud-warn/15 text-hud-warn shrink-0">
                {appMsg.desktop.twinkBadge}
              </span>
            )}
            {showFolderBadge && entry.folderPath && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-hud-bg/70 text-hud-muted truncate max-w-[100px]">
                {entry.folderPath}
              </span>
            )}
          </div>

          <div className="text-[11px] text-hud-muted mt-0.5 truncate flex items-center gap-1">
            <span className="truncate">
              {classLabel}
              {entry.characterName ? ` · ${entry.characterName}` : ""}
              {` · Act ${entry.summary.currentAct || 1}`}
            </span>
            {hasSteps && (
              <span className="font-mono text-[10px] shrink-0">
                · {entry.summary.completedCheckpoints}/{entry.summary.totalCheckpoints}
              </span>
            )}
            {entry.runElapsedMs > 0 && (
              <span className="font-mono text-[10px] text-hud-ok shrink-0">
                · {formatRunTimerClock(entry.runElapsedMs)}
              </span>
            )}
          </div>
        </button>

        <div ref={menuRef} className="relative flex items-center gap-1 shrink-0">
          {isActive ? (
            <span className="text-[10px] font-mono font-semibold text-hud-ok px-1.5">
              {appMsg.desktop.activeBadge}
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onActivate(entry.relativePath)}
              className="px-2 py-1 rounded-lg bg-hud-surface border border-hud-hairline hover:border-hud-accent/50 text-[11px] font-medium text-hud-text cursor-pointer transition-colors"
            >
              {appMsg.desktop.openBuildBtn}
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            aria-expanded={menuOpen}
            aria-label={appMsg.desktop.moreActionsTitle}
            title={appMsg.desktop.moreActionsTitle}
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-hud-surface border border-hud-hairline p-1 shadow-2xl text-xs space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void onEdit(entry.relativePath);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-hud-subtle text-hud-text flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="h-3 w-3 text-hud-muted" />
                {appMsg.desktop.editBuildBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void onDuplicate(entry);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-hud-subtle text-hud-text flex items-center gap-2 cursor-pointer"
              >
                <Copy className="h-3 w-3 text-hud-muted" />
                {appMsg.desktop.duplicateBuildBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setTargetFolder(entry.folderPath);
                  setMoving((v) => !v);
                  setConfirmDelete(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-hud-subtle text-hud-text flex items-center gap-2 cursor-pointer"
              >
                <FolderInput className="h-3 w-3 text-hud-muted" />
                {appMsg.desktop.moveBuildBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete((v) => !v);
                  setMoving(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-hud-subtle text-hud-danger flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                {appMsg.desktop.deleteBuildBtn}
              </button>
            </div>
          )}
        </div>
      </div>

      {moving && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-hud-hairline/70">
          <select
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
            className="flex-1 min-w-0 rounded-lg bg-hud-bg border border-hud-hairline px-2 py-1 text-[11px] text-hud-text focus:outline-none focus:border-hud-accent"
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
            className="rounded-lg bg-hud-accent text-hud-accent-fg disabled:opacity-45 px-2.5 py-1 text-[10px] font-semibold cursor-pointer"
          >
            {appMsg.desktop.moveHereBtn}
          </button>
          <button
            type="button"
            onClick={() => setMoving(false)}
            className="rounded-lg px-2 py-1 text-[10px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-hud-hairline/70">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmDelete(false);
              void onDelete(entry.relativePath);
            }}
            className="rounded-lg bg-hud-danger px-2.5 py-1 text-[10px] font-semibold text-white cursor-pointer"
          >
            {appMsg.desktop.deleteBuildBtn}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg px-2 py-1 text-[10px] text-hud-muted hover:text-hud-text cursor-pointer"
          >
            {appMsg.desktop.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
