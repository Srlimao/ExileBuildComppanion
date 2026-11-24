import type { SupportedGameId } from "@exile-hud/game-data";
import { z } from "zod";
import type { HudSessionSnapshot } from "./hud_snapshot_types.js";

export * from "./hud_snapshot_types.js";
export * from "./poe2_telemetry_types.js";

export const SupportedGameIdSchema = z.enum(["poe1", "poe2"]);

export const HudContextModeSchema = z.enum(["FIELD", "TOWN", "LAB", "TREE", "STANDBY"]);
export type HudContextMode = z.infer<typeof HudContextModeSchema>;

export const DeviceFormFactorSchema = z.enum([
  "tablet-landscape",
  "tablet-portrait",
  "phone",
]);
export type DeviceFormFactor = z.infer<typeof DeviceFormFactorSchema>;

export const CheckpointCategorySchema = z.enum([
  "MANDATORY_PATH",
  "SKILL_BOOK",
  "LAB_TRIAL",
  "WAYPOINT_RECIPE",
]);
export type CheckpointCategory = z.infer<typeof CheckpointCategorySchema>;

export const CharacterSyncStatusSchema = z.enum([
  "UNCONFIGURED",
  "ONLINE_PUBLIC",
  "OFFLINE_FALLBACK",
]);
export type CharacterSyncStatus = z.infer<typeof CharacterSyncStatusSchema>;

export const WidgetIdSchema = z.enum([
  "zone_layout",
  "active_checklist",
  "vendor_shopping",
  "socket_links",
  "passive_tree",
  "regex_sync",
  "deferred_backlog",
  "resistance_cap",
  "gear_hygiene",
  "run_timer",
  "lab_compass",
  "ascendancy_order",
  "twink_gear",
]);
export type WidgetId = z.infer<typeof WidgetIdSchema>;

export const WidgetGridItemLayoutSchema = z.object({
  widgetId: WidgetIdSchema,
  colSpan: z.union([z.literal(1), z.literal(2)]),
  rowSpan: z.union([z.literal(1), z.literal(2)]),
  order: z.number().int().nonnegative(),
});
export type WidgetGridItemLayout = z.infer<typeof WidgetGridItemLayoutSchema>;

export type ModeWidgetGrids = Record<
  DeviceFormFactor,
  Partial<Record<HudContextMode, WidgetGridItemLayout[]>>
>;

export const ViewerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("viewer:toggle_checkpoint"), checkpointId: z.string(), completed: z.boolean().optional() }),
  z.object({ type: z.literal("viewer:toggle_gem"), gemStepId: z.string(), completed: z.boolean().optional() }),
  z.object({ type: z.literal("viewer:reset_progress") }),
  z.object({ type: z.literal("viewer:request_character_sync") }),
  z.object({ type: z.literal("viewer:request_regex_copy"), regex: z.string().optional() }),
  z.object({
    type: z.literal("viewer:save_widget_layout"),
    gameId: SupportedGameIdSchema.optional(),
    deviceFormFactor: DeviceFormFactorSchema,
    mode: HudContextModeSchema,
    items: z.array(WidgetGridItemLayoutSchema),
  }),
  z.object({ type: z.literal("viewer:import_poelab_daily"), rawJson: z.string() }),
  z.object({ type: z.literal("viewer:ping") }),
]);
export type ViewerToRoomMessage = z.infer<typeof ViewerCommandSchema>;

export interface ViewerPresenceEntry {
  connectionId: string;
  deviceLabel: string;
  connectedAt: number;
}

export type HostToRoomMessage =
  | { type: "host:full_snapshot"; snapshot: HudSessionSnapshot }
  | { type: "host:state_patch"; snapshot: HudSessionSnapshot; eventTag: string }
  | { type: "host:ping" };

export type RoomToClientMessage =
  | {
      type: "room:hydrated_state";
      snapshot: HudSessionSnapshot;
      layouts: ModeWidgetGrids;
      layoutsByGame?: Record<SupportedGameId, ModeWidgetGrids>;
      viewers: ViewerPresenceEntry[];
    }
  | { type: "room:state_patch"; snapshot: HudSessionSnapshot; eventTag: string }
  | { type: "room:viewer_presence"; viewers: ViewerPresenceEntry[] }
  | {
      type: "room:layout_updated";
      gameId?: SupportedGameId;
      deviceFormFactor: DeviceFormFactor;
      mode: HudContextMode;
      items: WidgetGridItemLayout[];
    }
  | { type: "room:command_forwarded"; command: ViewerToRoomMessage }
  | { type: "room:pong"; ts: number };
