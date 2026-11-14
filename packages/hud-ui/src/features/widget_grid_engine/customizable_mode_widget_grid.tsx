import type { DeviceFormFactor, HudContextMode, WidgetGridItemLayout, WidgetId } from "@exile-hud/core";
import { ArrowDown, ArrowUp, Maximize2, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AddWidgetDrawer } from "./add_widget_drawer.js";
import { WIDGET_CATALOG } from "./default_mode_grid_presets.js";

export type WidgetGridMode = HudContextMode | "TREE_COMPACT";
export type WidgetGridFormFactor = DeviceFormFactor | "pc-overlay";

interface CustomizableModeWidgetGridProps {
  mode: WidgetGridMode;
  formFactor: WidgetGridFormFactor;
  items: WidgetGridItemLayout[];
  editMode: boolean;
  compactOverlay?: boolean;
  renderWidget: (widgetId: WidgetId) => ReactNode;
  onUpdateLayout: (nextItems: WidgetGridItemLayout[]) => void;
  onResetDefaults: () => void;
}

function getSpanClasses(item: WidgetGridItemLayout, formFactor: WidgetGridFormFactor): string {
  if (formFactor === "phone") return "col-span-1 row-span-1";
  if (formFactor === "pc-overlay") {
    const col = item.colSpan === 2 ? "min-[560px]:col-span-2" : "col-span-1";
    const row = item.rowSpan === 2 ? "min-[560px]:row-span-2" : "row-span-1";
    return `${col} ${row}`;
  }
  const col = item.colSpan === 2 ? "md:col-span-2" : "col-span-1";
  const row = item.rowSpan === 2 ? "md:row-span-2" : "row-span-1";
  return `${col} ${row}`;
}

export function CustomizableModeWidgetGrid({
  mode,
  formFactor,
  items,
  editMode,
  compactOverlay = false,
  renderWidget,
  onUpdateLayout,
  onResetDefaults,
}: CustomizableModeWidgetGridProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<WidgetId | null>(null);

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const cycleSpan = (widgetId: WidgetId) => {
    const next = sorted.map((item) => {
      if (item.widgetId !== widgetId) return item;
      if (item.colSpan === 1 && item.rowSpan === 1) return { ...item, colSpan: 2 as const, rowSpan: 1 as const };
      if (item.colSpan === 2 && item.rowSpan === 1) return { ...item, colSpan: 2 as const, rowSpan: 2 as const };
      return { ...item, colSpan: 1 as const, rowSpan: 1 as const };
    });
    onUpdateLayout(next);
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const copy = [...sorted];
    const [removed] = copy.splice(index, 1);
    if (!removed) return;
    copy.splice(target, 0, removed);
    onUpdateLayout(copy.map((item, idx) => ({ ...item, order: idx })));
  };

  const handleDropOn = (targetId: WidgetId) => {
    if (!draggedId || draggedId === targetId) return;
    const copy = [...sorted];
    const fromIdx = copy.findIndex((i) => i.widgetId === draggedId);
    const toIdx = copy.findIndex((i) => i.widgetId === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = copy.splice(fromIdx, 1);
    if (!moved) return;
    copy.splice(toIdx, 0, moved);
    setDraggedId(null);
    onUpdateLayout(copy.map((item, idx) => ({ ...item, order: idx })));
  };

  const removeWidget = (widgetId: WidgetId) => {
    onUpdateLayout(sorted.filter((i) => i.widgetId !== widgetId).map((item, idx) => ({ ...item, order: idx })));
  };

  const addWidget = (widgetId: WidgetId) => {
    if (sorted.some((i) => i.widgetId === widgetId)) return;
    onUpdateLayout([...sorted, { widgetId, colSpan: 1, rowSpan: 1, order: sorted.length }]);
  };

  const gridColsClass =
    formFactor === "pc-overlay"
      ? "grid-cols-1 min-[560px]:grid-cols-2"
      : formFactor === "phone"
        ? "grid-cols-1"
        : formFactor === "tablet-portrait"
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-1 md:grid-cols-3";

  const wrapperClass = compactOverlay
    ? "px-3 py-2.5 space-y-3"
    : "max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4";
  const gridGapClass = compactOverlay
    ? "gap-x-5 gap-y-5 auto-rows-[minmax(110px,auto)]"
    : "gap-x-8 gap-y-7 auto-rows-[minmax(165px,auto)]";

  return (
    <div className={wrapperClass}>
      {editMode && (
        <div className="border-b border-dashed border-hud-accent/55 pb-2.5 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs sm:text-sm text-hud-muted">
            Editing <span className="font-semibold text-hud-text">{mode === "TREE_COMPACT" ? "TREE" : mode}</span> layout ({formFactor})
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-3 py-1.5 rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add Widget
          </button>
        </div>
      )}

      <div className={`grid ${gridColsClass} ${gridGapClass}`}>
        {sorted.map((item, idx) => {
          const title = WIDGET_CATALOG.find((c) => c.widgetId === item.widgetId)?.label ?? item.widgetId;
          return (
            <div
              key={item.widgetId}
              draggable={editMode}
              onDragStart={() => setDraggedId(item.widgetId)}
              onDragOver={(e) => editMode && e.preventDefault()}
              onDrop={() => editMode && handleDropOn(item.widgetId)}
              className={`${getSpanClasses(item, formFactor)} flex flex-col min-w-0 ${
                editMode ? "rounded-lg border border-dashed border-hud-accent/55 p-3" : ""
              }`}
            >
              {editMode && (
                <div className="pb-2 mb-2 border-b border-hud-hairline flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-hud-accent truncate">{title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      className="p-1 rounded hover:bg-hud-subtle text-hud-muted hover:text-hud-text cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      className="p-1 rounded hover:bg-hud-subtle text-hud-muted hover:text-hud-text cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cycleSpan(item.widgetId)}
                      className="px-1.5 py-0.5 rounded bg-hud-subtle text-hud-text font-mono inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="h-3 w-3" /> {item.colSpan}x{item.rowSpan}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWidget(item.widgetId)}
                      className="p-1 rounded hover:bg-hud-subtle text-hud-danger cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 flex flex-col min-h-0">{renderWidget(item.widgetId)}</div>
            </div>
          );
        })}
      </div>

      <AddWidgetDrawer
        open={drawerOpen}
        mode={mode}
        formFactor={formFactor}
        activeItems={sorted}
        onAddWidget={addWidget}
        onResetDefaults={onResetDefaults}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
