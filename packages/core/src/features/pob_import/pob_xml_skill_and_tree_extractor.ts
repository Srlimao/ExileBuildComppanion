import type { GameAdapter, GemDefinition } from "@exile-hud/game-data";
import { extractAscendancyNoteOrderIds } from "../lab_compass/ascendancy_notes_order_parser.js";
import { decodeBase64UrlToBytes } from "./pob_code_zlib_xml_decoder.js";
import { extractPobItemSets, type ExtractedItemSet } from "./pob_xml_item_set_extractor.js";
import { cleanPobColorCodes, inferLevelFromTitle, parseXmlMasteryEffectsAttr } from "./pob_xml_text_helpers.js";

export { cleanPobColorCodes, inferLevelFromTitle };

const POB_GEM_ID_REMAP: Record<string, string> = {
  "Metadata/Items/Gems/Smite": "Metadata/Items/Gems/SkillGemSmite",
  "Metadata/Items/Gems/ConsecratedPath": "Metadata/Items/Gems/SkillGemConsecratedPath",
  "Metadata/Items/Gems/VaalAncestralWarchief": "Metadata/Items/Gems/SkillGemVaalAncestralWarchief",
  "Metadata/Items/Gems/HeraldOfAgony": "Metadata/Items/Gems/SkillGemHeraldOfAgony",
  "Metadata/Items/Gems/HeraldOfPurity": "Metadata/Items/Gems/SkillGemHeraldOfPurity",
  "Metadata/Items/Gems/ScourgeArrow": "Metadata/Items/Gems/SkillGemScourgeArrow",
  "Metadata/Items/Gems/RainOfSpores": "Metadata/Items/Gems/SkillGemToxicRain",
  "Metadata/Items/Gems/SummonRelic": "Metadata/Items/Gems/SkillGemSummonRelic",
  "Metadata/Items/Gems/SkillGemNewPhaseRun": "Metadata/Items/Gems/SkillGemPhaseRun",
  "Metadata/Items/Gems/SkillGemNewArcticArmour": "Metadata/Items/Gems/SkillGemArcticArmour",
};

export interface ExtractedGemRef {
  gemId: string;
  name: string;
  isSupport: boolean;
  requiredLevel: number;
  attribute: string;
}

export interface ExtractedSkillGroup {
  title: string;
  slotLabel: string;
  gems: ExtractedGemRef[];
}

export interface ExtractedSkillSet {
  id: string;
  title: string;
  minLevel: number;
  groups: ExtractedSkillGroup[];
}

export interface ExtractedTreeSpec {
  id: string;
  title: string;
  treeVersion: string;
  minLevel: number;
  nodeIds: string[];
  masteries: Record<string, string>;
}

export interface ExtractedPobBuild {
  buildName: string;
  characterClass: string;
  ascendancyName: string;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  buildLevel: number;
  skillSets: ExtractedSkillSet[];
  treeSpecs: ExtractedTreeSpec[];
  itemSets: ExtractedItemSet[];
  uniqueRequiredGems: Array<{ id: string; note: string; count: number }>;
  ascendancyNoteOrderIds?: string[];
}

/** Collects deduplicated required gems across the provided skill sets. */
export function collectUniqueRequiredGems(
  skillSets: ExtractedSkillSet[],
): Array<{ id: string; note: string; count: number }> {
  const uniqueMap = new Map<string, { id: string; note: string; count: number }>();
  for (const set of skillSets) {
    for (const group of set.groups) {
      for (const gem of group.gems) {
        if (!uniqueMap.has(gem.gemId)) {
          uniqueMap.set(gem.gemId, {
            id: gem.gemId,
            note: group.title || set.title,
            count: 1,
          });
        }
      }
    }
  }
  return [...uniqueMap.values()];
}

function buildGemNameLookup(gems: Record<string, GemDefinition>): Map<string, GemDefinition> {
  const map = new Map<string, GemDefinition>();
  for (const gem of Object.values(gems)) {
    if (/Royale|Playtest/i.test(gem.id)) continue;
    const key = gem.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, gem);
    }
  }
  return map;
}

