import type { ExtractedSkillSet } from "../pob_import/pob_xml_skill_and_tree_extractor.js";
import type { GemAcquisitionStep, TargetLinkGroupSummary } from "../protocol/session_room_wire_protocol.js";
import type { GggItemModRecord } from "./equipped_resistance_estimator.js";

const IGNORED_OFFHAND_SLOTS = new Set(["MainInventory", "Weapon2", "Offhand2"]);

interface SocketedGemInstance {
  nameLower: string;
  isSupport: boolean;
  groupKey: string;
}

function collectEquippedGems(items: GggItemModRecord[]): {
  allGemNames: Set<string>;
  unlinkedSupportNames: Set<string>;
} {
  const allGemNames = new Set<string>();
  const instancesByGroup = new Map<string, SocketedGemInstance[]>();

  for (const item of items) {
    if (IGNORED_OFFHAND_SLOTS.has(item.inventoryId)) continue;
    const sockets = item.sockets ?? [];
    for (const gem of item.socketedItems ?? []) {
      const nameLower = (gem.baseType || gem.typeLine).replace(/^Vaal\s+/i, "").trim().toLowerCase();
      allGemNames.add(nameLower);
      const group = sockets[gem.socket]?.group ?? 0;
      const groupKey = `${item.inventoryId}:${group}`;
      const list = instancesByGroup.get(groupKey) ?? [];
      list.push({ nameLower, isSupport: Boolean(gem.support) || /support$/i.test(nameLower), groupKey });
      instancesByGroup.set(groupKey, list);
    }
  }

  const unlinkedSupportNames = new Set<string>();
  for (const groupGems of instancesByGroup.values()) {
    const hasActive = groupGems.some((g) => !g.isSupport);
    if (!hasActive) {
      for (const g of groupGems) {
        if (g.isSupport) unlinkedSupportNames.add(g.nameLower);
      }
    }
  }

  return { allGemNames, unlinkedSupportNames };
}

export function selectActiveSkillSet(skillSets: ExtractedSkillSet[], characterLevel: number): ExtractedSkillSet | null {
  if (skillSets.length === 0) return null;
  let active = skillSets[0]!;
  for (const set of skillSets) {
    if (set.minLevel <= characterLevel) active = set;
  }
  return active;
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
  const { allGemNames, unlinkedSupportNames } = collectEquippedGems(items);

  const updatedGemSteps = gemSteps.map((step) => ({
    ...step,
    verifiedByApi: allGemNames.has(step.gemName.toLowerCase()),
  }));

  const activeSet = selectActiveSkillSet(skillSets, characterLevel);
  const unlinkedWarnings: string[] = [];
  const missingAuraWarnings: string[] = [];

  const linkGroups: TargetLinkGroupSummary[] = (activeSet?.groups ?? []).map((group) => {
    const isAuraGroup = /aura|reservation|herald|banner/i.test(group.title);
    let missingInAuraGroup = false;

    const gems = group.gems.map((g) => {
      const lower = g.name.toLowerCase();
      const verifiedSocketed = allGemNames.has(lower);
      const unlinkedWarning = unlinkedSupportNames.has(lower);
      if (unlinkedWarning) {
        unlinkedWarnings.push(`Support gem "${g.name}" is in an unlinked socket without an active skill.`);
      }
      if (isAuraGroup && !verifiedSocketed && !g.isSupport && characterLevel >= g.requiredLevel) {
        missingInAuraGroup = true;
        missingAuraWarnings.push(`Target aura "${g.name}" is not socketed.`);
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
