import type { HudSessionSnapshot, WidgetId } from "@exile-hud/core";
import { ActiveChecklistWidget } from "../widgets/active_checklist_widget.js";
import { AscendancyOrderWidget } from "../widgets/ascendancy_order_widget.js";
import { DeferredBacklogWidget } from "../widgets/deferred_backlog_widget.js";
import { GearHygieneWidget } from "../widgets/gear_hygiene_widget.js";
import { LabCompassWidget } from "../widgets/lab_compass_widget.js";
import { PassiveTreeWidget } from "../widgets/passive_tree_widget.js";
import { RegexSyncWidget } from "../widgets/regex_sync_widget.js";
import { ResistanceCapWidget } from "../widgets/resistance_cap_widget.js";
import { syncRunTimerSnapshot } from "../widgets/run_timer_clock_tracker.js";
import { RunTimerWidget } from "../widgets/run_timer_widget.js";
import { SocketLinksWidget } from "../widgets/socket_links_widget.js";
import { TwinkGearWidget } from "../widgets/twink_gear_widget.js";
import { VendorShoppingWidget } from "../widgets/vendor_shopping_widget.js";
import { ZoneLayoutWidget } from "../widgets/zone_layout_widget.js";

export interface HudWidgetDispatchHandlers {
  snapshot: HudSessionSnapshot;
  onToggleCheckpoint: (checkpointId: string) => void;
  onToggleGem: (gemStepId: string) => void;
  onOpenFullTree?: () => void;
  onPushToPcClipboard: (regex: string) => void;
  onImportPoelabJson: (rawJson: string) => void;
}

/** Central widget renderer shared by the web PWA HUD and the local PC overlay. */
export function renderHudWidget(widgetId: WidgetId, handlers: HudWidgetDispatchHandlers) {
  const { snapshot } = handlers;
  syncRunTimerSnapshot(snapshot);
  switch (widgetId) {
    case "zone_layout":
      return <ZoneLayoutWidget snapshot={snapshot} />;
    case "active_checklist":
      return <ActiveChecklistWidget snapshot={snapshot} onToggleCheckpoint={handlers.onToggleCheckpoint} />;
    case "vendor_shopping":
      return <VendorShoppingWidget snapshot={snapshot} onToggleGem={handlers.onToggleGem} />;
    case "socket_links":
      return <SocketLinksWidget snapshot={snapshot} />;
    case "passive_tree":
      return <PassiveTreeWidget snapshot={snapshot} onOpenFullTree={handlers.onOpenFullTree} />;
    case "regex_sync":
      return <RegexSyncWidget snapshot={snapshot} onPushToPcClipboard={handlers.onPushToPcClipboard} />;
    case "deferred_backlog":
      return <DeferredBacklogWidget snapshot={snapshot} onToggleCheckpoint={handlers.onToggleCheckpoint} />;
    case "resistance_cap":
      return <ResistanceCapWidget snapshot={snapshot} />;
    case "gear_hygiene":
      return <GearHygieneWidget snapshot={snapshot} />;
    case "twink_gear":
      return <TwinkGearWidget snapshot={snapshot} onPushToPcClipboard={handlers.onPushToPcClipboard} />;
    case "run_timer":
      return <RunTimerWidget snapshot={snapshot} />;
    case "ascendancy_order":
      return <AscendancyOrderWidget snapshot={snapshot} />;
    case "lab_compass":
      return <LabCompassWidget snapshot={snapshot} onImportPoelabJson={handlers.onImportPoelabJson} />;
  }
}
