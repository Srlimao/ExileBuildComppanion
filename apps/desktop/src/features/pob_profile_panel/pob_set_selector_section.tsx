import type { PobBuildPreview, PobSetOptionSummary, PobSetSelection } from "@exile-hud/core";

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
  const selectedSet = new Set(selectedIds);

  const toggleId = (id: string) => {
    if (selectedSet.has(id)) {
      onUpdate(selectedIds.filter((item) => item !== id));
    } else {
      onUpdate(options.filter((opt) => selectedSet.has(opt.id) || opt.id === id).map((opt) => opt.id));
    }
  };

  return (
    <div className="rounded-lg bg-black border border-neutral-800 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-neutral-200">{title}</span>
          <span className="text-[10px] font-mono text-neutral-400">
            ({selectedIds.length}/{options.length})
          </span>
        </div>
        {options.length > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => onUpdate(options.map((opt) => opt.id))}
              className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onUpdate([])}
              className="text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              None
            </button>
          </div>
        )}
      </div>

      {options.length === 0 ? (
        <div className="text-[10px] text-neutral-500">None present in this PoB.</div>
      ) : (
        <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
          {options.map((opt) => {
            const checked = selectedSet.has(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] cursor-pointer border transition-colors ${
                  checked
                    ? "bg-indigo-500/10 border-indigo-500/30 text-neutral-100"
                    : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleId(opt.id)}
                    className="h-3.5 w-3.5 rounded border-neutral-700 bg-black text-indigo-500 focus:ring-0"
                  />
                  <span className="truncate font-medium">{opt.title}</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                  Lv {opt.minLevel}+ · {opt.detail}
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
  return (
    <div className="space-y-2 border-t border-neutral-800 pt-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-neutral-200 truncate">
          Import Selection · {preview.buildName}
        </span>
        <span className="font-mono text-[10px] text-neutral-400 shrink-0">
          {preview.characterClass} Lv {preview.buildLevel}
        </span>
      </div>

      <SetCategoryList
        title="Passive Sets"
        options={preview.passiveSpecs}
        selectedIds={selection.passiveSpecIds}
        onUpdate={(passiveSpecIds) => onChange({ ...selection, passiveSpecIds })}
      />
      <SetCategoryList
        title="Skill Sets"
        options={preview.skillSets}
        selectedIds={selection.skillSetIds}
        onUpdate={(skillSetIds) => onChange({ ...selection, skillSetIds })}
      />
      <SetCategoryList
        title="Item Sets"
        options={preview.itemSets}
        selectedIds={selection.itemSetIds}
        onUpdate={(itemSetIds) => onChange({ ...selection, itemSetIds })}
      />
    </div>
  );
}
