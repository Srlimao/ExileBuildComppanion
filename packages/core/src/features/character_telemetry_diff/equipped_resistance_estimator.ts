import type { GameAdapter } from "@exile-hud/game-data";
import type { ResistanceTelemetry } from "../protocol/session_room_wire_protocol.js";

export type GggModEntry = string | { description?: string; flags?: Record<string, boolean> };

export interface GggItemModRecord {
  inventoryId: string;
  typeLine: string;
  baseType?: string;
  name?: string;
  ilvl?: number;
  frameType?: number;
  support?: boolean;
  hybrid?: { isVaalGem?: boolean; baseTypeName?: string };
  implicitMods?: GggModEntry[] | GggModEntry;
  explicitMods?: GggModEntry[] | GggModEntry;
  craftedMods?: GggModEntry[] | GggModEntry;
  enchantMods?: GggModEntry[] | GggModEntry;
  fracturedMods?: GggModEntry[] | GggModEntry;
  utilityMods?: GggModEntry[] | GggModEntry;
  scourgeMods?: GggModEntry[] | GggModEntry;
  crucibleMods?: GggModEntry[] | GggModEntry;
  mutatedMods?: GggModEntry[] | GggModEntry;
  properties?: Array<{ name: string; values?: Array<[string, number]> }>;
  requirements?: Array<{ name: string; values: Array<[string, number]> }>;
  sockets?: Array<{ group: number; attr?: string; sColour?: string }>;
  socketedItems?: Array<{
    socket: number;
    typeLine: string;
    baseType?: string;
    support?: boolean;
    frameType?: number;
    abyssJewel?: boolean;
    hybrid?: { isVaalGem?: boolean; baseTypeName?: string };
    implicitMods?: GggModEntry[] | GggModEntry;
    explicitMods?: GggModEntry[] | GggModEntry;
    craftedMods?: GggModEntry[] | GggModEntry;
    enchantMods?: GggModEntry[] | GggModEntry;
    fracturedMods?: GggModEntry[] | GggModEntry;
    utilityMods?: GggModEntry[] | GggModEntry;
    scourgeMods?: GggModEntry[] | GggModEntry;
    crucibleMods?: GggModEntry[] | GggModEntry;
    mutatedMods?: GggModEntry[] | GggModEntry;
  }>;
}

type GggModContainer = Pick<
  GggItemModRecord,
  | "implicitMods"
  | "explicitMods"
  | "craftedMods"
  | "enchantMods"
  | "fracturedMods"
  | "utilityMods"
  | "scourgeMods"
  | "crucibleMods"
  | "mutatedMods"
>;

const INACTIVE_EQUIP_SLOTS = new Set(["MainInventory", "Flask", "Weapon2", "Offhand2"]);

const MOD_LIST_KEYS: ReadonlyArray<keyof GggModContainer> = [
  "implicitMods",
  "explicitMods",
  "craftedMods",
  "enchantMods",
  "fracturedMods",
  "utilityMods",
  "scourgeMods",
  "crucibleMods",
  "mutatedMods",
];

/** Extracts normalized mod lines from string arrays or GGG `{ description }` mod objects. */
export function extractGggItemModLines(item: GggModContainer): string[] {
  const lines: string[] = [];
  for (const key of MOD_LIST_KEYS) {
    const raw = item[key];
    if (!raw) continue;
    const entries = Array.isArray(raw) ? raw : [raw];
    for (const entry of entries) {
      const text = typeof entry === "string" ? entry : entry?.description;
      if (!text) continue;
      const cleaned = text.replace(/\[(?:[^\]|]+\|)?([^\]]+)\]/g, "$1");
      for (const line of cleaned.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
      }
    }
  }
  return lines;
}

