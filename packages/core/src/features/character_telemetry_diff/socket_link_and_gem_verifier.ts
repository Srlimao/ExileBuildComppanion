import type { ExtractedSkillSet } from "../pob_import/pob_xml_skill_and_tree_extractor.js";
import type {
  GemAcquiredLocation,
  GemAcquisitionStep,
  TargetLinkGroupSummary,
} from "../protocol/session_room_wire_protocol.js";
import type { GggItemModRecord } from "./equipped_resistance_estimator.js";

const WEAPON_SWAP_SLOTS = new Set(["Weapon2", "Offhand2"]);
const BACKPACK_SLOTS = new Set(["MainInventory"]);
const NON_GEM_SLOTS = new Set(["Flask", "PassiveJewels"]);

const LOCATION_PRIORITY: Record<GemAcquiredLocation, number> = {
  backpack: 1,
  weapon_swap: 2,
  equipped: 3,
};

interface SocketedGemInstance {
  names: string[];
  isSupport: boolean;
}

function normalizeCandidateGemNames(item: {
  baseType?: string;
  typeLine: string;
  hybrid?: { baseTypeName?: string };
}): string[] {
  const out = new Set<string>();
  const rawCandidates = [item.baseType, item.typeLine, item.hybrid?.baseTypeName];
  for (const raw of rawCandidates) {
    if (!raw) continue;
    const withoutSuperior = raw.replace(/^Superior\s+/i, "").trim();
    const withoutVaal = withoutSuperior.replace(/^Vaal\s+/i, "").trim();
    if (withoutVaal) out.add(withoutVaal.toLowerCase());
    if (withoutSuperior) out.add(withoutSuperior.toLowerCase());
  }
  return [...out];
}

function isSocketedGemRecord(gem: NonNullable<GggItemModRecord["socketedItems"]>[number]): boolean {
  if (gem.abyssJewel === true) return false;
  return gem.frameType === undefined || gem.frameType === 4;
}

function isLooseInventoryGem(item: GggItemModRecord): boolean {
  return item.frameType === 4 || (item.frameType === undefined && !item.sockets && !item.socketedItems);
}

function recordGemLocation(
  ownedGemsByName: Map<string, GemAcquiredLocation>,
  names: string[],
  location: GemAcquiredLocation,
): void {
  for (const name of names) {
    const existing = ownedGemsByName.get(name);
    if (!existing || LOCATION_PRIORITY[location] > LOCATION_PRIORITY[existing]) {
      ownedGemsByName.set(name, location);
    }
  }
}

function collectOwnedGems(items: GggItemModRecord[]): {
  ownedGemsByName: Map<string, GemAcquiredLocation>;
  unlinkedSupportNames: Set<string>;
} {
  const ownedGemsByName = new Map<string, GemAcquiredLocation>();
  const instancesByGroup = new Map<string, SocketedGemInstance[]>();

  for (const item of items) {
    if (NON_GEM_SLOTS.has(item.inventoryId)) continue;

    if (BACKPACK_SLOTS.has(item.inventoryId)) {
      if (isLooseInventoryGem(item)) {
        recordGemLocation(ownedGemsByName, normalizeCandidateGemNames(item), "backpack");
      }
      for (const gem of item.socketedItems ?? []) {
        if (!isSocketedGemRecord(gem)) continue;
        recordGemLocation(ownedGemsByName, normalizeCandidateGemNames(gem), "backpack");
      }
      continue;
    }

    if (WEAPON_SWAP_SLOTS.has(item.inventoryId)) {
      for (const gem of item.socketedItems ?? []) {
        if (!isSocketedGemRecord(gem)) continue;
        recordGemLocation(ownedGemsByName, normalizeCandidateGemNames(gem), "weapon_swap");
      }
      continue;
    }

    const sockets = item.sockets ?? [];
    for (const gem of item.socketedItems ?? []) {
      if (!isSocketedGemRecord(gem)) continue;
      const names = normalizeCandidateGemNames(gem);
      recordGemLocation(ownedGemsByName, names, "equipped");
      const group = sockets[gem.socket]?.group ?? 0;
      const groupKey = `${item.inventoryId}:${group}`;
      const list = instancesByGroup.get(groupKey) ?? [];
      list.push({
        names,
        isSupport: Boolean(gem.support) || names.some((n) => /support$/i.test(n)),
      });
      instancesByGroup.set(groupKey, list);
    }
  }

  const unlinkedSupportNames = new Set<string>();
  for (const groupGems of instancesByGroup.values()) {
    const hasActive = groupGems.some((g) => !g.isSupport);
    if (!hasActive) {
      for (const g of groupGems) {
        if (g.isSupport) {
          for (const n of g.names) unlinkedSupportNames.add(n);
        }
      }
    }
  }

  return { ownedGemsByName, unlinkedSupportNames };
}

