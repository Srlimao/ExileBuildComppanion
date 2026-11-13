import type { GameAdapter } from "@exile-hud/game-data";
import type { ResistanceTelemetry } from "../protocol/session_room_wire_protocol.js";

export interface GggItemModRecord {
  inventoryId: string;
  typeLine: string;
  baseType?: string;
  name?: string;
  ilvl?: number;
  implicitMods?: string[];
  explicitMods?: string[];
  craftedMods?: string[];
  enchantMods?: string[];
  fracturedMods?: string[];
  requirements?: Array<{ name: string; values: Array<[string, number]> }>;
  sockets?: Array<{ group: number; attr?: string; sColour?: string }>;
  socketedItems?: Array<{ socket: number; typeLine: string; baseType?: string; support?: boolean }>;
}

const ACTIVE_EQUIP_SLOTS = new Set([
  "Helm",
  "BodyArmour",
  "Gloves",
  "Boots",
  "Belt",
  "Amulet",
  "Ring",
  "Ring2",
  "Weapon",
  "Offhand",
]);

function parseResistanceLines(mods: string[]): { fire: number; cold: number; lightning: number; chaos: number } {
  const totals = { fire: 0, cold: 0, lightning: 0, chaos: 0 };
  for (const mod of mods) {
    const allEle = /([+-]?\d+)%\s+to all Elemental Resistances/i.exec(mod);
    if (allEle?.[1]) {
      const val = Number.parseInt(allEle[1], 10);
      totals.fire += val;
      totals.cold += val;
      totals.lightning += val;
      continue;
    }

    const dualMatch = /([+-]?\d+)%\s+to (Fire|Cold|Lightning|Chaos) and (Fire|Cold|Lightning|Chaos) Resistances/i.exec(mod);
    if (dualMatch?.[1] && dualMatch[2] && dualMatch[3]) {
      const val = Number.parseInt(dualMatch[1], 10);
      totals[dualMatch[2].toLowerCase() as keyof typeof totals] += val;
      totals[dualMatch[3].toLowerCase() as keyof typeof totals] += val;
      continue;
    }

    const singleMatch = /([+-]?\d+)%\s+to (Fire|Cold|Lightning|Chaos) Resistance/i.exec(mod);
    if (singleMatch?.[1] && singleMatch[2]) {
      const val = Number.parseInt(singleMatch[1], 10);
      totals[singleMatch[2].toLowerCase() as keyof typeof totals] += val;
    }
  }
  return totals;
}

export function estimateEquippedResistances(params: {
  items: GggItemModRecord[];
  allocatedNodeIds: number[];
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  highestUnlockedAct: number;
  completedBossFlags: string[];
  adapter: GameAdapter;
}): ResistanceTelemetry {
  const { items, allocatedNodeIds, bandit, highestUnlockedAct, completedBossFlags, adapter } = params;
  const allMods: string[] = [];
  let hasPurityOfElements = false;

  for (const item of items) {
    if (!ACTIVE_EQUIP_SLOTS.has(item.inventoryId)) continue;
    if (item.implicitMods) allMods.push(...item.implicitMods);
    if (item.explicitMods) allMods.push(...item.explicitMods);
    if (item.craftedMods) allMods.push(...item.craftedMods);
    if (item.enchantMods) allMods.push(...item.enchantMods);
    if (item.fracturedMods) allMods.push(...item.fracturedMods);
    for (const sock of item.socketedItems ?? []) {
      if (/purity of elements/i.test(sock.typeLine)) {
        hasPurityOfElements = true;
      }
    }
  }

  const passiveNodes = adapter.getPassiveTreeNodes();
  for (const hash of allocatedNodeIds) {
    const node = passiveNodes[String(hash)];
    if (node?.stats) allMods.push(...node.stats);
  }

  const raw = parseResistanceLines(allMods);
  if (bandit === "Alira") {
    raw.fire += 15;
    raw.cold += 15;
    raw.lightning += 15;
  }
  if (hasPurityOfElements) {
    raw.fire += 22;
    raw.cold += 22;
    raw.lightning += 22;
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
