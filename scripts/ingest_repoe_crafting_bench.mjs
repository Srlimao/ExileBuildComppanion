import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOE_BASE = "https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data";

const CURRENCY_NAME_BY_KEY = {
  "Metadata/Items/Currency/CurrencyUpgradeToMagic": "Orb of Transmutation",
  "Metadata/Items/Currency/CurrencyAddModToMagic": "Orb of Augmentation",
  "Metadata/Items/Currency/CurrencyRerollMagic": "Orb of Alteration",
  "Metadata/Items/Currency/CurrencyUpgradeRandomly": "Orb of Chance",
  "Metadata/Items/Currency/CurrencyUpgradeToRare": "Orb of Alchemy",
  "Metadata/Items/Currency/CurrencyRerollRare": "Chaos Orb",
  "Metadata/Items/Currency/CurrencyAddModToRare": "Exalted Orb",
};

const SLOT_MAP_BY_ITEM_CLASS = {
  Helmet: ["Helm"],
  "Body Armour": ["BodyArmour"],
  Gloves: ["Gloves"],
  Boots: ["Boots"],
  Belt: ["Belt"],
  Amulet: ["Amulet"],
  Ring: ["Ring", "Ring2"],
  Shield: ["Offhand"],
};

const CATEGORY_FORMAT = {
  fire_res: (min, max) => ({ label: `${min}-${max}% Fire Res`, modText: `+(${min}-${max})% to Fire Resistance` }),
  cold_res: (min, max) => ({ label: `${min}-${max}% Cold Res`, modText: `+(${min}-${max})% to Cold Resistance` }),
  lightning_res: (min, max) => ({ label: `${min}-${max}% Lightning Res`, modText: `+(${min}-${max})% to Lightning Resistance` }),
  fire_cold_res: (min, max) => ({ label: `${min}-${max}% Fire & Cold Res`, modText: `+(${min}-${max})% to Fire and Cold Resistances` }),
  cold_lightning_res: (min, max) => ({ label: `${min}-${max}% Cold & Lightning Res`, modText: `+(${min}-${max})% to Cold and Lightning Resistances` }),
  fire_lightning_res: (min, max) => ({ label: `${min}-${max}% Fire & Lightning Res`, modText: `+(${min}-${max})% to Fire and Lightning Resistances` }),
  all_ele_res: (min, max) => ({ label: `+${min}-${max}% All Elemental Res`, modText: `+(${min}-${max})% to all Elemental Resistances` }),
  chaos_res: (min, max, modId) => {
    const ele = /Fire/i.test(modId) ? "Fire" : /Cold/i.test(modId) ? "Cold" : "Lightning";
    return { label: `${min}-${max}% ${ele} & Chaos Res`, modText: `+(${min}-${max})% to ${ele} and Chaos Resistances` };
  },
  movement_speed: (min, max) => ({ label: `${min}-${max}% Movement Speed`, modText: `(${min}-${max})% increased Movement Speed` }),
  life: (min, max) => ({ label: `+${min}-${max} Maximum Life`, modText: `+(${min}-${max}) to maximum Life` }),
  strength: (min, max) => ({ label: `+${min}-${max} Strength`, modText: `+(${min}-${max}) to Strength` }),
  dexterity: (min, max) => ({ label: `+${min}-${max} Dexterity`, modText: `+(${min}-${max}) to Dexterity` }),
  intelligence: (min, max) => ({ label: `+${min}-${max} Intelligence`, modText: `+(${min}-${max}) to Intelligence` }),
  all_attributes: (min, max) => ({ label: `+${min}-${max} All Attributes`, modText: `+(${min}-${max}) to all Attributes` }),
};

