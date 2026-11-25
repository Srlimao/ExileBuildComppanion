import type { GameAdapter, GemDefinition, PassiveTreeNodeMetadata } from "@exile-hud/game-data";
import { resolveGemWithAliases } from "./pob2_xml_extensions.js";
import {
  formatPoe2BuildMetadataNotes,
  normalizePoe2BuildDocument,
  type NormalizedBuildInventorySlot,
  type NormalizedBuildSkill,
} from "./poe2_build_file_schema.js";
import { computeBuildLevelBreakpoints, formatBuildBracketTitle } from "./poe2_build_level_brackets.js";
import type { ExtractedItemSet, ExtractedItemSlotEntry } from "./pob_xml_item_set_extractor.js";
import type { DecodedPobDocument } from "./pob_code_zlib_xml_decoder.js";
import {
  collectUniqueRequiredGems,
  extractPobBuild,
  type ExtractedGemRef,
  type ExtractedPobBuild,
  type ExtractedSkillGroup,
  type ExtractedSkillSet,
  type ExtractedTreeSpec,
} from "./pob_xml_skill_and_tree_extractor.js";

const stringIdIndexCache = new WeakMap<Record<string, PassiveTreeNodeMetadata>, Map<string, string>>();

function getStringIdLookup(nodes: Record<string, PassiveTreeNodeMetadata>): Map<string, string> {
  const cached = stringIdIndexCache.get(nodes);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const node of Object.values(nodes)) {
    if (node.stringId) {
      map.set(node.stringId.trim().toLowerCase(), node.id);
    }
  }
  stringIdIndexCache.set(nodes, map);
  return map;
}

function buildGemNameLookup(gems: Record<string, GemDefinition>): Map<string, GemDefinition> {
  const map = new Map<string, GemDefinition>();
  for (const gem of Object.values(gems)) {
    if (/Royale|Playtest/i.test(gem.id)) continue;
    const key = gem.name.toLowerCase();
    if (!map.has(key)) map.set(key, gem);
  }
  return map;
}

function resolvePassiveNodeId(rawId: string, adapter: GameAdapter): string | null {
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const nodes = adapter.getPassiveTreeNodes();
  if (nodes[trimmed]) return nodes[trimmed]!.id;
  return getStringIdLookup(nodes).get(trimmed.toLowerCase()) ?? null;
}

function resolveGemFlexible(
  rawId: string,
  adapter: GameAdapter,
  byLowerName: Map<string, GemDefinition>,
): GemDefinition | null {
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const candidates = trimmed.includes("/")
    ? [trimmed]
    : [trimmed, `Metadata/Items/Gems/${trimmed}`, `Metadata/Items/Gem/${trimmed}`];
  for (const cand of candidates) {
    const found = resolveGemWithAliases(cand, cand, trimmed, adapter, byLowerName);
    if (found) return found;
  }
  return null;
}

function toExtractedGemRef(gem: GemDefinition): ExtractedGemRef {
  return {
    gemId: gem.id,
    name: gem.name,
    isSupport: gem.is_support,
    requiredLevel: gem.required_level,
    attribute: gem.primary_attribute,
    ...(gem.gem_kind ? { gemKind: gem.gem_kind } : {}),
    ...(gem.uncut_tier ? { uncutTier: gem.uncut_tier } : {}),
    ...(gem.spirit_cost ? { spiritCost: gem.spirit_cost } : {}),
  };
}

function inferCharacterClass(
  ascendancyName: string,
  resolvedNodeIds: string[],
  adapter: GameAdapter,
): string {
  const classes = adapter.getPassiveTreeGraphMeta().classes;
  const lowerAsc = ascendancyName.trim().toLowerCase();
  if (lowerAsc && lowerAsc !== "none") {
    const matched = classes.find((cls) => cls.ascendancies.some((a) => a.trim().toLowerCase() === lowerAsc));
    if (matched) return matched.name;
  }

  const nodes = adapter.getPassiveTreeNodes();
  for (const id of resolvedNodeIds) {
    const node = nodes[id];
    if (!node) continue;
    if (typeof node.classStartIndex === "number" && classes[node.classStartIndex]) {
      return classes[node.classStartIndex]!.name;
    }
    if (node.ascendancyName) {
      const nAsc = node.ascendancyName.trim().toLowerCase();
      const matched = classes.find((cls) => cls.ascendancies.some((a) => a.trim().toLowerCase() === nAsc));
      if (matched) return matched.name;
    }
  }
  return "Monk";
}

