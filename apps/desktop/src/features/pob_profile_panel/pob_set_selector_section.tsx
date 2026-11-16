import type { PobBuildPreview, PobSetOptionSummary, PobSetSelection } from "@exile-hud/core";
import { localizePobSetDetail, useHudI18n } from "@exile-hud/hud-ui";

interface PobSetSelectorSectionProps {
  preview: PobBuildPreview;
  selection: PobSetSelection;
  onChange: (next: PobSetSelection) => void;
}

interface SetCategoryListProps {
  title: string;
  options: PobSetOptionSummary[];
  selectedIds: string[];
  onUpdate: (nextIds: string[]) => void;
}

function SetCategoryList({ title, options, selectedIds, onUpdate }: SetCategoryListProps) {
  const { locale, appMsg } = useHudI18n();
  const selectedSet = new Set(selectedIds);

  const toggleId = (id: string) => {
    if (selectedSet.has(id)) {
      onUpdate(selectedIds.filter((item) => item !== id));
    } else {
      onUpdate(options.filter((opt) => selectedSet.has(opt.id) || opt.id === id).map((opt) => opt.id));
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-hud-text">{title}</span>
          <span className="text-[10px] font-mono text-hud-muted">
            ({selectedIds.length}/{options.length})
          </span>
        </div>
        {options.length > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => onUpdate(options.map((opt) => opt.id))}
              className="text-hud-accent hover:underline cursor-pointer"
            >
              {appMsg.desktop.all}
            </button>
            <button
              type="button"
              onClick={() => onUpdate([])}
              className="text-hud-muted hover:text-hud-text cursor-pointer"
            >
              {appMsg.desktop.none}
            </button>
          </div>
        )}
      </div>

      {options.length === 0 ? (
        <div className="text-[10px] text-hud-muted">{appMsg.desktop.noneInPob}</div>
      ) : (
        <div className="max-h-28 overflow-y-auto space-y-0.5 pr-0.5">
          {options.map((opt) => {
            const checked = selectedSet.has(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] cursor-pointer transition-colors ${
                  checked
                    ? "bg-hud-subtle text-hud-text font-medium"
                    : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleId(opt.id)}
                    className="h-3.5 w-3.5 rounded focus:ring-0"
                    style={{ accentColor: "var(--hud-accent)" }}
                  />
                  <span className="truncate">{opt.title}</span>
                </span>
                <span className="text-[10px] font-mono text-hud-muted shrink-0">
                  Lv {opt.minLevel}+ · {localizePobSetDetail(opt.detail, locale)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Displays selectable Passive Trees, Skill Sets, and Item Sets parsed from a PoB import. */
export function PobSetSelectorSection({ preview, selection, onChange }: PobSetSelectorSectionProps) {
  const { appMsg } = useHudI18n();

  return (
    <div className="space-y-3 border-t border-hud-hairline pt-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-hud-text truncate">
          {appMsg.desktop.importSelectionPrefix} · {preview.buildName}
        </span>
        <span className="font-mono text-[10px] text-hud-muted shrink-0">
          {preview.characterClass} Lv {preview.buildLevel}
        </span>
      </div>

      <SetCategoryList
        title={appMsg.desktop.passiveSets}
        options={preview.passiveSpecs}
        selectedIds={selection.passiveSpecIds}
        onUpdate={(passiveSpecIds) => onChange({ ...selection, passiveSpecIds })}
      />
      <SetCategoryList
        title={appMsg.desktop.skillSets}
        options={preview.skillSets}
        selectedIds={selection.skillSetIds}
        onUpdate={(skillSetIds) => onChange({ ...selection, skillSetIds })}
      />
      <SetCategoryList
        title={appMsg.desktop.itemSets}
        options={preview.itemSets}
        selectedIds={selection.itemSetIds}
        onUpdate={(itemSetIds) => onChange({ ...selection, itemSetIds })}
      />
    </div>
  );
}
