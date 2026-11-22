import { useHudI18n } from "@exile-hud/hud-ui";
import { Route } from "lucide-react";

interface BuildLibraryEditorMetadataFieldsProps {
  characterName: string;
  selectedLeague: string;
  notes: string;
  customRouteText: string;
  showCustomRoute: boolean;
  onToggleCustomRoute: () => void;
  onChangeCharacterName: (v: string) => void;
  onChangeSelectedLeague: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onChangeCustomRoute: (v: string) => void;
}

/** Second tab of the streamlined build editor: linked character, league, notes, and custom route. */
export function BuildLibraryEditorMetadataFields({
  characterName,
  selectedLeague,
  notes,
  customRouteText,
  showCustomRoute,
  onToggleCustomRoute,
  onChangeCharacterName,
  onChangeSelectedLeague,
  onChangeNotes,
  onChangeCustomRoute,
}: BuildLibraryEditorMetadataFieldsProps) {
  const { appMsg } = useHudI18n();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.linkedCharLabel}</span>
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacterName(e.target.value)}
            placeholder={appMsg.desktop.linkedCharPlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">
            {appMsg.desktop.linkedLeagueLabel}
          </span>
          <input
            type="text"
            value={selectedLeague}
            onChange={(e) => onChangeSelectedLeague(e.target.value)}
            placeholder={appMsg.desktop.linkedLeaguePlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] text-hud-muted">{appMsg.desktop.notesLabel}</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder={appMsg.desktop.notesPlaceholder}
          className="w-full rounded-lg bg-hud-subtle border border-hud-hairline p-2.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />
      </label>

      <div className="space-y-2 pt-1 border-t border-hud-hairline">
        <button
          type="button"
          onClick={onToggleCustomRoute}
          className="text-[11px] text-hud-muted hover:text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Route className="h-3.5 w-3.5 text-hud-accent" />
          {showCustomRoute ? appMsg.desktop.hideCustomRoute : appMsg.desktop.customRoute}
        </button>

        {showCustomRoute && (
          <textarea
            rows={4}
            value={customRouteText}
            onChange={(e) => onChangeCustomRoute(e.target.value)}
            placeholder={appMsg.desktop.customRoutePlaceholder}
            className="w-full rounded-lg bg-hud-subtle border border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
          />
        )}
      </div>
    </div>
  );
}