export function selectActiveSkillSet(skillSets: ExtractedSkillSet[], characterLevel: number): ExtractedSkillSet | null {
  if (skillSets.length === 0) return null;
  let active = skillSets[0]!;
  for (const set of skillSets) {
    if (set.minLevel <= characterLevel) active = set;
  }
  return active;
}

function formatMissingAuraWarning(gemName: string, reserveLocation?: "backpack" | "weapon_swap"): string {
  if (reserveLocation === "backpack") {
    return `Target aura "${gemName}" is in your backpack (not socketed in active gear).`;
  }
  if (reserveLocation === "weapon_swap") {
    return `Target aura "${gemName}" is in weapon swap (inactive in main gear).`;
  }
  return `Target aura "${gemName}" is not socketed.`;
}

export function verifySocketsAndGems(params: {
  items: GggItemModRecord[];
  skillSets: ExtractedSkillSet[];
  gemSteps: GemAcquisitionStep[];
  characterLevel: number;
}): {
  updatedGemSteps: GemAcquisitionStep[];
  linkGroups: TargetLinkGroupSummary[];
  unlinkedWarnings: string[];
  missingAuraWarnings: string[];
} {
  const { items, skillSets, gemSteps, characterLevel } = params;
  const { ownedGemsByName, unlinkedSupportNames } = collectOwnedGems(items);

  const updatedGemSteps = gemSteps.map((step) => {
    const loc = ownedGemsByName.get(step.gemName.toLowerCase());
    return {
      ...step,
      verifiedByApi: Boolean(loc),
      acquiredLocation: loc,
    };
  });

  const activeSet = selectActiveSkillSet(skillSets, characterLevel);
  const unlinkedWarnings: string[] = [];
  const missingAuraWarnings: string[] = [];

  const linkGroups: TargetLinkGroupSummary[] = (activeSet?.groups ?? []).map((group) => {
    const isAuraGroup = /aura|reservation|herald|banner/i.test(group.title);
    let missingInAuraGroup = false;

    const gems = group.gems.map((g) => {
      const lower = g.name.toLowerCase();
      const loc = ownedGemsByName.get(lower);
      const verifiedSocketed = loc === "equipped";
      const reserveLocation = loc === "backpack" || loc === "weapon_swap" ? loc : undefined;
      const unlinkedWarning = verifiedSocketed && unlinkedSupportNames.has(lower);
      if (unlinkedWarning) {
        unlinkedWarnings.push(`Support gem "${g.name}" is in an unlinked socket without an active skill.`);
      }
      if (isAuraGroup && !verifiedSocketed && !g.isSupport && characterLevel >= g.requiredLevel) {
        missingInAuraGroup = true;
        missingAuraWarnings.push(formatMissingAuraWarning(g.name, reserveLocation));
      }
      return {
        gemId: g.gemId,
        name: g.name,
        color: (g.attribute === "strength" ? "R" : g.attribute === "dexterity" ? "G" : g.attribute === "intelligence" ? "B" : "W") as
          | "R"
          | "G"
          | "B"
          | "W",
        isSupport: g.isSupport,
        verifiedSocketed,
        ...(reserveLocation ? { reserveLocation } : {}),
        unlinkedWarning,
      };
    });

    return {
      title: group.title,
      minLevel: activeSet?.minLevel ?? 1,
      gems,
      missingAuraWarning: missingInAuraGroup,
    };
  });

  return { updatedGemSteps, linkGroups, unlinkedWarnings, missingAuraWarnings };
}