function buildWarningText(label: string, missing: ReadonlySet<string>): string | null {
  if (missing.size === 0) return null;
  const sample = [...missing].slice(0, 3).join(", ");
  const suffix = missing.size > 3 ? ` (+${missing.size - 3} more)` : "";
  return `Skipped ${missing.size} unrecognized ${label} ID(s): ${sample}${suffix}.`;
}

function extractSlotTitleAndMods(slot: NormalizedBuildInventorySlot): { itemName: string; baseType: string; mods: string[] } {
  const rawLines = (slot.note ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[-_=]{3,}$/.test(line));
  const mods = rawLines.filter((line) => !/^stat\s*priority:?$/i.test(line));
  if (slot.uniqueName) {
    return { itemName: slot.uniqueName, baseType: slot.baseType || slot.slotLabel, mods };
  }
  const first = rawLines[0];
  const isHeader =
    Boolean(first) &&
    !slot.baseType &&
    !/^stat\s*priority:?$/i.test(first!) &&
    !/^\d+\./.test(first!) &&
    first!.length <= 48 &&
    (rawLines.length > 1 || /^any\s+/i.test(first!));
  if (isHeader && first) {
    return { itemName: first, baseType: first, mods: rawLines.slice(1).filter((line) => !/^stat\s*priority:?$/i.test(line)) };
  }
  return { itemName: slot.baseType || slot.slotLabel, baseType: slot.baseType || slot.slotLabel, mods };
}

