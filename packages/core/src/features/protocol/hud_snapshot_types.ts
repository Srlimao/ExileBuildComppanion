import type { Poe2GemKind, SupportedGameId } from "@exile-hud/game-data";
import type {
  Poe2PermanentBonusState,
  Poe2RuneHintItem,
  Poe2SpiritSummary,
} from "./poe2_telemetry_types.js";
import type {
  CharacterSyncStatus,
  CheckpointCategory,
  HudContextMode,
} from "./session_room_wire_protocol.js";

export type { SupportedGameId };

export type CheckpointStepKind = "zone_entry" | "travel_lead_in" | "objective" | "quest_turn_in" | "ascend";

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
  stepKind?: CheckpointStepKind;
  prerequisiteAreaIds?: string[];
  expectedExitAreaId?: string;
  isOptionalDetour?: boolean;
  questGroupId?: string;
  questGroupIndex?: number;
  questGroupTitle?: string;
  isMandatoryGate?: boolean;
  completed: boolean;
  softCompleted: boolean;
}

export type GemAcquiredLocation = "equipped" | "weapon_swap" | "backpack";

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
  gemKind?: Poe2GemKind;
  uncutTier?: number;
  spiritCost?: number;
  verifiedByApi: boolean;
  acquiredLocation?: GemAcquiredLocation;
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
    reserveLocation?: "backpack" | "weapon_swap";
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

export interface BenchCraftSuggestion {
  id: string;
  priority: "high" | "medium";
  problemSummary: string;
  prescription: string;
  slot: string;
  recipeId: string;
  recipeLabel: string;
  costLabel: string;
  affixType: "prefix" | "suffix";
}

export interface PassiveTreeSpecSummary {
  id: string;
  title: string;
  minLevel: number;
  nodeIds: string[];
  masteries: Record<string, string>;
  weaponSet1NodeIds?: string[];
  weaponSet2NodeIds?: string[];
}

export interface PassiveTreeTelemetry {
  specName: string;
  activeSpecId?: string;
  targetNodeCount: number;
  allocatedTargetCount: number;
  remainingNodeIds: string[];
  remainingNotableNames: string[];
  respecPointsNeeded: number;
  targetNodesPreview: Array<{ id: string; x: number; y: number; allocated: boolean; label: string }>;
  allocatedNodeIds?: string[];
  allocatedMasteries?: Record<string, string>;
  specs?: PassiveTreeSpecSummary[];
  ascendancyNoteOrderIds?: string[];
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
  gameId?: SupportedGameId;
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
  inGameTreeOpen?: boolean;
  currentAreaId: string;
  currentAreaName: string;
  currentAreaLevel: number;
  currentAreaSeed: string | null;
  currentAct: number;
  highestUnlockedAct: number;
  lastCombatZoneId: string | null;
  lastCombatZoneName: string | null;
  visitedAreaIds?: string[];
  clearedAreaIds?: string[];
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
  equippedItemNames?: string[];
  resistances: ResistanceTelemetry;
  gearHygiene: GearHygieneIssue[];
  benchCraftSuggestions?: BenchCraftSuggestion[];
  passiveTree: PassiveTreeTelemetry;
  lab: LabTelemetry;
  zoneLayoutPaths: string[];
  poe2SpiritSummary?: Poe2SpiritSummary;
  permanentBonuses?: Poe2PermanentBonusState[];
  runeSuggestions?: Poe2RuneHintItem[];
}

/** Resolves the gameId of a snapshot with safe backwards compatibility for legacy PoE 1 snapshots. */
export function resolveSnapshotGameId(snapshot?: { gameId?: SupportedGameId } | null): SupportedGameId {
  return snapshot?.gameId === "poe2" ? "poe2" : "poe1";
}
