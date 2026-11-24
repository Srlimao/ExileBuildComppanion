import type { SupportedGameId } from "@exile-hud/game-data";
import {
  collectUniqueRequiredGems,
  type ExtractedPobBuild,
} from "./pob_xml_skill_and_tree_extractor.js";

export interface PobSetSelection {
  passiveSpecIds: string[];
  skillSetIds: string[];
  itemSetIds: string[];
}

export interface PobSetOptionSummary {
  id: string;
  title: string;
  minLevel: number;
  detail: string;
}

export interface PobBuildPreview {
  detectedGameId?: SupportedGameId;
  sourceFormat?: "pob_xml" | "poe2_build_json";
  buildName: string;
  characterClass: string;
  ascendancyName: string;
  buildLevel: number;
  passiveSpecs: PobSetOptionSummary[];
  skillSets: PobSetOptionSummary[];
  itemSets: PobSetOptionSummary[];
  suggestedNotes?: string;
  importWarnings?: string[];
}

/** Builds a lightweight preview listing selectable Passive, Skill, and Item sets from a parsed PoB or .build. */
export function buildPobPreviewSummary(extracted: ExtractedPobBuild): PobBuildPreview {
  return {
    ...(extracted.detectedGameId ? { detectedGameId: extracted.detectedGameId } : {}),
    ...(extracted.sourceFormat ? { sourceFormat: extracted.sourceFormat } : {}),
    buildName: extracted.buildName,
    characterClass: extracted.characterClass,
    ascendancyName: extracted.ascendancyName,
    buildLevel: extracted.buildLevel,
    ...(extracted.suggestedNotes ? { suggestedNotes: extracted.suggestedNotes } : {}),
    ...(extracted.importWarnings?.length ? { importWarnings: extracted.importWarnings } : {}),
    passiveSpecs: extracted.treeSpecs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      minLevel: spec.minLevel,
      detail: `${spec.nodeIds.length} nodes`,
    })),
    skillSets: extracted.skillSets.map((set) => {
      const gemCount = set.groups.reduce((sum, g) => sum + g.gems.length, 0);
      return {
        id: set.id,
        title: set.title,
        minLevel: set.minLevel,
        detail: `${set.groups.length} groups · ${gemCount} gems`,
      };
    }),
    itemSets: extracted.itemSets.map((set) => ({
      id: set.id,
      title: set.title,
      minLevel: set.minLevel,
      detail: `${set.slots.length} slots`,
    })),
  };
}

/** Creates a default selection containing every available Passive, Skill, and Item set. */
export function createDefaultPobSetSelection(extracted: ExtractedPobBuild): PobSetSelection {
  return {
    passiveSpecIds: extracted.treeSpecs.map((spec) => spec.id),
    skillSetIds: extracted.skillSets.map((set) => set.id),
    itemSetIds: extracted.itemSets.map((set) => set.id),
  };
}

function reconcileCategory(availableIds: string[], previousIds?: string[]): string[] {
  if (!previousIds) return availableIds;
  if (previousIds.length === 0) return [];
  const prevSet = new Set(previousIds);
  const matched = availableIds.filter((id) => prevSet.has(id));
  return matched.length > 0 ? matched : availableIds;
}

/** Reconciles an existing selection against a newly decoded PoB without losing unchecked intents. */
export function reconcilePobSetSelection(
  extracted: ExtractedPobBuild,
  previous?: PobSetSelection | null,
): PobSetSelection {
  if (!previous) return createDefaultPobSetSelection(extracted);
  return {
    passiveSpecIds: reconcileCategory(
      extracted.treeSpecs.map((spec) => spec.id),
      previous.passiveSpecIds,
    ),
    skillSetIds: reconcileCategory(
      extracted.skillSets.map((set) => set.id),
      previous.skillSetIds,
    ),
    itemSetIds: reconcileCategory(
      extracted.itemSets.map((set) => set.id),
      previous.itemSetIds,
    ),
  };
}

/** Filters an extracted PoB down to user-selected sets and recomputes uniqueRequiredGems. */
export function filterExtractedPobBuildBySelection(
  extracted: ExtractedPobBuild,
  selection?: PobSetSelection | null,
): ExtractedPobBuild {
  if (!selection) return extracted;
  const specSet = new Set(selection.passiveSpecIds);
  const skillSet = new Set(selection.skillSetIds);
  const itemSet = new Set(selection.itemSetIds);

  const treeSpecs = extracted.treeSpecs.filter((spec) => specSet.has(spec.id));
  const skillSets = extracted.skillSets.filter((set) => skillSet.has(set.id));
  const itemSets = extracted.itemSets.filter((set) => itemSet.has(set.id));

  return {
    ...extracted,
    treeSpecs,
    skillSets,
    itemSets,
    uniqueRequiredGems: collectUniqueRequiredGems(skillSets),
  };
}
