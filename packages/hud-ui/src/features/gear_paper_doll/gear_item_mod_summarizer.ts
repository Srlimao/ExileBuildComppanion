import type { TargetItemSlotSummary } from "@exile-hud/core";

export interface GearSlotDisplaySummary {
  primaryLabel: string;
  secondaryLabel: string | null;
  isUnique: boolean;
}

const SPECIAL_SKILL_PATTERNS: readonly RegExp[] = [
  /^Grants Skill:\s*(?:Level \d+\s+)?(.+)$/i,
  /^Grants Level \d+\s+(.+?)(?:\s+Skill)?$/i,
  /^Triggers? Level \d+\s+(.+?)\s+on\b/i,
  /^Curse Enemies with\s+(.+?)\s+on Hit/i,
];

const FLASK_OR_CHARM_TAGS: ReadonlyArray<[RegExp, string]> = [
  [/instant|seething|bubbling/i, "INSTANT"],
  [/enduring|not removed at full mana/i, "ENDURING"],
  [/bleed|corrupted blood|staunching/i, "BLEED"],
  [/freeze|chill|thawing/i, "FREEZE"],
  [/shock|grounding/i, "SHOCK"],
  [/ignite|burn|dousing/i, "IGNITE"],
  [/poison|antidote/i, "POISON"],
  [/curse|warding/i, "CURSE"],
  [/movement speed/i, "MS"],
  [/to armour|increased armour/i, "ARM"],
  [/to evasion|increased evasion/i, "EVA"],
  [/critical strike/i, "CRIT"],
  [/charges|reduced charges/i, "CHARGES"],
  [/increased duration/i, "DUR"],
  [/resistance/i, "RES"],
  [/recovers .* life|maximum life/i, "LIFE"],
  [/recovers .* mana|maximum mana/i, "MANA"],
];

const GEAR_MOD_TAGS: ReadonlyArray<[RegExp, string]> = [
  // Tier 1: Build-critical affixes
  [/\+\d+\s+to Level of .* (?:Skill|Spell|Minion|Fire|Cold|Lightning|Chaos|Physical|Melee|Projectile|Bow)\b/i, "+LVL"],
  [/to Spirit\b/i, "SPIRIT"],
  [/increased Movement Speed\b/i, "MS"],
  [/Chance to Suppress Spell Damage\b/i, "SUPPRESS"],
  [/Critical (?:Strike|Hit)\b/i, "CRIT"],
  [/increased Attack Speed\b/i, "ASPD"],
  [/increased Cast Speed\b/i, "CSPD"],
  [/to Chaos Resistance\b/i, "CHAOS"],
  // Tier 2: Core defense & offense stats
  [/to maximum Life\b/i, "LIFE"],
  [/to maximum Energy Shield\b|increased Energy Shield\b/i, "ES"],
  [/Resistance(?:s)?\b/i, "RES"],
  [/increased .* Damage\b|Adds \d+ to \d+ .* Damage\b/i, "DMG"],
  [/to Armour\b|increased Armour\b/i, "ARM"],
  [/to Evasion\b|increased Evasion\b/i, "EVA"],
  [/Chance to Block\b/i, "BLOCK"],
  [/to (?:Strength|Dexterity|Intelligence|all Attributes)\b/i, "ATTR"],
  [/to maximum Mana\b|Mana Regeneration\b/i, "MANA"],
  [/Regenerate .* Life/i, "REGEN"],
  [/Leeched as/i, "LEECH"],
];

function truncateLabel(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

function extractSpecialSkillSummary(mods: readonly string[]): string | null {
  for (const rawMod of mods) {
    const mod = rawMod.trim();
    for (const pattern of SPECIAL_SKILL_PATTERNS) {
      const match = pattern.exec(mod);
      if (match?.[1]) {
        const skillName = match[1].replace(/\s+Skill$/i, "").trim();
        return truncateLabel(`Skill: ${skillName}`, 22);
      }
    }
  }
  return null;
}

function collectModTags(
  mods: readonly string[],
  rules: ReadonlyArray<[RegExp, string]>,
  maxTags: number,
): string[] {
  const seen = new Set<string>();
  const joinedMods = mods.join("\n");
  for (const [pattern, tag] of rules) {
    if (seen.has(tag)) continue;
    if (pattern.test(joinedMods)) {
      seen.add(tag);
      if (seen.size >= maxTags) break;
    }
  }
  return [...seen];
}

function buildJoinedTagSummary(tags: readonly string[]): string | null {
  if (tags.length === 0) return null;
  let result = tags[0]!;
  for (let i = 1; i < tags.length; i += 1) {
    const next = `${result}+${tags[i]!}`;
    if (next.length > 18 && i >= 2) break;
    result = next;
  }
  return result;
}

/**
 * Formats a paper-doll slot label:
 * - Uniques show their unique `itemName`.
 * - Non-uniques show their `baseType` + 1 prioritized summary line (special skill, critical affix, or `RES+LIFE+DMG` tags).
 */
export function summarizeGearSlotLabel(slot: TargetItemSlotSummary): GearSlotDisplaySummary {
  if (slot.rarity === "unique") {
    return {
      primaryLabel: slot.itemName.trim() || slot.baseType.trim(),
      secondaryLabel: null,
      isUnique: true,
    };
  }

  const baseName = slot.baseType.trim() || slot.itemName.trim();
  const isConsumable = /flask|charm/i.test(`${slot.slotName} ${baseName}`);

  if (isConsumable) {
    const tags = collectModTags(slot.mods, FLASK_OR_CHARM_TAGS, 3);
    const joined = buildJoinedTagSummary(tags);
    if (joined) {
      return { primaryLabel: baseName, secondaryLabel: joined, isUnique: false };
    }
  } else {
    const specialSkill = extractSpecialSkillSummary(slot.mods);
    if (specialSkill) {
      return { primaryLabel: baseName, secondaryLabel: specialSkill, isUnique: false };
    }
    const tags = collectModTags(slot.mods, GEAR_MOD_TAGS, 4);
    const joined = buildJoinedTagSummary(tags);
    if (joined) {
      return { primaryLabel: baseName, secondaryLabel: joined, isUnique: false };
    }
  }

  const fallbackMod = slot.mods.find((m) => m.trim().length > 0);
  return {
    primaryLabel: baseName,
    secondaryLabel: fallbackMod ? truncateLabel(fallbackMod, 22) : null,
    isUnique: false,
  };
}