const CURATED_RECIPES = [
  ["HelenaMasterFireResist1", "fire_res", null, "Hideout Crafting Bench (Helena)", 2],
  ["HelenaMasterColdResist1_", "cold_res", null, "Hideout Crafting Bench (Helena)", 2],
  ["HelenaMasterLightningResist1", "lightning_res", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterFireResist2", "fire_res", "1_4_6_2", "Elemental Resistances - Rank 2", 4],
  ["EinharMasterColdResist2", "cold_res", "1_4_6_2", "Elemental Resistances - Rank 2", 4],
  ["EinharMasterLightningResist2", "lightning_res", "1_4_6_2", "Elemental Resistances - Rank 2", 4],
  ["EinharMasterFireResist3_", "fire_res", "2_8_2_2", "Elemental Resistances - Rank 3", 8],
  ["EinharMasterColdResist3__", "cold_res", "2_8_2_2", "Elemental Resistances - Rank 3", 8],
  ["EinharMasterLightningResist3_", "lightning_res", "2_8_2_2", "Elemental Resistances - Rank 3", 8],
  ["EinharMasterFireAndColdResist1", "fire_cold_res", "2_6_7_1", "Double Resistances - Rank 1", 6],
  ["EinharMasterColdAndLightningResist1_", "cold_lightning_res", "2_6_7_1", "Double Resistances - Rank 1", 6],
  ["EinharMasterFireAndLightningResist1", "fire_lightning_res", "2_6_7_1", "Double Resistances - Rank 1", 6],
  ["EinharMasterFireAndColdResist2", "fire_cold_res", "2_Labyrinth_boss_3", "Double Resistances - Rank 2", 7],
  ["EinharMasterColdAndLightningResist2", "cold_lightning_res", "2_Labyrinth_boss_3", "Double Resistances - Rank 2", 7],
  ["EinharMasterFireAndLightningResist2", "fire_lightning_res", "2_Labyrinth_boss_3", "Double Resistances - Rank 2", 7],
  ["EinharMasterFireAndColdResist3", "fire_cold_res", "3_Labyrinth_boss_3", "Double Resistances - Rank 3", 10],
  ["EinharMasterColdAndLightningResist3_", "cold_lightning_res", "3_Labyrinth_boss_3", "Double Resistances - Rank 3", 10],
  ["EinharMasterFireAndLightningResist3_", "fire_lightning_res", "3_Labyrinth_boss_3", "Double Resistances - Rank 3", 10],
  ["EinharMasterAllResist1", "all_ele_res", "1_Labyrinth_boss_3", "All Resistances - Rank 1", 3],
  ["EinharMasterAllResist2", "all_ele_res", "EndGame_Labyrinth_boss_3", "All Resistances - Rank 2", 11],
  ["JunMaster2FireAndChaosDamageResistance1_", "chaos_res", null, "Veiled Chaos Resistance - Rank 1", 9],
  ["JunMaster2ColdAndChaosDamageResistance1_", "chaos_res", null, "Veiled Chaos Resistance - Rank 1", 9],
  ["JunMaster2LightningAndChaosDamageResistance1", "chaos_res", null, "Veiled Chaos Resistance - Rank 1", 9],
  ["EinharMasterMovementVelocity1", "movement_speed", "1_3_1", "Movement Speed - Rank 1", 3],
  ["EinharMasterMovementVelocity2", "movement_speed", "1_5_5", "Movement Speed and Exerted Attacks - Rank 2", 5],
  ["EinharMasterMovementVelocity3", "movement_speed", "2_11_endgame_town", "Movement Speed and Flask Enchantments - Rank 3", 11],
  ["HelenaMasterIncreasedLife1", "life", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterIncreasedLife2", "life", "2_6_14", "Life and Mana - Rank 2", 6],
  ["EinharMasterIncreasedLife3", "life", "2_10_6", "Life and Mana - Rank 3", 10],
  ["HelenaMasterStrength1", "strength", null, "Hideout Crafting Bench (Helena)", 2],
  ["HelenaMasterDexterity1", "dexterity", null, "Hideout Crafting Bench (Helena)", 2],
  ["HelenaMasterIntelligence1", "intelligence", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterStrength2", "strength", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterDexterity2", "dexterity", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterIntelligence2__", "intelligence", null, "Hideout Crafting Bench (Helena)", 2],
  ["EinharMasterStrength3", "strength", "2_6_9", "Attributes - Rank 2", 6],
  ["EinharMasterDexterity3", "dexterity", "2_6_9", "Attributes - Rank 2", 6],
  ["EinharMasterIntelligence3", "intelligence", "2_6_9", "Attributes - Rank 2", 6],
  ["EinharMasterAllAttributes1", "all_attributes", "1_3_15", "All Attributes - Rank 1", 3],
  ["EinharMasterAllAttributes2", "all_attributes", "2_9_7", "All Attributes - Rank 2", 9],
];

async function loadOrFetchRepoeJson(rootDir, fileName) {
  const cacheDir = path.join(rootDir, ".upstream-cache", "repoe");
  const cachePath = path.join(cacheDir, fileName);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const response = await fetch(`${REPOE_BASE}/${fileName}`, {
    headers: { "User-Agent": "exile-companion-hud-ingestor" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch RePoE ${fileName}: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text);
}

function mapCompatibleSlots(itemClasses) {
  const slots = new Set();
  for (const itemClass of itemClasses ?? []) {
    const mapped = SLOT_MAP_BY_ITEM_CLASS[itemClass];
    if (!mapped) continue;
    for (const slot of mapped) slots.add(slot);
  }
  return [...slots];
}

function resolveCurrencyCost(costMap) {
  const entries = Object.entries(costMap ?? {});
  if (entries.length === 0) {
    throw new Error("Missing cost entry in RePoE crafting bench recipe.");
  }
  const [rawKey, rawCount] = entries[0];
  const currency = CURRENCY_NAME_BY_KEY[rawKey];
  if (!currency) {
    throw new Error(`Unmapped RePoE currency key: ${rawKey}`);
  }
  const count = Number(rawCount);
  return { costCurrency: currency, costCount: count, costLabel: `${count}x ${currency}` };
}

/** Downloads/parses RePoE crafting bench options & mods into compact campaign bench recipes JSON. */
export async function ingestRepoeCraftingBench(rootDir = process.cwd()) {
  const [benchOptions, modsById] = await Promise.all([
    loadOrFetchRepoeJson(rootDir, "crafting_bench_options.min.json"),
    loadOrFetchRepoeJson(rootDir, "mods.min.json"),
  ]);
  const optionByModId = new Map();
  for (const opt of benchOptions) {
    const modId = opt?.actions?.add_explicit_mod;
    if (modId) optionByModId.set(modId, opt);
  }

  const normalized = [];
  for (const [modId, category, unlockAreaId, unlockRecipeName, unlockAct] of CURATED_RECIPES) {
    const opt = optionByModId.get(modId);
    const mod = modsById[modId];
    if (!opt || !mod) {
      throw new Error(`Missing RePoE crafting bench entry or mod definition for "${modId}".`);
    }
    const stat = mod.stats?.[0];
    if (!stat) {
      throw new Error(`Missing stat entry on RePoE mod "${modId}".`);
    }
    const minVal = Number(stat.min);
    const maxVal = Number(stat.max);
    const formatted = CATEGORY_FORMAT[category](minVal, maxVal, modId);
    const cost = resolveCurrencyCost(opt.cost);
    const compatibleSlots = mapCompatibleSlots(opt.item_classes);
    if (compatibleSlots.length === 0) {
      throw new Error(`No compatible equipment slots mapped for RePoE recipe "${modId}".`);
    }
    normalized.push({
      id: modId,
      category,
      label: formatted.label,
      modTextTemplate: formatted.modText,
      affixType: mod.generation_type === "prefix" ? "prefix" : "suffix",
      benchTier: Number(opt.bench_tier ?? 1),
      requiredLevel: Number(mod.required_level ?? 1),
      minVal,
      maxVal,
      ...cost,
      compatibleSlots,
      unlockAreaId,
      unlockRecipeName,
      unlockAct,
    });
  }

  const outDir = path.join(rootDir, "packages", "game-data", "data", "poe1");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "crafting_bench_recipes.json"), JSON.stringify(normalized, null, 2));
  return { recipeCount: normalized.length };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestRepoeCraftingBench()
    .then((res) => console.log(`Ingested ${res.recipeCount} PoE1 campaign bench recipes from RePoE.`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
