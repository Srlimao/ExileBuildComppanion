import { useHudI18n } from "@exile-hud/hud-ui";

interface BuildLibraryEditorMetadataFieldsProps {
  characterName: string;
  selectedLeague: string;
  notes: string;
  customRouteText: string;
  showCustomRoute: boolean;
  onChangeCharacterName: (v: string) => void;
  onChangeSelectedLeague: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onChangeCustomRoute: (v: string) => void;
}

export function BuildLibraryEditorMetadataFields({
  characterName,
  selectedLeague,
  notes,
  customRouteText,
  showCustomRoute,
  onChangeCharacterName,
  onChangeSelectedLeague,
  onChangeNotes,
  onChangeCustomRoute,
}: BuildLibraryEditorMetadataFieldsProps) {
  const { appMsg } = useHudI18n();

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.linkedCharLabel}</span>
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacterName(e.target.value)}
            placeholder={appMsg.desktop.linkedCharPlaceholder}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
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
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] text-hud-muted">{appMsg.desktop.notesLabel}</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder={appMsg.desktop.notesPlaceholder}
          className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline p-2 text-xs text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />
      </label>

      {showCustomRoute && (
        <textarea
          rows={3}
          value={customRouteText}
          onChange={(e) => onChangeCustomRoute(e.target.value)}
          placeholder={appMsg.desktop.customRoutePlaceholder}
          className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
        />
      )}
    </>
  );
}
