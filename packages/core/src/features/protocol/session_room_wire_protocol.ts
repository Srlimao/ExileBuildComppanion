import { z } from "zod";

export const HudContextModeSchema = z.enum(["FIELD", "TOWN", "LAB", "STANDBY"]);
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
  "ONLINE_POESESSID",
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

export interface CheckpointStepItem {
  id: string;
  sectionAct: number;
  areaId: string;
  areaName: string;
  category: CheckpointCategory;
  title: string;
  subNotes: string[];
  directions: number[];
  questId?: string;
  completed: boolean;
  softCompleted: boolean;
}

export interface GemAcquisitionStep {
  id: string;
  gemId: string;
  gemName: string;
  attribute: string;
  requiredLevel: number;
  isSupport: boolean;
  acquisitionType: "FREE_QUEST_REWARD" | "VENDOR_BUY" | "FALLBACK_VENDOR";
  questId: string;
  questName: string;
  act: number;
  npcName: string;
  currencyCost: "free" | "wisdom" | "transmutation" | "alteration" | "chance" | "alchemy";
  count: number;
  note: string;
  verifiedByApi: boolean;
  softAcquired: boolean;
  manualCompleted: boolean;
}

export interface CurrencyTally {
  wisdom: number;
  transmutation: number;
  alteration: number;
  chance: number;
  alchemy: number;
}

export interface TargetLinkGroupSummary {
  title: string;
  minLevel: number;
  gems: Array<{
    gemId: string;
    name: string;
    color: "R" | "G" | "B" | "W";
    isSupport: boolean;
    verifiedSocketed: boolean;
    unlinkedWarning: boolean;
  }>;
  missingAuraWarning: boolean;
}

export interface TargetItemSlotSummary {
  slotName: string;
  itemId: string;
  itemName: string;
  baseType: string;
  rarity: "normal" | "magic" | "rare" | "unique" | "unknown";
  sockets: string;
  levelReq: number;
  mods: string[];
  verifiedEquipped?: boolean;
}

export interface TargetItemSetSummary {
  id: string;
  title: string;
  minLevel: number;
  slots: TargetItemSlotSummary[];
}

export interface ResistanceTelemetry {
  source: "API_VERIFIED" | "ACT_TARGET_FALLBACK";
  kitavaPenalty: number;
  fire: { actual: number; target: number };
  cold: { actual: number; target: number };
  lightning: { actual: number; target: number };
  chaos: { actual: number; target: number };
  upcomingBossWarning: string | null;
}

export interface GearHygieneIssue {
  id: string;
  severity: "warn" | "info";
  slot: "boots" | "flask" | "weapon" | "links";
  message: string;
}

export interface PassiveTreeTelemetry {
  specName: string;
  targetNodeCount: number;
  allocatedTargetCount: number;
  remainingNodeIds: string[];
  remainingNotableNames: string[];
  respecPointsNeeded: number;
  targetNodesPreview: Array<{ id: string; x: number; y: number; allocated: boolean; label: string }>;
}

export interface LabTelemetry {
  hasDailyLayout: boolean;
  difficultyLabel: string;
  currentRoomId: string | null;
  currentRoomName: string | null;
  rooms: Array<{ id: string; name: string; exits: string[]; hasGoldenDoor: boolean; darkshrines: number }>;
  completedTrialAreaIds: string[];
}

export interface HudSessionSnapshot {
  version: number;
  roomId: string;
  profileId: string;
  buildName: string;
  characterClass: string;
  ascendancyName: string;
  characterName: string;
  characterLevel: number;
  isEndgameOnlyFallback: boolean;
  fallbackNotice: string | null;
  leagueStart: boolean;
  poeRunning: boolean;
  clientLogHooked: boolean;
  characterSyncStatus: CharacterSyncStatus;
  lastCharacterSyncAt: number | null;
  mode: HudContextMode;
  currentAreaId: string;
  currentAreaName: string;
  currentAreaLevel: number;
  currentAreaSeed: string | null;
  currentAct: number;
  highestUnlockedAct: number;
  lastCombatZoneId: string | null;
  lastCombatZoneName: string | null;
  recentDeath: boolean;
  resumeZoneBanner: { areaId: string; areaName: string } | null;
  activeVendorRegex: string;
  autoClipboardEnabled: boolean;
  runElapsedMs: number;
  runTimerRunning: boolean;
  actSplitsMs: Record<string, number>;
  checkpoints: CheckpointStepItem[];
  gemSteps: GemAcquisitionStep[];
  nextTownCurrencyBudget: CurrencyTally;
  linkGroups: TargetLinkGroupSummary[];
  itemSets?: TargetItemSetSummary[];
  resistances: ResistanceTelemetry;
  gearHygiene: GearHygieneIssue[];
  passiveTree: PassiveTreeTelemetry;
  lab: LabTelemetry;
  zoneLayoutPaths: string[];
}

export const ViewerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("viewer:toggle_checkpoint"), checkpointId: z.string(), completed: z.boolean().optional() }),
  z.object({ type: z.literal("viewer:toggle_gem"), gemStepId: z.string(), completed: z.boolean().optional() }),
  z.object({ type: z.literal("viewer:request_character_sync") }),
  z.object({ type: z.literal("viewer:request_regex_copy"), regex: z.string().optional() }),
  z.object({ type: z.literal("viewer:save_widget_layout"), deviceFormFactor: DeviceFormFactorSchema, mode: HudContextModeSchema, items: z.array(WidgetGridItemLayoutSchema) }),
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
  | { type: "room:hydrated_state"; snapshot: HudSessionSnapshot; layouts: ModeWidgetGrids; viewers: ViewerPresenceEntry[] }
  | { type: "room:state_patch"; snapshot: HudSessionSnapshot; eventTag: string }
  | { type: "room:viewer_presence"; viewers: ViewerPresenceEntry[] }
  | { type: "room:layout_updated"; deviceFormFactor: DeviceFormFactor; mode: HudContextMode; items: WidgetGridItemLayout[] }
  | { type: "room:command_forwarded"; command: ViewerToRoomMessage }
  | { type: "room:pong"; ts: number };