/** Extracts an `ExtractedPobBuild` with synthesized brackets, Weapon Sets, Item Sets & notes from PoE 2 `.build` JSON. */
export function extractPoe2BuildFromJson(
  rawJson: Record<string, any>,
  adapter: GameAdapter,
): ExtractedPobBuild {
  const doc = normalizePoe2BuildDocument(rawJson);
  const byLowerName = buildGemNameLookup(adapter.getGems());
  const unknownPassiveIds = new Set<string>();
  const unknownGemIds = new Set<string>();

  const resolvedPassives = doc.passives
    .map((p) => {
      const nodeId = resolvePassiveNodeId(p.rawId, adapter);
      if (!nodeId) {
        unknownPassiveIds.add(p.rawId);
        return null;
      }
      return { ...p, nodeId };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const gemCache = new Map<string, GemDefinition | null>();
  const getGem = (rawId: string): GemDefinition | null => {
    if (!gemCache.has(rawId)) gemCache.set(rawId, resolveGemFlexible(rawId, adapter, byLowerName));
    const res = gemCache.get(rawId) ?? null;
    if (!res) unknownGemIds.add(rawId);
    return res;
  };

  const resolveSkillAt = (skill: NormalizedBuildSkill, startLv: number): ExtractedSkillGroup | null => {
    const active = getGem(skill.rawId);
    if (!active) return null;
    const gems: ExtractedGemRef[] = [toExtractedGemRef(active)];
    for (const sup of skill.supports) {
      if (sup.minLevel > startLv || sup.maxLevel < startLv) continue;
      const resolvedSup = getGem(sup.rawId);
      if (resolvedSup) gems.push(toExtractedGemRef(resolvedSup));
    }
    return {
      title: active.name,
      slotLabel: skill.weaponSet ? `Weapon Set ${skill.weaponSet}` : "Skill Gem",
      gems,
      ...(skill.note ? { note: skill.note } : {}),
    };
  };

  const breakpoints = computeBuildLevelBreakpoints(doc);
  const isSingle = breakpoints.length === 1;
  const treeSpecs: ExtractedTreeSpec[] = [];
  const skillSets: ExtractedSkillSet[] = [];
  const itemSets: ExtractedItemSet[] = [];

  for (let idx = 0; idx < breakpoints.length; idx++) {
    const startLv = breakpoints[idx]!;
    const title = formatBuildBracketTitle(startLv, breakpoints[idx + 1], isSingle);
    const id = `build_${idx + 1}`;

    let activePassives = resolvedPassives.filter((p) => p.minLevel <= startLv && p.maxLevel >= startLv);
    if (activePassives.length === 0) {
      activePassives = resolvedPassives.filter((p) => p.minLevel <= startLv);
    }

    const nodeIds: string[] = [];
    const seenNodes = new Set<string>();
    const ws1Set = new Set<string>();
    const ws2Set = new Set<string>();
    const nodeNotes: Record<string, string> = {};

    for (const p of activePassives) {
      if (!seenNodes.has(p.nodeId)) {
        seenNodes.add(p.nodeId);
        nodeIds.push(p.nodeId);
      }
      if (p.weaponSet === 1) ws1Set.add(p.nodeId);
      if (p.weaponSet === 2) ws2Set.add(p.nodeId);
      if (p.note && !nodeNotes[p.nodeId]) nodeNotes[p.nodeId] = p.note;
    }

    treeSpecs.push({
      id,
      title,
      treeVersion: "poe2_0_5",
      minLevel: startLv,
      nodeIds,
      masteries: {},
      ...(ws1Set.size > 0 ? { weaponSet1NodeIds: [...ws1Set] } : {}),
      ...(ws2Set.size > 0 ? { weaponSet2NodeIds: [...ws2Set] } : {}),
      ...(Object.keys(nodeNotes).length > 0 ? { nodeNotes } : {}),
    });

    const groups = doc.skills
      .filter((s) => s.minLevel <= startLv && s.maxLevel >= startLv)
      .map((s) => resolveSkillAt(s, startLv))
      .filter((g): g is ExtractedSkillGroup => g !== null);
    if (groups.length > 0 || isSingle) {
      skillSets.push({ id, title, minLevel: startLv, groups });
    }

    const slots: ExtractedItemSlotEntry[] = doc.inventorySlots
      .filter((slot) => slot.minLevel <= startLv && slot.maxLevel >= startLv)
      .map((slot, slotIdx) => {
        const parsedSlot = extractSlotTitleAndMods(slot);
        return {
          slotName: slot.slotLabel,
          itemId: `slot_${idx}_${slotIdx}`,
          itemName: parsedSlot.itemName,
          baseType: parsedSlot.baseType,
          rarity: slot.uniqueName ? "unique" : "rare",
          sockets: "",
          levelReq: slot.minLevel,
          mods: parsedSlot.mods,
        };
      });
    if (slots.length > 0) itemSets.push({ id, title, minLevel: startLv, slots });
  }

  const ascendancyName = doc.ascendancy || "None";
  const characterClass = inferCharacterClass(ascendancyName, resolvedPassives.map((p) => p.nodeId), adapter);
  const maxSeenLevel = breakpoints[breakpoints.length - 1] ?? 1;
  const buildLevel = maxSeenLevel > 1 ? Math.max(maxSeenLevel, 70) : 70;
  const importWarnings = [
    buildWarningText("passive node", unknownPassiveIds),
    buildWarningText("gem", unknownGemIds),
  ].filter((w): w is string => Boolean(w));
  const suggestedNotes = formatPoe2BuildMetadataNotes(doc);

  return {
    detectedGameId: "poe2",
    sourceFormat: "poe2_build_json",
    buildName: doc.name,
    characterClass,
    ascendancyName,
    bandit: "None",
    buildLevel,
    skillSets,
    treeSpecs,
    itemSets,
    uniqueRequiredGems: collectUniqueRequiredGems(skillSets),
    ...(suggestedNotes ? { suggestedNotes } : {}),
    ...(importWarnings.length > 0 ? { importWarnings } : {}),
  };
}

/** Dispatches a decoded PoB XML document or PoE 2 `.build` JSON document into an `ExtractedPobBuild`. */
export function extractDecodedBuild(decoded: DecodedPobDocument, adapter: GameAdapter): ExtractedPobBuild {
  if (decoded.rawBuildJson) {
    return extractPoe2BuildFromJson(decoded.rawBuildJson, adapter);
  }
  return extractPobBuild(decoded.parsedXml, adapter);
}
