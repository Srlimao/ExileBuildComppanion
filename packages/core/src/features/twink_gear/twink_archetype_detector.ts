import type { TwinkArchetypeId } from "@exile-hud/game-data";
import type { TargetItemSetSummary, TargetLinkGroupSummary } from "../protocol/session_room_wire_protocol.js";

const IGNORED_UTILITY_SKILL_REGEX =
  /^(flame dash|frostblink|dash|shield charge|leap slam|whirling blades|steelskin|molten shell|immortal call|arcane cloak|clarity|purity of |determination|grace|discipline|vitality|precision|haste|anger|hatred|wrath|zealotry|malevolence|pride|flesh and stone|blood and sand|herald of (ice|thunder|ash)|skitterbots|summon skitterbots|assassin's mark|sniper's mark|poacher's mark|warlord's mark|flammability|frostbite|conductivity|elemental weakness|despair|vulnerability|punishment|enfeeble|temporal chains|blood rage|berserk|withering step|phase run|convocation|desecrate|bone offering|flesh offering|spirit offering|portal|smoke mine)/i;

const MINION_SKILL_REGEX =
  /\b(summon|raise|raging spirit|absolution|dominating blow|animate|herald of agony|herald of purity|carrion golem|stone golem|chaos golem|flame golem|ice golem|lightning golem|holy relic|blightwell|mirror arrow|blink arrow)\b/i;

const BOW_SKILL_REGEX =
  /\b(arrow|shot|toxic rain|caustic arrow|rain of arrows|ballista|scourge arrow|kinetic blast|power siphon|barrage|elemental hit of the spectrum|artillery ballista|shrapnel ballista|siege ballista|snipe|ensnaring arrow)\b/i;

const MELEE_SKILL_REGEX =
  /\b(strike|slam|sunder|boneshatter|cleave|sweep|cyclone|lacerate|bladestorm|reave|splitting steel|shattering steel|lancing steel|spectral throw|spectral helix|venom gyre|cobra lash|shield crush|volcanic fissure|earthshatter|rage vortex|flicker|double strike|dual strike|frost blades|lightning strike|molten strike|smite|perforate|tectonic slam|ice crash|infernal blow|earthquake|ground slam|heavy strike|glacial hammer|viper strike|pestilent strike|blight)\b/i;

const SPELL_SKILL_REGEX =
  /\b(fireball|rolling magma|magma orb|arc|spark|freezing pulse|ice nova|frostbolt|firestorm|flame wall|righteous fire|ethereal knives|blade vortex|bladefall|blade blast|storm brand|armageddon brand|penance brand|wintertide brand|hexblast|bane|essence drain|contagion|soulrend|detonate dead|volatile dead|cremation|incinerate|scorching ray|flameblast|ball lightning|shock nova|orb of storms|crackling lance|cold snap|vortex|creeping frost|winter orb|eye of winter|forbidden rite|reap|exsanguinate|seismic trap|explosive trap|fire trap|lightning trap|icicle mine|pyroclast mine|stormblast mine|hexblast mine|holy flame totem|freezing pulse totem|shockwave totem|concoction|poisonous concoction|explosive concoction)\b/i;

function hasHollowPalmSignal(itemSets?: TargetItemSetSummary[], equippedItemNames?: string[]): boolean {
  for (const name of equippedItemNames ?? []) {
    const lower = name.toLowerCase();
    if (lower.includes("one with nothing") || lower.includes("hollow palm")) return true;
  }
  for (const set of itemSets ?? []) {
    for (const slot of set.slots) {
      if (/one with nothing|hollow palm/i.test(`${slot.itemName} ${slot.baseType} ${slot.mods.join(" ")}`)) {
        return true;
      }
    }
  }
  return false;
}

function classifyBySkillNames(linkGroups: TargetLinkGroupSummary[]): TwinkArchetypeId | null {
  const counts: Record<Exclude<TwinkArchetypeId, "hollow_palm">, number> = {
    minion: 0,
    bow: 0,
    melee: 0,
    spell: 0,
  };

  for (const group of linkGroups) {
    for (const gem of group.gems) {
      if (gem.isSupport) continue;
      const name = gem.name.trim();
      if (!name || IGNORED_UTILITY_SKILL_REGEX.test(name)) continue;

      if (MINION_SKILL_REGEX.test(name)) counts.minion += 3;
      else if (BOW_SKILL_REGEX.test(name)) counts.bow += 3;
      else if (MELEE_SKILL_REGEX.test(name)) counts.melee += 3;
      else if (SPELL_SKILL_REGEX.test(name)) counts.spell += 3;
      else if (/\b(mine|trap|brand|totem|curse|nova|pulse|bolt|wave|orb|storm|blast|concoction)\b/i.test(name)) {
        counts.spell += 1;
      }
    }
  }

  let best: Exclude<TwinkArchetypeId, "hollow_palm"> | null = null;
  let bestScore = 0;
  for (const key of ["minion", "bow", "melee", "spell"] as const) {
    if (counts[key] > bestScore) {
      bestScore = counts[key];
      best = key;
    }
  }
  return best;
}

function classifyByAscendancyOrClass(characterClass: string, ascendancyName: string): TwinkArchetypeId {
  const asc = ascendancyName.trim().toLowerCase();
  if (asc === "necromancer") return "minion";
  if (asc === "deadeye") return "bow";
  if (asc === "berserker" || asc === "juggernaut" || asc === "slayer" || asc === "gladiator" || asc === "champion") {
    return "melee";
  }
  if (asc === "elementalist" || asc === "occultist" || asc === "hierophant" || asc === "inquisitor") {
    return "spell";
  }

  const cls = characterClass.trim().toLowerCase();
  if (cls === "marauder" || cls === "duelist") return "melee";
  if (cls === "ranger") return "bow";
  return "spell";
}

/** Infers the leveling twink gear archetype from PoB skills, Hollow Palm signals, ascendancy, and class. */
export function detectTwinkArchetype(params: {
  characterClass: string;
  ascendancyName: string;
  linkGroups: TargetLinkGroupSummary[];
  itemSets?: TargetItemSetSummary[];
  equippedItemNames?: string[];
}): TwinkArchetypeId {
  if (hasHollowPalmSignal(params.itemSets, params.equippedItemNames)) {
    return "hollow_palm";
  }
  const bySkills = classifyBySkillNames(params.linkGroups);
  if (bySkills) return bySkills;
  return classifyByAscendancyOrClass(params.characterClass, params.ascendancyName);
}
