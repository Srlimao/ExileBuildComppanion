import type { GameAdapter, GemDefinition } from "@exile-hud/game-data";
import type { ValidatedPobBuild } from "../pob_import/pob_endgame_fallback_validator.js";
import type { CurrencyTally, GemAcquisitionStep } from "../protocol/session_room_wire_protocol.js";
import type { ParsedRouteStep } from "./route_fragment_ast_parser.js";

export function getGemVendorCurrencyCost(
  requiredLevel: number,
): "wisdom" | "transmutation" | "alteration" | "chance" | "alchemy" {
  if (requiredLevel < 8) return "wisdom";
  if (requiredLevel < 16) return "transmutation";
  if (requiredLevel < 28) return "alteration";
  if (requiredLevel < 38) return "chance";
  return "alchemy";
}

export function assignGemsToCampaignRoute(
  build: ValidatedPobBuild,
  routeSteps: ParsedRouteStep[],
  adapter: GameAdapter,
): GemAcquisitionStep[] {
  const quests = adapter.getQuests();
  const gems = adapter.getGems();
  const charStart = adapter.getCharacters()[build.characterClass];
  const acquiredIndices = new Set<number>();
  const vendorMatchedIndices = new Set<number>();
  const required = build.uniqueRequiredGems;

  if (charStart) {
    required.forEach((req, idx) => {
      if (req.id === charStart.start_gem_id || req.id === charStart.chest_gem_id) {
        acquiredIndices.add(idx);
      }
    });
  }

  const assigned: GemAcquisitionStep[] = [];
  const pushStep = (
    gem: GemDefinition,
    reqIdx: number,
    acquisitionType: GemAcquisitionStep["acquisitionType"],
    questId: string,
    questName: string,
    act: number,
    npcName: string,
  ) => {
    const req = required[reqIdx]!;
    assigned.push({
      id: `gem_${questId}_${gem.id}`,
      gemId: gem.id,
      gemName: gem.name,
      attribute: gem.primary_attribute,
      requiredLevel: gem.required_level,
      isSupport: gem.is_support,
      acquisitionType,
      questId,
      questName,
      act,
      npcName,
      currencyCost: acquisitionType === "FREE_QUEST_REWARD" ? "free" : getGemVendorCurrencyCost(gem.required_level),
      count: req.count,
      note: req.note,
      verifiedByApi: false,
      softAcquired: false,
      manualCompleted: false,
    });
  };

  for (const step of routeSteps) {
    for (const frag of step.fragments) {
      if (frag.type !== "quest") continue;
      const quest = quests[frag.questId];
      if (!quest) continue;
      const questAct = Number.parseInt(quest.act, 10) || step.sectionAct;

      for (const offerId of frag.rewardOffers) {
        const offer = quest.reward_offers[offerId];
        if (!offer) continue;
        for (let i = 0; i < required.length; i++) {
          if (acquiredIndices.has(i)) continue;
          const req = required[i]!;
          const reward = offer.quest[req.id];
          if (!reward) continue;
          if (reward.classes.length === 0 || reward.classes.includes(build.characterClass)) {
            const gem = gems[req.id];
            if (!gem) continue;
            acquiredIndices.add(i);
            pushStep(gem, i, "FREE_QUEST_REWARD", quest.id, quest.name, questAct, offer.quest_npc || "Quest NPC");
            break;
          }
        }
      }

      for (const offerId of frag.rewardOffers) {
        const offer = quest.reward_offers[offerId];
        if (!offer) continue;
        for (let i = 0; i < required.length; i++) {
          const req = required[i]!;
          if ((req.count === 1 && acquiredIndices.has(i)) || vendorMatchedIndices.has(i)) continue;
          const vendor = offer.vendor[req.id];
          if (!vendor) continue;
          if (vendor.classes.length === 0 || vendor.classes.includes(build.characterClass)) {
            const gem = gems[req.id];
            if (!gem) continue;
            vendorMatchedIndices.add(i);
            const type = build.isEndgameOnlyFallback ? "FALLBACK_VENDOR" : "VENDOR_BUY";
            pushStep(gem, i, type, quest.id, quest.name, questAct, vendor.npc || offer.quest_npc || "Vendor");
          }
        }
      }
    }
  }

  for (let i = 0; i < required.length; i++) {
    if (acquiredIndices.has(i) || vendorMatchedIndices.has(i)) continue;
    const gem = gems[required[i]!.id];
    if (!gem) continue;
    pushStep(
      gem,
      i,
      build.isEndgameOnlyFallback ? "FALLBACK_VENDOR" : "VENDOR_BUY",
      "a6q4",
      "Fallen from Grace",
      6,
      "Lilly Roth",
    );
  }

  return assigned.sort((a, b) => a.act - b.act || a.requiredLevel - b.requiredLevel);
}

export function computeNextTownCurrencyBudget(gemSteps: GemAcquisitionStep[], currentAct: number): CurrencyTally {
  const tally: CurrencyTally = { wisdom: 0, transmutation: 0, alteration: 0, chance: 0, alchemy: 0 };
  const targetActMax = Math.max(currentAct, 1);

  for (const step of gemSteps) {
    if (step.verifiedByApi || step.softAcquired || step.manualCompleted) continue;
    if (step.acquisitionType === "FREE_QUEST_REWARD" || step.currencyCost === "free") continue;
    if (step.act > Math.min(3, targetActMax + 1) && currentAct <= 3) continue;
    if (step.act !== currentAct && step.act !== currentAct + 1) continue;
    tally[step.currencyCost] += step.count;
  }

  return tally;
}
