import type { GameAdapter, GemDefinition } from "@exile-hud/game-data";
import { cleanPobColorCodes } from "./pob_xml_text_helpers.js";

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

function parseWeaponSetCsv(rawEl: any): string[] {
  const nodesRaw = Array.isArray(rawEl) ? rawEl[0]?.["@_nodes"] : rawEl?.["@_nodes"];
  if (!nodesRaw) return [];
  return String(nodesRaw)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Extracts `<WeaponSet1 nodes="..."/>` and `<WeaponSet2 nodes="..."/>` IDs from a PoB 2 `<Spec>`. */
export function extractWeaponSetNodesFromSpec(specEl: any): {
  weaponSet1NodeIds?: string[];
  weaponSet2NodeIds?: string[];
} {
  const weaponSet1NodeIds = parseWeaponSetCsv(specEl?.WeaponSet1);
  const weaponSet2NodeIds = parseWeaponSetCsv(specEl?.WeaponSet2);
  return {
    ...(weaponSet1NodeIds.length > 0 ? { weaponSet1NodeIds } : {}),
    ...(weaponSet2NodeIds.length > 0 ? { weaponSet2NodeIds } : {}),
  };
}

/** Resolves a `<Gem>` tag across PoE 1 (`gemId`) and PoE 2 (`gemId` / `skillId` / `nameSpec` + aliases). */
export function resolveGemWithAliases(
  rawGemId: string | undefined,
  rawSkillId: string | undefined,
  nameSpec: string | undefined,
  adapter: GameAdapter,
  byLowerName: Map<string, GemDefinition>,
): GemDefinition | null {
  const gems = adapter.getGems();
  const aliases = adapter.getGemIdAliases();

  for (const candidateRaw of [rawGemId, rawSkillId]) {
    if (!candidateRaw) continue;
    let id = POB_GEM_ID_REMAP[candidateRaw] ?? aliases[candidateRaw] ?? candidateRaw;
    id = adapter.getVaalGemLookup()[id] ?? id;
    id = adapter.getAwakenedGemLookup()[id] ?? id;
    id = aliases[id] ?? id;
    if (gems[id]) return gems[id]!;
  }

  if (nameSpec) {
    const cleanedFull = cleanPobColorCodes(nameSpec).trim();
    const cleanedLower = cleanedFull.toLowerCase();
    const withoutVaal = cleanedFull.replace(/^Vaal\s+/i, "").toLowerCase();
    return (
      byLowerName.get(withoutVaal) ??
      byLowerName.get(cleanedLower) ??
      byLowerName.get(`${cleanedLower} i`) ??
      null
    );
  }

  return null;
}
