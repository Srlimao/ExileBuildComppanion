import { poe1LeagueStarterFilterMeta } from "@exile-hud/game-data";
import { useHudI18n } from "@exile-hud/hud-ui";
import { CheckCircle2, Filter, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getLootFilterStatusIpc,
  installLeagueStarterFilterIpc,
  openLootFilterFolderIpc,
  type LootFilterDirectoryStatus,
  type LootFilterSelection,
} from "./loot_filter_types_and_ipc.js";

/** Renders the 1-click baked per-league NeverSink starter loot filter installer card. */
export function LeagueStarterFilterCard() {
  const { appMsg } = useHudI18n();
  const [selection, setSelection] = useState<LootFilterSelection>(
    poe1LeagueStarterFilterMeta.defaultPresetId,
  );
  const [status, setStatus] = useState<LootFilterDirectoryStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installedFiles, setInstalledFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getLootFilterStatusIpc()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const installedIds = status?.installedPresetIds ?? [];
  const hasAnyInstalled = installedIds.length > 0;
  const selectedAlreadyInstalled =
    selection === "both"
      ? installedIds.includes("regular") && installedIds.includes("semi_strict")
      : installedIds.includes(selection);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      const result = await installLeagueStarterFilterIpc(selection);
      setStatus(result.status);
      setInstalledFiles(result.installedFileNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenFolder = async () => {
    setError(null);
    try {
      await openLootFilterFolderIpc();
      const refreshed = await getLootFilterStatusIpc();
      setStatus(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const presetOptions: { id: LootFilterSelection; label: string; installed: boolean }[] = [
    {
      id: "regular",
      label: appMsg.desktop.lootFilterPresetRegular,
      installed: installedIds.includes("regular"),
    },
    {
      id: "semi_strict",
      label: appMsg.desktop.lootFilterPresetSemiStrict,
      installed: installedIds.includes("semi_strict"),
    },
    {
      id: "both",
      label: appMsg.desktop.lootFilterPresetBoth,
      installed: installedIds.includes("regular") && installedIds.includes("semi_strict"),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
            {appMsg.desktop.lootFilterCardTitle}
          </h2>
          <p className="text-[11px] font-mono text-hud-muted mt-0.5 truncate">
            {appMsg.desktop.lootFilterLeagueBadge(
              poe1LeagueStarterFilterMeta.leagueName,
              poe1LeagueStarterFilterMeta.version,
            )}
          </p>
        </div>
        <span
          className={`text-[11px] font-mono shrink-0 ${
            hasAnyInstalled ? "text-hud-ok" : "text-hud-muted"
          }`}
        >
          {hasAnyInstalled
            ? appMsg.desktop.lootFilterInstalledBadge
            : appMsg.desktop.lootFilterNotInstalledBadge}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {presetOptions.map((opt) => {
          const active = selection === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelection(opt.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                active
                  ? "bg-hud-subtle text-hud-text font-semibold ring-1 ring-hud-accent/60"
                  : "bg-hud-subtle/60 text-hud-muted hover:text-hud-text"
              }`}
            >
              {opt.installed && <CheckCircle2 className="h-3 w-3 text-hud-ok shrink-0" />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={installing}
          onClick={() => void handleInstall()}
          className="rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {selectedAlreadyInstalled ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Filter className="h-3.5 w-3.5" />
          )}
          {installing
            ? appMsg.desktop.lootFilterInstalling
            : selectedAlreadyInstalled
              ? appMsg.desktop.lootFilterReinstallBtn
              : appMsg.desktop.lootFilterInstallBtn}
        </button>

        {status?.filterDir && (
          <button
            type="button"
            onClick={() => void handleOpenFolder()}
            className="shrink-0 rounded-md hover:bg-hud-subtle px-2 py-1 text-[10px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="h-3 w-3 text-hud-accent" />
            {appMsg.desktop.lootFilterOpenFolder}
          </button>
        )}
      </div>

      {installedFiles && installedFiles.length > 0 && (
        <div className="border-l-2 border-hud-ok pl-2.5 py-0.5 text-[11px] space-y-0.5">
          <div className="font-mono text-hud-ok">
            {appMsg.desktop.lootFilterSuccessMsg(installedFiles.join(", "))}
          </div>
          <div className="text-hud-muted">{appMsg.desktop.lootFilterInGameHint}</div>
        </div>
      )}

      {error && (
        <p className="border-l-2 border-hud-danger pl-2.5 py-0.5 text-[11px] text-hud-danger">
          {error}
        </p>
      )}

      {status?.filterDir && (
        <div className="pt-1 text-[10px] text-hud-muted truncate" title={status.filterDir}>
          <span className="font-mono text-hud-text">{status.filterDir}</span>
        </div>
      )}
    </section>
  );
}