export function normalizeGemId(
  rawGemId: string | undefined,
  nameSpec: string | undefined,
  adapter: GameAdapter,
  byLowerName: Map<string, GemDefinition>,
): GemDefinition | null {
  const gems = adapter.getGems();
  if (rawGemId) {
    let id = POB_GEM_ID_REMAP[rawGemId] ?? rawGemId;
    id = adapter.getVaalGemLookup()[id] ?? id;
    id = adapter.getAwakenedGemLookup()[id] ?? id;
    const found = gems[id];
    if (found) return found;
  }
  if (nameSpec) {
    const cleaned = cleanPobColorCodes(nameSpec).replace(/^Vaal\s+/i, "").toLowerCase();
    return byLowerName.get(cleaned) ?? byLowerName.get(cleanPobColorCodes(nameSpec).toLowerCase()) ?? null;
  }
  return null;
}

function decodeTreeUrlNodes(url: string): { nodeIds: string[]; masteries: Record<string, string> } {
  const token = /.*\/([^/?#]+)$/.exec(url.trim())?.[1];
  if (!token) return { nodeIds: [], masteries: {} };
  try {
    const buf = decodeBase64UrlToBytes(token);
    if (buf.length < 7) return { nodeIds: [], masteries: {} };
    const version = (buf[0]! << 24) | (buf[1]! << 16) | (buf[2]! << 8) | buf[3]!;
    if (version < 4) return { nodeIds: [], masteries: {} };
    const nodesCount = buf[6]!;
    const nodesOffset = 7;
    if (buf.length < nodesOffset + nodesCount * 2) return { nodeIds: [], masteries: {} };
    const nodeIds: string[] = [];
    for (let i = 0; i < nodesCount; i++) {
      const off = nodesOffset + i * 2;
      nodeIds.push(String((buf[off]! << 8) | buf[off + 1]!));
    }
    const masteries: Record<string, string> = {};
    if (version >= 6) {
      const clusterCountOff = nodesOffset + nodesCount * 2;
      const clusterCount = buf[clusterCountOff] ?? 0;
      const masteryCountOff = clusterCountOff + 1 + clusterCount * 2;
      const masteryCount = buf[masteryCountOff] ?? 0;
      const masteryStart = masteryCountOff + 1;
      for (let i = 0; i < masteryCount; i++) {
        const off = masteryStart + i * 4;
        if (off + 3 >= buf.length) break;
        const effectId = String((buf[off]! << 8) | buf[off + 1]!);
        const nodeId = String((buf[off + 2]! << 8) | buf[off + 3]!);
        masteries[nodeId] = effectId;
      }
    }
    return { nodeIds, masteries };
  } catch {
    return { nodeIds: [], masteries: {} };
  }
}

export function extractPobBuild(parsedXml: Record<string, any>, adapter: GameAdapter, buildNameFallback = "Imported PoB"): ExtractedPobBuild {
  const root = parsedXml.PathOfBuilding ?? {};
  const buildNode = root.Build ?? {};
  const characterClass = String(buildNode["@_className"] ?? "Witch");
  const ascendancyName = String(buildNode["@_ascendClassName"] ?? "None");
  const rawBandit = String(buildNode["@_bandit"] ?? "None");
  const bandit = (["None", "Oak", "Kraityn", "Alira"].includes(rawBandit) ? rawBandit : "None") as ExtractedPobBuild["bandit"];
  const buildLevel = Math.max(1, Number.parseInt(String(buildNode["@_level"] ?? "1"), 10) || 1);
  const byLowerName = buildGemNameLookup(adapter.getGems());

  const skillsContainer = root.Skills ?? {};
  const rawSkillSets: any[] = Array.isArray(skillsContainer.SkillSet)
    ? skillsContainer.SkillSet
    : skillsContainer.Skill
      ? [{ "@_title": "Main Set", Skill: skillsContainer.Skill }]
      : [];

  const skillSets: ExtractedSkillSet[] = rawSkillSets.map((setEl, setIdx) => {
    const id = String(setEl["@_id"] ?? `skillset_${setIdx + 1}`);
    const title = cleanPobColorCodes(setEl["@_title"] ?? `Set ${setIdx + 1}`) || `Set ${setIdx + 1}`;
    const rawSkills: any[] = Array.isArray(setEl.Skill) ? setEl.Skill : [];
    const groups: ExtractedSkillGroup[] = [];
    let recentHeader = "";
    let maxGemLevel = 1;

    for (const sk of rawSkills) {
      if (sk["@_enabled"] === "false") continue;
      const label = cleanPobColorCodes(sk["@_label"]);
      const rawGems: any[] = Array.isArray(sk.Gem) ? sk.Gem : [];
      if (rawGems.length === 0 && label) {
        recentHeader = label;
        continue;
      }
      const gems: ExtractedGemRef[] = [];
      for (const gm of rawGems) {
        if (gm["@_enabled"] === "false") continue;
        const resolved = normalizeGemId(gm["@_gemId"], gm["@_nameSpec"], adapter, byLowerName);
        if (!resolved) continue;
        maxGemLevel = Math.max(maxGemLevel, resolved.required_level);
        gems.push({
          gemId: resolved.id,
          name: resolved.name,
          isSupport: resolved.is_support,
          requiredLevel: resolved.required_level,
          attribute: resolved.primary_attribute,
        });
      }
      if (gems.length > 0) {
        groups.push({ title: label || recentHeader || title, slotLabel: String(sk["@_slot"] ?? ""), gems });
      }
    }

    return {
      id,
      title,
      minLevel: inferLevelFromTitle(title, setIdx === 0 ? 1 : maxGemLevel),
      groups,
    };
  });

  const treeContainer = root.Tree ?? {};
  const rawSpecs: any[] = Array.isArray(treeContainer.Spec) ? treeContainer.Spec : [];
  const treeSpecs: ExtractedTreeSpec[] = rawSpecs.map((specEl, idx) => {
    const id = String(specEl["@_id"] ?? `spec_${idx + 1}`);
    const title = cleanPobColorCodes(specEl["@_title"] ?? `Tree ${idx + 1}`) || `Tree ${idx + 1}`;
    const csvNodes = String(specEl["@_nodes"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const urlText = Array.isArray(specEl.URL) ? String(specEl.URL[0] ?? "") : String(specEl.URL ?? "");
    const decodedUrl = urlText ? decodeTreeUrlNodes(urlText) : { nodeIds: [], masteries: {} };
    const xmlMasteries = parseXmlMasteryEffectsAttr(specEl["@_masteryEffects"]);
    const nodeIds = csvNodes.length > 0 ? csvNodes : decodedUrl.nodeIds;
    return {
      id,
      title,
      treeVersion: String(specEl["@_treeVersion"] ?? "3_30"),
      minLevel: inferLevelFromTitle(title, idx === 0 ? 1 : 50),
      nodeIds,
      masteries: { ...decodedUrl.masteries, ...xmlMasteries },
    };
  });

  const itemSets = extractPobItemSets(parsedXml, buildLevel);
  const uniqueRequiredGems = collectUniqueRequiredGems(skillSets);
  const rawNotes = Array.isArray(root.Notes) ? String(root.Notes[0] ?? "") : String(root.Notes ?? "");
  const ascendancyNoteOrderIds = rawNotes
    ? extractAscendancyNoteOrderIds(rawNotes, ascendancyName, treeSpecs, adapter)
    : [];

  return {
    buildName: cleanPobColorCodes(buildNode["@_buildName"]) || buildNameFallback,
    characterClass,
    ascendancyName,
    bandit,
    buildLevel,
    skillSets,
    treeSpecs,
    itemSets,
    uniqueRequiredGems,
    ...(ascendancyNoteOrderIds.length > 0 ? { ascendancyNoteOrderIds } : {}),
  };
}
