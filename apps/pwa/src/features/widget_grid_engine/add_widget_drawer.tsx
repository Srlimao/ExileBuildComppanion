import type { DeviceFormFactor, HudContextMode, WidgetGridItemLayout, WidgetId } from "@exile-hud/core";
import { Plus, X } from "lucide-react";
import { WIDGET_CATALOG } from "./default_mode_grid_presets.js";

interface AddWidgetDrawerProps {
  open: boolean;
  mode: HudContextMode;
  formFactor: DeviceFormFactor;
  activeItems: WidgetGridItemLayout[];
  onAddWidget: (widgetId: WidgetId) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

export function AddWidgetDrawer({
  open,
  mode,
  formFactor,
  activeItems,
  onAddWidget,
  onResetDefaults,
  onClose,
}: AddWidgetDrawerProps) {
  if (!open) return null;
  const activeSet = new Set(activeItems.map((i) => i.widgetId));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Customize {mode} Widgets</h2>
            <p className="text-xs text-neutral-400">Saved specifically for {formFactor} viewport</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-xs text-neutral-300 hover:border-neutral-500 cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WIDGET_CATALOG.map((entry) => {
            const added = activeSet.has(entry.widgetId);
            return (
              <div
                key={entry.widgetId}
                className="rounded-xl bg-black border border-neutral-800 p-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{entry.label}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{entry.description}</div>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAddWidget(entry.widgetId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center gap-1 ${
                    added
                      ? "bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-default"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {added ? "Active" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
