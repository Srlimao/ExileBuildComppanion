import { getLeagueStarterFilterMetaForGame, type SupportedGameId } from "@exile-hud/game-data";
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

/** Renders the 1-click baked NeverSink starter loot filter installer card for PoE 1 or PoE 2. */
export function LeagueStarterFilterCard({ gameId = "poe1" }: { gameId?: SupportedGameId }) {
  const { appMsg } = useHudI18n();
  const filterMeta = getLeagueStarterFilterMetaForGame(gameId);
  const [selection, setSelection] = useState<LootFilterSelection>(filterMeta.defaultPresetId);
  const [status, setStatus] = useState<LootFilterDirectoryStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installedFiles, setInstalledFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelection(filterMeta.defaultPresetId);
    setInstalledFiles(null);
    setError(null);
    void getLootFilterStatusIpc(gameId)
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [filterMeta.defaultPresetId, gameId]);

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
      const result = await installLeagueStarterFilterIpc(selection, gameId);
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
      await openLootFilterFolderIpc(gameId);
      const refreshed = await getLootFilterStatusIpc(gameId);
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

  const subtitle =
    gameId === "poe2"
      ? appMsg.poe2.lootFilterLeagueBadge(filterMeta.version)
      : appMsg.desktop.lootFilterLeagueBadge(filterMeta.leagueName, filterMeta.version);

  return (
    <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-hud-text truncate">
            {appMsg.desktop.lootFilterCardTitle}
          </h2>
          <p className="text-[11px] font-mono text-hud-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <span
          className={`text-[10px] font-mono shrink-0 ${
            hasAnyInstalled ? "text-hud-ok" : "text-hud-muted"
          }`}
        >
          {hasAnyInstalled
            ? appMsg.desktop.lootFilterInstalledBadge
            : appMsg.desktop.lootFilterNotInstalledBadge}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {presetOptions.map((opt) => {
          const active = selection === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelection(opt.id)}
              title={opt.label}
              className={`rounded-lg px-2 py-1.5 text-[11px] inline-flex items-center justify-center gap-1 cursor-pointer transition-colors border truncate ${
                active
                  ? "bg-hud-accent-soft text-hud-accent border-hud-accent/40 font-semibold"
                  : "bg-hud-subtle text-hud-muted hover:text-hud-text border-transparent"
              }`}
            >
              {opt.installed && <CheckCircle2 className="h-3 w-3 text-hud-ok shrink-0" />}
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={installing}
          onClick={() => void handleInstall()}
          className="flex-1 rounded-xl bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-50 px-3 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {selectedAlreadyInstalled ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Filter className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {installing
              ? appMsg.desktop.lootFilterInstalling
              : selectedAlreadyInstalled
                ? appMsg.desktop.lootFilterReinstallBtn
                : appMsg.desktop.lootFilterInstallBtn}
          </span>
        </button>

        {status?.filterDir && (
          <button
            type="button"
            onClick={() => void handleOpenFolder()}
            title={`${appMsg.desktop.lootFilterOpenFolder} (${status.filterDir})`}
            aria-label={appMsg.desktop.lootFilterOpenFolder}
            className="shrink-0 rounded-xl bg-hud-subtle hover:bg-hud-hairline/50 p-2 text-hud-text cursor-pointer"
          >
            <FolderOpen className="h-4 w-4 text-hud-accent" />
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
    </section>
  );
}
