import { useHudI18n } from "@exile-hud/hud-ui";
import { Check, Folder, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

interface BuildLibraryFolderRowProps {
  folderPath: string;
  buildCount: number;
  busy: boolean;
  onOpen: (folderPath: string) => void;
  onRename: (folderPath: string, newName: string) => Promise<void>;
  onDelete: (folderPath: string, recursive: boolean) => Promise<void>;
}

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
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folderName);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    <div className="rounded-md bg-hud-subtle/50 hover:bg-hud-subtle/80 px-2.5 py-1.5 flex items-center justify-between gap-2 transition-colors">
      {renaming ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
            className="flex-1 min-w-0 rounded bg-hud-bg border border-hud-accent/60 px-2 py-0.5 text-xs text-hud-text focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitRename()}
            className="p-1 rounded text-hud-ok hover:bg-hud-bg cursor-pointer"
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
            className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-bg cursor-pointer"
            title={appMsg.desktop.cancel}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
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

          {confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(false);
                  void onDelete(folderPath, buildCount > 0);
                }}
                className="rounded bg-hud-danger px-2 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
              >
                {appMsg.desktop.deleteFolderNonEmptyWarn(buildCount)}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded px-1.5 py-0.5 text-[10px] text-hud-muted hover:text-hud-text cursor-pointer"
              >
                {appMsg.desktop.cancel}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraftName(folderName);
                  setRenaming(true);
                  setConfirmDelete(false);
                }}
                title={appMsg.desktop.renameBtn}
                className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-bg/60 cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                title={appMsg.desktop.deleteBuildBtn}
                className="p-1 rounded text-hud-muted hover:text-hud-danger hover:bg-hud-bg/60 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
