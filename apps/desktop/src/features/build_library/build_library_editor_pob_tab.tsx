import type { PobBuildPreview, PobSetSelection, SupportedGameId } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PobSetSelectorSection } from "../pob_profile_panel/pob_set_selector_section.js";

interface BuildLibraryEditorPobTabProps {
  activeGameId?: SupportedGameId;
  name: string;
  folderPath: string;
  allFolders: readonly string[];
  rawInput: string;
  leagueStart: boolean;
  preview: PobBuildPreview | null;
  selection: PobSetSelection | null;
  inspecting: boolean;
  onChangeName: (nextName: string) => void;
  onChangeFolderPath: (nextFolder: string) => void;
  onChangeRawInput: (nextInput: string) => void;
  onChangeLeagueStart: (nextLeagueStart: boolean) => void;
  onInspect: () => void;
  onChangeSelection: (nextSelection: PobSetSelection) => void;
}

/** First tab of the streamlined build editor: name, folder, PoB source, and set selection. */
export function BuildLibraryEditorPobTab({
  activeGameId,
  name,
  folderPath,
  allFolders,
  rawInput,
  leagueStart,
  preview,
  selection,
  inspecting,
  onChangeName,
  onChangeFolderPath,
  onChangeRawInput,
  onChangeLeagueStart,
  onInspect,
  onChangeSelection,
}: BuildLibraryEditorPobTabProps) {
  const { appMsg } = useHudI18n();

  const hasGameMismatch = Boolean(
    activeGameId && preview?.detectedGameId && preview.detectedGameId !== activeGameId,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.buildNameLabel}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder={appMsg.desktop.buildNamePlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.folderLabel}</span>
          <select
            value={folderPath}
            onChange={(e) => onChangeFolderPath(e.target.value)}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
          >
            <option value="" className="bg-hud-surface text-hud-text">
              {appMsg.desktop.moveTargetRoot}
            </option>
            {allFolders.map((folder) => (
              <option key={folder} value={folder} className="bg-hud-surface text-hud-text">
                {folder}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-hud-muted truncate">{appMsg.desktop.pobInputLabel}</span>
          <div className="inline-flex rounded-lg bg-hud-subtle p-0.5 text-[10px] shrink-0">
            {[
              { label: appMsg.desktop.leagueStart, val: true },
              { label: appMsg.desktop.twink, val: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChangeLeagueStart(opt.val)}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  leagueStart === opt.val
                    ? "bg-hud-accent text-hud-accent-fg font-semibold"
                    : "text-hud-muted hover:text-hud-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={rawInput}
          onChange={(e) => onChangeRawInput(e.target.value)}
          placeholder={appMsg.desktop.pobInputPlaceholder}
          className="w-full rounded-lg bg-hud-subtle border border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={inspecting || !rawInput.trim()}
            onClick={onInspect}
            className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 disabled:opacity-45 px-2.5 py-1 text-[11px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${inspecting ? "animate-spin" : ""}`} />
            {inspecting ? appMsg.desktop.readingSets : appMsg.desktop.inspectSets}
          </button>
        </div>
      </div>

      {hasGameMismatch && activeGameId && preview?.detectedGameId && (
        <div className="flex items-start gap-2 rounded-lg border-l-2 border-hud-warn bg-hud-warn/10 px-2.5 py-2 text-[11px] text-hud-warn">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {appMsg.poe2.pobMismatchNotice(
              appMsg.poe2.gameShortLabels[preview.detectedGameId],
              appMsg.poe2.gameShortLabels[activeGameId],
            )}
          </span>
        </div>
      )}

      {preview && selection && (
        <div className="rounded-xl bg-hud-surface border border-hud-hairline p-3">
          <PobSetSelectorSection preview={preview} selection={selection} onChange={onChangeSelection} />
        </div>
      )}
    </div>
  );
}
