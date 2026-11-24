import type { GameAdapter, GemDefinition } from "@exile-hud/game-data";
import type { ValidatedPobBuild } from "../pob_import/pob_endgame_fallback_validator.js";
import type { GemAcquisitionStep } from "../protocol/session_room_wire_protocol.js";

function mapRequiredLevelToStageAct(requiredLevel: number): number {
  if (requiredLevel <= 14) return 1;
  if (requiredLevel <= 28) return 2;
  if (requiredLevel <= 44) return 3;
  if (requiredLevel <= 53) return 4;
  if (requiredLevel <= 57) return 5;
  if (requiredLevel <= 61) return 6;
  return 7;
}

function formatUncutStepLabel(gem: GemDefinition): { title: string; npcName: string } {
  const tier = gem.uncut_tier ?? 1;
  const kind = gem.gem_kind ?? (gem.is_support ? "support" : "skill");
  if (kind === "support") {
    return {
      title: `Uncut Support Gem (Tier ${tier})`,
      npcName: "Support Drop / Cut",
    };
  }
  if (kind === "meta" || kind === "spirit" || (gem.spirit_cost ?? 0) > 0) {
    const spiritLabel = gem.spirit_cost ? ` · ${gem.spirit_cost} Spirit` : "";
    return {
      title: `Uncut Spirit Gem (Tier ${tier}${spiritLabel})`,
      npcName: "Spirit Drop / Cut",
    };
  }
  return {
    title: `Uncut Skill Gem (Tier ${tier})`,
    npcName: "Skill Drop / Cut",
  };
}

/** Converts required PoB 2 gems into tier-ordered Uncut Skill, Spirit, and Support cutting steps. */
export function assignPoe2UncutGems(build: ValidatedPobBuild, adapter: GameAdapter): GemAcquisitionStep[] {
  const gems = adapter.getGems();
  const steps: GemAcquisitionStep[] = [];

  for (const req of build.uniqueRequiredGems) {
    const gem = gems[req.id];
    if (!gem) continue;

    const tier = gem.uncut_tier ?? 1;
    const gemKind = gem.gem_kind ?? (gem.is_support ? "support" : "skill");
    const act = mapRequiredLevelToStageAct(gem.required_level);
    const { title, npcName } = formatUncutStepLabel(gem);

    steps.push({
      id: `poe2_uncut_${gemKind}_t${tier}_${gem.id}`,
      gemId: gem.id,
      gemName: gem.name,
      attribute: gem.primary_attribute,
      requiredLevel: gem.required_level,
      isSupport: gem.is_support,
      acquisitionType: "FREE_QUEST_REWARD",
      questId: `poe2_t${tier}`,
      questName: title,
      act,
      npcName,
      currencyCost: "free",
      count: req.count,
      note: req.note,
      gemKind,
      uncutTier: tier,
      ...(gem.spirit_cost ? { spiritCost: gem.spirit_cost } : {}),
      verifiedByApi: false,
      softAcquired: false,
      manualCompleted: false,
    });
  }

  return steps.sort(
    (a, b) =>
      a.act - b.act ||
      (a.uncutTier ?? 1) - (b.uncutTier ?? 1) ||
      a.requiredLevel - b.requiredLevel ||
      a.gemName.localeCompare(b.gemName),
  );
}
