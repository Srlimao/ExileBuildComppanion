import type { SupportedGameId } from "@exile-hud/game-data";
import type {
  BuildDamageTag,
  BuildGoalTag,
  BuildPlaystyleTag,
} from "./build_catalog_schema.js";

export interface ClassCatalogDefinition {
  baseClass: string;
  ascendancies: readonly string[];
}

export const POE1_CLASS_CATALOG: readonly ClassCatalogDefinition[] = [
  { baseClass: "Marauder", ascendancies: ["Juggernaut", "Berserker", "Chieftain"] },
  { baseClass: "Ranger", ascendancies: ["Deadeye", "Warden", "Pathfinder"] },
  { baseClass: "Witch", ascendancies: ["Necromancer", "Elementalist", "Occultist"] },
  { baseClass: "Duelist", ascendancies: ["Slayer", "Gladiator", "Champion"] },
  { baseClass: "Templar", ascendancies: ["Inquisitor", "Hierophant", "Guardian"] },
  { baseClass: "Shadow", ascendancies: ["Assassin", "Saboteur", "Trickster"] },
  { baseClass: "Scion", ascendancies: ["Ascendant"] },
];

export const POE2_CLASS_CATALOG: readonly ClassCatalogDefinition[] = [
  { baseClass: "Warrior", ascendancies: ["Titan", "Warbringer", "Smith of Kitava"] },
  { baseClass: "Ranger", ascendancies: ["Deadeye", "Pathfinder"] },
  { baseClass: "Huntress", ascendancies: ["Amazon", "Ritualist"] },
  { baseClass: "Mercenary", ascendancies: ["Witchhunter", "Gemling Legionnaire", "Tactician"] },
  { baseClass: "Monk", ascendancies: ["Invoker", "Acolyte of Chayula", "Martial Artist"] },
  { baseClass: "Sorceress", ascendancies: ["Stormweaver", "Chronomancer", "Disciple of Varashta"] },
  { baseClass: "Witch", ascendancies: ["Blood Mage", "Infernalist", "Lich"] },
  { baseClass: "Druid", ascendancies: ["Shaman", "Oracle", "Spirit Walker"] },
];

export function getClassCatalogForGame(gameId: SupportedGameId): readonly ClassCatalogDefinition[] {
  return gameId === "poe2" ? POE2_CLASS_CATALOG : POE1_CLASS_CATALOG;
}

function cleanClassToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^poe2?[/-]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function toTitleCase(raw: string): string {
  return raw
    .trim()
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === "of" ? "of" : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/** Resolves heterogeneous class/ascendancy slugs or display names into canonical PoE baseClass & ascendancy. */
export function normalizeClassAndAscendancy(
  gameId: SupportedGameId,
  rawTokens: readonly string[],
): { baseClass: string; ascendancy: string } {
  const catalog = getClassCatalogForGame(gameId);
  const cleaned = rawTokens.map(cleanClassToken).filter(Boolean);
  let baseClass = "";
  let ascendancy = "";

  for (const token of cleaned) {
    for (const def of catalog) {
      for (const asc of def.ascendancies) {
        if (token === asc.toLowerCase() || token.includes(asc.toLowerCase())) {
          ascendancy = asc;
          baseClass = def.baseClass;
          break;
        }
      }
      if (ascendancy) break;
    }
    if (ascendancy) break;
  }

  if (!baseClass) {
    for (const token of cleaned) {
      const matchedBase = catalog.find(
        (def) => token === def.baseClass.toLowerCase() || token.includes(def.baseClass.toLowerCase()),
      );
      if (matchedBase) {
        baseClass = matchedBase.baseClass;
        break;
      }
    }
  }

  if (!ascendancy) {
    const unknownAsc = cleaned.find((t) => t !== "misc" && t !== "tier list" && t !== baseClass.toLowerCase());
    if (unknownAsc && !baseClass) {
      return { baseClass: "Unknown", ascendancy: toTitleCase(unknownAsc) };
    }
  }

  return {
    baseClass: baseClass || "Unknown",
    ascendancy,
  };
}

const PLAYSTYLE_RULES: ReadonlyArray<{ tag: BuildPlaystyleTag; pattern: RegExp }> = [
  { tag: "minion", pattern: /\b(minion|minions|necromancer|golem|golems|spectre|spectres|zombie|zombies|skeleton|skeletons|srs|raging spirit|animate weapon|herald of agony|hoag|phantasm|djinn|domination)\b/i },
  { tag: "totem_brand", pattern: /\b(totem|totems|ballista|ballistas|hierophant|brand|brands|storm brand|penance brand|armageddon brand)\b/i },
  { tag: "trap_mine", pattern: /\b(trap|traps|mine|mines|miner|trapper|saboteur|seismic|hexblast|pyroclast|exsang)\b/i },
  { tag: "dot_rf", pattern: /\b(righteous fire|\brf\b|\bdot\b|damage over time|poison|bleed|ignite|burning|viper strike|toxic rain|caustic|essence drain|bane|blight|death's oath)\b/i },
  { tag: "trigger", pattern: /\b(cast on crit|\bcoc\b|cast while channelling|\bcwc\b|wardloop|mjolner|cospri|flicker|trigger|auto[- ]?bomber)\b/i },
  { tag: "melee", pattern: /\b(melee|slam|slams|strike|cyclone|boneshatter|lacerate|molten strike|lightning strike|smite|cleave|sunder|earthshatter|bladestorm|rage vortex|shield crush|shield charge|hollow palm|tempest|ice strike|quarterstaff|mace)\b/i },
  { tag: "ranged", pattern: /\b(bow|ranged|arrow|shot|wand|wander|kinetic|crossbow|galvanic|lightning arrow|tornado shot|rain of arrows|splitting steel|lancing steel|shattering steel|spectral throw)\b/i },
  { tag: "caster", pattern: /\b(caster|spell|spells|self[- ]?cast|arc|spark|ball lightning|fireball|frostbolt|ice nova|winter orb|vortex|blade vortex|\bbv\b|detonate dead|\bdd\b|cremation|forbidden rite|divine ire|divine blast|wave|curse)\b/i },
];

const GOAL_RULES: ReadonlyArray<{ tag: BuildGoalTag; pattern: RegExp }> = [
  { tag: "league_starter", pattern: /\b(league[- ]?start(?:er)?|starter|zero to hero|leveling|fresh start|day 1|act 1)\b/i },
  { tag: "endgame", pattern: /\b(endgame|end[- ]?game|min[- ]?max|mirror|t17|high investment|all content)\b/i },
  { tag: "bosser", pattern: /\b(boss(?:er|ing)?|uber|ubers|pinnacle|single target|maven|sirus)\b/i },
  { tag: "mapper", pattern: /\b(map(?:per|ping)?|clear|speed|delirium|breach|legion|blaster|zoom)\b/i },
  { tag: "ssf_friendly", pattern: /\b(ssf|solo self[- ]?found|no unique)\b/i },
  { tag: "hc_friendly", pattern: /\b(\bhc\b|hardcore|tank|tanky|immortal|max block)\b/i },
  { tag: "budget", pattern: /\b(budget|cheap|low budget|1 div|chaos|starter friendly)\b/i },
];

const DAMAGE_RULES: ReadonlyArray<{ tag: BuildDamageTag; pattern: RegExp }> = [
  { tag: "fire", pattern: /\b(fire|ignite|burn|rf|righteous fire|chieftain|infernal)\b/i },
  { tag: "cold", pattern: /\b(cold|frost|ice|freeze|chill|winter|glacial)\b/i },
  { tag: "lightning", pattern: /\b(lightning|shock|arc|spark|storm|tempest|galvanic)\b/i },
  { tag: "chaos", pattern: /\b(chaos|poison|toxic|wither|occultist|blight|ed|forbidden rite)\b/i },
  { tag: "physical", pattern: /\b(phys|physical|bleed|impale|slayer|boneshatter)\b/i },
  { tag: "elemental", pattern: /\b(elemental|trinity|ele|omniscient)\b/i },
];

/** Normalizes heterogeneous tags, titles, and taxonomy tokens into canonical build catalog tags. */
export function normalizeBuildTags(
  rawText: string,
  rawTokens: readonly string[] = [],
): {
  playstyleTags: BuildPlaystyleTag[];
  goalTags: BuildGoalTag[];
  damageTags: BuildDamageTag[];
} {
  const combined = `${rawText} ${rawTokens.join(" ")}`.replace(/[-_]+/g, " ");
  const playstyleTags = PLAYSTYLE_RULES.filter((r) => r.pattern.test(combined)).map((r) => r.tag);
  const goalTags = GOAL_RULES.filter((r) => r.pattern.test(combined)).map((r) => r.tag);
  const damageTags = DAMAGE_RULES.filter((r) => r.pattern.test(combined)).map((r) => r.tag);
  return { playstyleTags, goalTags, damageTags };
}

/** Extracts a normalized patch version such as "3.30" or "0.5" from heterogeneous league/tag labels. */
export function extractPatchVersion(rawStrings: readonly string[]): string {
  for (const raw of rawStrings) {
    const dotted = /(?:^|[^\d])(\d+\.\d{1,2})(?:\.\d+)?(?:$|[^\d])/.exec(raw);
    if (dotted?.[1]) return dotted[1];
    const dashed = /(?:^|[-_])(\d+)-(\d{1,2})(?:-\d+)?(?:$|[-_])/.exec(raw);
    if (dashed?.[1] && dashed[2]) return `${dashed[1]}.${dashed[2]}`;
  }
  return "";
}
