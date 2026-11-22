import { useHudI18n } from "@exile-hud/hud-ui";
import { Check, Folder, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface BuildLibraryFolderRowProps {
  folderPath: string;
  buildCount: number;
  busy: boolean;
  onOpen: (folderPath: string) => void;
  onRename: (folderPath: string, newName: string) => Promise<void>;
  onDelete: (folderPath: string, recursive: boolean) => Promise<void>;
}

/** Compact folder card with overflow menu for rename and delete actions. */
export function BuildLibraryFolderRow({
  folderPath,
  buildCount,
  busy,
  onOpen,
  onRename,
  onDelete,
}: BuildLibraryFolderRowProps) {
  const { appMsg } = useHudI18n();
  const folderName = folderPath.split("/").pop() ?? folderPath;
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folderName);
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

  const submitRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === folderName) {
      setRenaming(false);
      setDraftName(folderName);
      return;
    }
    await onRename(folderPath, trimmed);
    setRenaming(false);
  };

  return (
    <div className="relative rounded-xl bg-hud-subtle/45 hover:bg-hud-subtle/75 border border-transparent px-3 py-2 space-y-2 transition-colors">
      {renaming ? (
        <div className="flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 text-hud-accent shrink-0" />
          <input
            type="text"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitRename();
              } else if (e.key === "Escape") {
                setRenaming(false);
                setDraftName(folderName);
              }
            }}
            className="flex-1 min-w-0 rounded-lg bg-hud-bg border border-hud-accent/60 px-2 py-1 text-xs text-hud-text focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitRename()}
            className="p-1 rounded-lg text-hud-ok hover:bg-hud-bg cursor-pointer"
            title={appMsg.desktop.renameBtn}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setDraftName(folderName);
            }}
            className="p-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-bg cursor-pointer"
            title={appMsg.desktop.cancel}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(folderPath)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
          >
            <Folder className="h-3.5 w-3.5 text-hud-accent shrink-0" />
            <span className="text-xs font-medium text-hud-text truncate">{folderName}</span>
            <span className="text-[10px] font-mono text-hud-muted shrink-0">
              {appMsg.desktop.folderBuildsCount(buildCount)}
            </span>
          </button>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              disabled={busy}
              aria-expanded={menuOpen}
              aria-label={appMsg.desktop.moreActionsTitle}
              title={appMsg.desktop.moreActionsTitle}
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-hud-surface border border-hud-hairline p-1 shadow-2xl text-xs space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraftName(folderName);
                    setRenaming(true);
                    setConfirmDelete(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-hud-subtle text-hud-text flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="h-3 w-3 text-hud-muted" />
                  {appMsg.desktop.renameBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
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
      )}

      {confirmDelete && (
        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-hud-hairline/70">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmDelete(false);
              void onDelete(folderPath, buildCount > 0);
            }}
            className="rounded-lg bg-hud-danger px-2.5 py-1 text-[10px] font-semibold text-white cursor-pointer"
          >
            {appMsg.desktop.deleteFolderNonEmptyWarn(buildCount)}
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