function parseResistanceLines(
  mods: string[],
  options: { hasShield: boolean },
): { fire: number; cold: number; lightning: number; chaos: number } {
  const totals = { fire: 0, cold: 0, lightning: 0, chaos: 0 };
  for (const mod of mods) {
    const allEle =
      /^\s*([+-]?\d+)%\s+(?:to\s+)?(?:all\s+)?Elemental Resistances(\s+while holding a Shield)?\s*$/i.exec(mod);
    if (allEle?.[1]) {
      if (allEle[2] && !options.hasShield) continue;
      const val = Number.parseInt(allEle[1], 10);
      totals.fire += val;
      totals.cold += val;
      totals.lightning += val;
      continue;
    }

    const dualMatch =
      /^\s*([+-]?\d+)%\s+to (Fire|Cold|Lightning|Chaos) and (Fire|Cold|Lightning|Chaos) Resistances\s*$/i.exec(mod);
    if (dualMatch?.[1] && dualMatch[2] && dualMatch[3]) {
      const val = Number.parseInt(dualMatch[1], 10);
      totals[dualMatch[2].toLowerCase() as keyof typeof totals] += val;
      totals[dualMatch[3].toLowerCase() as keyof typeof totals] += val;
      continue;
    }

    const singleMatch = /^\s*([+-]?\d+)%\s+to (Fire|Cold|Lightning|Chaos) Resistance\s*$/i.exec(mod);
    if (singleMatch?.[1] && singleMatch[2]) {
      const val = Number.parseInt(singleMatch[1], 10);
      totals[singleMatch[2].toLowerCase() as keyof typeof totals] += val;
    }
  }
  return totals;
}

export function estimateEquippedResistances(params: {
  items: GggItemModRecord[];
  passiveItems?: GggItemModRecord[];
  wickermanItems?: GggItemModRecord[];
  allocatedNodeIds: number[];
  allocatedMasteries?: Record<string, string>;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  highestUnlockedAct: number;
  completedBossFlags: string[];
  adapter: GameAdapter;
}): ResistanceTelemetry {
  const {
    items,
    passiveItems,
    wickermanItems,
    allocatedNodeIds,
    allocatedMasteries,
    bandit,
    highestUnlockedAct,
    completedBossFlags,
    adapter,
  } = params;
  const allMods: string[] = [];

  for (const item of items) {
    if (INACTIVE_EQUIP_SLOTS.has(item.inventoryId)) continue;
    allMods.push(...extractGggItemModLines(item));
    for (const sock of item.socketedItems ?? []) {
      const isNonGemSocketItem = sock.abyssJewel === true || (sock.frameType !== undefined && sock.frameType !== 4);
      if (isNonGemSocketItem) {
        allMods.push(...extractGggItemModLines(sock));
      }
    }
  }

  for (const extraItem of [...(passiveItems ?? []), ...(wickermanItems ?? [])]) {
    allMods.push(...extractGggItemModLines(extraItem));
  }

  const passiveNodes = adapter.getPassiveTreeNodes();
  for (const hash of allocatedNodeIds) {
    const node = passiveNodes[String(hash)];
    if (node?.stats) allMods.push(...node.stats);
    const masteryEffectId = allocatedMasteries?.[String(hash)];
    if (masteryEffectId && node?.masteryEffects) {
      const effect = node.masteryEffects.find((m) => m.effectId === masteryEffectId);
      if (effect?.stats) allMods.push(...effect.stats);
    }
  }

  const hasShield = items.some(
    (item) =>
      item.inventoryId === "Offhand" &&
      (item.properties?.some((p) => p.name === "Chance to Block") ||
        /shield|buckler/i.test(`${item.baseType ?? ""} ${item.typeLine}`)),
  );
  const raw = parseResistanceLines(allMods, { hasShield });
  if (bandit === "Alira") {
    raw.fire += 15;
    raw.cold += 15;
    raw.lightning += 15;
  }

  const penalty = adapter.getResistancePenaltyForAct(highestUnlockedAct, completedBossFlags);
  const warnings = adapter.getBossElementalWarnings(highestUnlockedAct);
  const topWarning = warnings[0];
  const actTarget = highestUnlockedAct <= 1 ? 35 : highestUnlockedAct <= 3 ? 55 : 75;

  return {
    source: "API_VERIFIED",
    kitavaPenalty: penalty,
    fire: { actual: raw.fire + penalty, target: topWarning?.recommendedFire ?? actTarget },
    cold: { actual: raw.cold + penalty, target: topWarning?.recommendedCold ?? actTarget },
    lightning: { actual: raw.lightning + penalty, target: topWarning?.recommendedLightning ?? actTarget },
    chaos: { actual: raw.chaos + penalty, target: topWarning?.recommendedChaos ?? 0 },
    upcomingBossWarning: topWarning?.warningText ?? null,
  };
}
