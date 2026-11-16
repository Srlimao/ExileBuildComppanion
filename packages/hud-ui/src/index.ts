export { DeathRespawnResumeBanner } from "./features/hud_shell/death_respawn_resume_banner.js";
export { ExileRelayBrandIcon } from "./features/hud_shell/exile_relay_brand_icon.js";
export { StandbySessionSummaryView } from "./features/hud_shell/standby_session_summary_view.js";
export { HudThemeProvider, useHudTheme } from "./features/theme/hud_theme_provider.js";
export { HudI18nProvider, useHudI18n, type AppMessagesBundle, type DesktopSurfaceMessages, type HudI18nContextValue, type HudMessagesBundle } from "./features/i18n/hud_i18n_provider.js";
export {
  applyHudLocaleToDocument,
  DEFAULT_HUD_LOCALE,
  HUD_LOCALE_STORAGE_KEY,
  initHudLocaleOnDom,
  loadSavedHudLocale,
  parseSavedHudLocale,
  saveHudLocale,
  subscribeHudLocaleChanges,
  type HudLocale,
} from "./features/i18n/locale_storage_and_types.js";
export { localizeHudModeLabel, type PwaSurfaceMessages } from "./features/i18n/pwa_surface_messages.js";
export { localizeRouteStepTitle } from "./features/i18n/route_step_title_localizer.js";
export { localizeRouteSubNote } from "./features/i18n/route_subnote_localizer.js";
export {
  localizeBenchPrescription,
  localizeBenchProblemSummary,
  localizeBossWarning,
  localizeConnectionOrSyncMessage,
  localizeGearHygieneMessage,
  localizeIzaroGuide,
  localizePobFallbackText,
  localizePobSetDetail,
} from "./features/i18n/telemetry_advisor_localizer.js";
export {
  applyHudThemeToDocument,
  HUD_THEME_STORAGE_KEY,
  initHudThemeOnDom,
  loadSavedHudTheme,
  parseSavedHudTheme,
  saveHudTheme,
  subscribeHudThemeChanges,
} from "./features/theme/theme_persistence_storage.js";
export { ThemeAppearanceControls } from "./features/theme/theme_appearance_controls.js";
export { ThemeSelectorPopover } from "./features/theme/theme_selector_popover.js";
export {
  computeRelativeLuminance,
  DEFAULT_HUD_THEME,
  HUD_ACCENT_SWATCHES,
  normalizeHexColor,
  resolvePassiveTreePalette,
  resolveReadableAccentForMode,
  resolveThemeCssVariables,
  type HudAccentPresetId,
  type HudAccentSwatch,
  type HudAppearanceMode,
  type PassiveTreeThemePalette,
  type SavedHudTheme,
} from "./features/theme/theme_tokens_and_palettes.js";
export { PassiveTreeCommandView } from "./features/passive_tree_visualizer/passive_tree_command_view.js";
export {
  resolveAdaptiveCanvasDpr,
  type AdaptiveDprEnv,
} from "./features/passive_tree_visualizer/passive_tree_canvas_painter.js";
export {
  computeBracketOverviewBounds,
  computeNextPassivesBounds,
  computeNodeSetBounds,
  getBuiltPoe1TreeGeometry,
  resolveVisibleAscendancies,
  type BuiltPoe1TreeGeometry,
  type BuiltTreeEdge,
  type TreeWorldBounds,
} from "./features/passive_tree_visualizer/passive_tree_geometry_builder.js";
export {
  buildSpatialTreeIndex,
  buildTreeHighlightLookup,
  EDGE_STYLE_ALLOCATED,
  EDGE_STYLE_EARLIER,
  EDGE_STYLE_FUTURE,
  EDGE_STYLE_NEW_BRACKET,
  EDGE_STYLE_NONE,
  EDGE_STYLE_RESPEC,
  hitTestPassiveTreeNode,
  NODE_FLAG_POB_MASTERY,
  NODE_FLAG_RESPEC_DASH,
  NODE_FLAG_SEARCH,
  NODE_FLAG_SELECTED,
  NODE_ROLE_ALLOCATED,
  NODE_ROLE_EARLIER,
  NODE_ROLE_FUTURE,
  NODE_ROLE_MASTERY_ACTIVE,
  NODE_ROLE_NEW_BRACKET,
  NODE_ROLE_RESPEC,
  NODE_ROLE_WIREFRAME,
  queryVisibleTreePrimitives,
  type SpatialTreeIndex,
  type SpatialTreeQueryResult,
  type TreeHighlightLookup,
} from "./features/passive_tree_visualizer/passive_tree_spatial_index.js";
export {
  clearSavedTreeViewportCache,
  loadSavedTreeViewport,
  saveTreeViewport,
  type SavedTreeViewport,
} from "./features/passive_tree_visualizer/passive_tree_viewport_storage.js";
export {
  clampViewWidth,
  computeCursorZoomCamera,
  computePinchedCamera,
  createPinchAnchor,
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  screenPointToWorld,
  type ViewportCamera,
  type ViewportRect,
  type WorldPointHit,
} from "./features/passive_tree_visualizer/pinch_zoom_math.js";
export { AddWidgetDrawer } from "./features/widget_grid_engine/add_widget_drawer.js";
export {
  CustomizableModeWidgetGrid,
  type WidgetGridFormFactor,
  type WidgetGridMode,
} from "./features/widget_grid_engine/customizable_mode_widget_grid.js";
export {
  getDefaultLayoutForMode,
  getLocalizedWidgetCatalog,
  WIDGET_CATALOG,
  type WidgetCatalogEntry,
} from "./features/widget_grid_engine/default_mode_grid_presets.js";
export {
  renderHudWidget,
  type HudWidgetDispatchHandlers,
} from "./features/widget_grid_engine/hud_widget_dispatcher.js";
export { ActiveChecklistWidget, selectChecklistWindow, type ChecklistWindowSelection } from "./features/widgets/active_checklist_widget.js";
export { DeferredBacklogWidget } from "./features/widgets/deferred_backlog_widget.js";
export { GearHygieneWidget } from "./features/widgets/gear_hygiene_widget.js";
export { LabCompassWidget } from "./features/widgets/lab_compass_widget.js";
export { PassiveTreeWidget } from "./features/widgets/passive_tree_widget.js";
export { RegexSyncWidget } from "./features/widgets/regex_sync_widget.js";
export { ResistanceCapWidget } from "./features/widgets/resistance_cap_widget.js";
export {
  clearRunTimerAnchorCache,
  computeLiveRunElapsedMs,
  formatRunTimerClock,
  reconcileRunTimerAnchor,
  syncRunTimerSnapshot,
  useLiveRunElapsedMs,
  type RunTimerClockAnchor,
} from "./features/widgets/run_timer_clock_tracker.js";
export { RunTimerWidget } from "./features/widgets/run_timer_widget.js";
export { SocketLinksWidget } from "./features/widgets/socket_links_widget.js";
export { TwinkGearWidget } from "./features/widgets/twink_gear_widget.js";
export { VendorShoppingWidget } from "./features/widgets/vendor_shopping_widget.js";
export { ZoneLayoutWidget } from "./features/widgets/zone_layout_widget.js";
