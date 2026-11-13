import type { GameAdapter } from "@exile-hud/game-data";
import type { ExtractedGemRef, ExtractedPobBuild, ExtractedSkillSet } from "./pob_xml_skill_and_tree_extractor.js";

export interface ValidatedPobBuild extends ExtractedPobBuild {
  isEndgameOnlyFallback: boolean;
  fallbackNotice: string | null;
  requiresAct3Library: boolean;
}

const LEVELING_SET_TITLE_HINT = /(act\s*\d|lvl|level|campaign|early|1-\d+|twink|story|starter)/i;

function groupFallbackGemsByLevel(gems: ExtractedGemRef[]): ExtractedSkillSet[] {
  const deduped = new Map<string, ExtractedGemRef>();
  for (const gem of gems) {
    if (!deduped.has(gem.gemId)) deduped.set(gem.gemId, gem);
  }
  const buckets: Array<{ title: string; minLevel: number; maxLevel: number; gems: ExtractedGemRef[] }> = [
    { title: "Fallback Act 1 (Lv 1–11)", minLevel: 1, maxLevel: 11, gems: [] },
    { title: "Fallback Act 2 (Lv 12–23)", minLevel: 12, maxLevel: 23, gems: [] },
    { title: "Fallback Act 3 (Lv 24–33)", minLevel: 24, maxLevel: 33, gems: [] },
    { title: "Fallback Act 4+ (Lv 34+)", minLevel: 34, maxLevel: 100, gems: [] },
  ];

  for (const gem of [...deduped.values()].sort((a, b) => a.requiredLevel - b.requiredLevel)) {
    const bucket = buckets.find((b) => gem.requiredLevel >= b.minLevel && gem.requiredLevel <= b.maxLevel) ?? buckets[3]!;
    bucket.gems.push(gem);
  }

  return buckets
    .filter((b) => b.gems.length > 0)
    .map((b) => ({
      title: b.title,
      minLevel: b.minLevel,
      groups: [{ title: b.title, slotLabel: "Vendor Bracket", gems: b.gems }],
    }));
}

function checkNeedsLibraryForClass(requiredGemIds: Set<string>, characterClass: string, adapter: GameAdapter): boolean {
  const quests = adapter.getQuests();
  const availableViaClassCampaign = new Set<string>();
  const char = adapter.getCharacters()[characterClass];
  if (char) {
    availableViaClassCampaign.add(char.start_gem_id);
    availableViaClassCampaign.add(char.chest_gem_id);
  }
  let libraryOffersNeeded = false;
  for (const quest of Object.values(quests)) {
    const actNum = Number.parseInt(quest.act, 10) || 99;
    if (actNum > 5) continue;
    for (const [offerId, offer] of Object.entries(quest.reward_offers)) {
      if (!offer) continue;
      for (const [gemId, entry] of [...Object.entries(offer.quest), ...Object.entries(offer.vendor)]) {
        if (!entry) continue;
        const ok = entry.classes.length === 0 || entry.classes.includes(characterClass);
        if (ok) {
          if (quest.id === "a3q12" || offerId.includes("library") || offerId === "a3q12") {
            if (requiredGemIds.has(gemId)) libraryOffersNeeded = true;
          } else {
            availableViaClassCampaign.add(gemId);
          }
        }
      }
    }
  }
  if (libraryOffersNeeded) return true;
  for (const id of requiredGemIds) {
    if (!availableViaClassCampaign.has(id)) return true;
  }
  return false;
}

export function validateAndEnrichPobBuild(extracted: ExtractedPobBuild, adapter: GameAdapter): ValidatedPobBuild {
  const hasMultipleSkillSets = extracted.skillSets.length > 1;
  const hasLevelingHint = extracted.skillSets.some((s) => LEVELING_SET_TITLE_HINT.test(s.title));
  const isEndgameOnlyFallback = !hasMultipleSkillSets && !hasLevelingHint && extracted.buildLevel >= 68;

  let skillSets = extracted.skillSets;
  let fallbackNotice: string | null = null;
  if (isEndgameOnlyFallback) {
    const allGems = extracted.skillSets.flatMap((s) => s.groups.flatMap((g) => g.gems));
    skillSets = groupFallbackGemsByLevel(allGems);
    fallbackNotice = "Endgame-only PoB detected (no leveling skill sets). Fallback Leveling Mode active: gems sorted by earliest Act vendor availability.";
  }

  const requiredIds = new Set(extracted.uniqueRequiredGems.map((g) => g.id));
  const requiresAct3Library = checkNeedsLibraryForClass(requiredIds, extracted.characterClass, adapter);

  return {
    ...extracted,
    skillSets: [...skillSets].sort((a, b) => a.minLevel - b.minLevel),
    isEndgameOnlyFallback,
    fallbackNotice,
    requiresAct3Library,
  };
}
