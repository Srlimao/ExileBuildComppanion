import type { WidgetGridItemLayout, WidgetId } from "@exile-hud/core";
import { Plus, X } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import type { WidgetGridFormFactor, WidgetGridMode } from "./customizable_mode_widget_grid.js";
import { getLocalizedWidgetCatalog } from "./default_mode_grid_presets.js";

interface AddWidgetDrawerProps {
  open: boolean;
  mode: WidgetGridMode;
  formFactor: WidgetGridFormFactor;
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
  const { locale, msg } = useHudI18n();
  if (!open) return null;
  const activeSet = new Set(activeItems.map((i) => i.widgetId));
  const catalog = getLocalizedWidgetCatalog(locale);
  const modeLabel = mode === "TREE_COMPACT" ? msg.modes.TREE : msg.modes[mode];

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-hud-surface border border-hud-hairline rounded-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-hud-hairline">
          <div>
            <h2 className="text-lg font-bold text-hud-text">{msg.grid.customizeTitle(modeLabel)}</h2>
            <p className="text-xs text-hud-muted">{msg.grid.savedForViewport(formFactor)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-2.5 py-1 rounded-md text-xs text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              {msg.grid.resetDefaults}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-hud-hairline">
          {catalog.map((entry) => {
            const added = activeSet.has(entry.widgetId);
            return (
              <div key={entry.widgetId} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-hud-text">{entry.label}</div>
                  <div className="text-xs text-hud-muted mt-0.5">{entry.description}</div>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAddWidget(entry.widgetId)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 inline-flex items-center gap-1 ${
                    added
                      ? "text-hud-dim cursor-default"
                      : "bg-hud-accent text-hud-accent-fg hover:opacity-90 cursor-pointer"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {added ? msg.grid.active : msg.grid.add}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
