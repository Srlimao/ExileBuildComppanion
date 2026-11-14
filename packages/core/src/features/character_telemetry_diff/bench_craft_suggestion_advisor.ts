import type { BenchCraftCategory, BenchEquipSlot, CraftingBenchRecipe, GameAdapter } from "@exile-hud/game-data";
import type {
  BenchCraftSuggestion,
  CheckpointStepItem,
  ResistanceTelemetry,
} from "../protocol/session_room_wire_protocol.js";
import type { GggItemModRecord } from "./equipped_resistance_estimator.js";
import {
  inspectCraftableGearSlots,
  SLOT_DISPLAY_LABEL,
  SLOT_PREFERENCE_ORDER,
  type CraftableSlotInspection,
} from "./gear_affix_slot_inspector.js";

export { inspectCraftableGearSlots, type CraftableSlotInspection } from "./gear_affix_slot_inspector.js";

type ResistanceElement = "fire" | "cold" | "lightning" | "chaos";
type AttributeKind = "strength" | "dexterity" | "intelligence";

const RESISTANCE_CONTRIBUTIONS: Readonly<Partial<Record<BenchCraftCategory, ResistanceElement[]>>> = {
  fire_res: ["fire"],
  cold_res: ["cold"],
  lightning_res: ["lightning"],
  chaos_res: ["chaos"],
  fire_cold_res: ["fire", "cold"],
  cold_lightning_res: ["cold", "lightning"],
  fire_lightning_res: ["fire", "lightning"],
  all_ele_res: ["fire", "cold", "lightning"],
};

const ELEM_LABEL: Record<ResistanceElement, string> = {
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
  chaos: "Chaos",
};

const ATTR_LABEL: Record<AttributeKind, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence",
};

/** Determines whether a Crafting Bench recipe is unlocked for the character's current campaign progress. */
export function isBenchRecipeUnlocked(
  recipe: CraftingBenchRecipe,
  params: {
    highestUnlockedAct: number;
    clearedAreaIds?: readonly string[];
    checkpoints?: readonly CheckpointStepItem[];
  },
): boolean {
  const { highestUnlockedAct, clearedAreaIds, checkpoints } = params;
  if (highestUnlockedAct < 2 && !clearedAreaIds?.includes("1_2_6_2")) return false;
  if (recipe.unlockAreaId === null) return highestUnlockedAct >= recipe.unlockAct;

  if (clearedAreaIds?.includes(recipe.unlockAreaId)) return true;
  if (checkpoints?.some((cp) => cp.areaId === recipe.unlockAreaId && (cp.completed || cp.softCompleted))) {
    return true;
  }
  if (/_Labyrinth_boss_/i.test(recipe.unlockAreaId)) return false;

  const hasAreaTelemetry =
    Boolean(clearedAreaIds && clearedAreaIds.length > 0) ||
    Boolean(checkpoints?.some((cp) => cp.completed || cp.softCompleted));
  return hasAreaTelemetry ? highestUnlockedAct > recipe.unlockAct : highestUnlockedAct >= recipe.unlockAct;
}

function pickBestSlotAndRecipe(params: {
  eligibleSlots: CraftableSlotInspection[];
  recipes: CraftingBenchRecipe[];
  affixType: "prefix" | "suffix";
  characterLevel: number;
  usedSlots: Set<BenchEquipSlot>;
  scoreRecipe: (recipe: CraftingBenchRecipe, slot: CraftableSlotInspection) => number;
}): { slot: CraftableSlotInspection; recipe: CraftingBenchRecipe } | null {
  const { eligibleSlots, recipes, affixType, characterLevel, usedSlots, scoreRecipe } = params;
  let best: { slot: CraftableSlotInspection; recipe: CraftingBenchRecipe; score: number } | null = null;

  for (const slot of eligibleSlots) {
    if (usedSlots.has(slot.slot)) continue;
    if (affixType === "prefix" ? !slot.openPrefix : !slot.openSuffix) continue;

    for (const recipe of recipes) {
      if (recipe.affixType !== affixType) continue;
      if (!recipe.compatibleSlots.includes(slot.slot)) continue;
      if (slot.effectiveIlvl < recipe.requiredLevel || characterLevel < recipe.requiredLevel) continue;
      if (slot.existingCategories.has(recipe.category)) continue;

      const baseScore = scoreRecipe(recipe, slot);
      if (baseScore <= 0) continue;
      const rarityBonus = slot.rarity === "rare" ? 0.5 : 0;
      const slotBonus = (SLOT_PREFERENCE_ORDER.length - SLOT_PREFERENCE_ORDER.indexOf(slot.slot)) * 0.01;
      const totalScore = baseScore + rarityBonus + slotBonus;
      if (!best || totalScore > best.score) {
        best = { slot, recipe, score: totalScore };
      }
    }
  }

  return best ? { slot: best.slot, recipe: best.recipe } : null;
}

function formatSuggestion(
  id: string,
  priority: "high" | "medium",
  problemSummary: string,
  slot: BenchEquipSlot,
  recipe: CraftingBenchRecipe,
): BenchCraftSuggestion {
  const slotLabel = SLOT_DISPLAY_LABEL[slot];
  return {
    id,
    priority,
    problemSummary,
    prescription: `Craft ${recipe.label} on ${slotLabel} (${recipe.costLabel})`,
    slot,
    recipeId: recipe.id,
    recipeLabel: recipe.label,
    costLabel: recipe.costLabel,
    affixType: recipe.affixType,
  };
}

/** Computes actionable Crafting Bench prescriptions from live gear, deficits, and unlocked recipes. */
export function computeBenchCraftSuggestions(params: {
  items: GggItemModRecord[];
  resistances: ResistanceTelemetry;
  characterLevel: number;
  highestUnlockedAct: number;
  clearedAreaIds?: readonly string[];
  checkpoints?: readonly CheckpointStepItem[];
  attributeDeficits?: Partial<Record<AttributeKind, number>>;
  adapter: GameAdapter;
}): BenchCraftSuggestion[] {
  const { items, resistances, characterLevel, highestUnlockedAct, clearedAreaIds, checkpoints, attributeDeficits, adapter } =
    params;
  if (items.length === 0) return [];

  const unlockedRecipes = adapter
    .getCraftingBenchRecipes()
    .filter((recipe) => isBenchRecipeUnlocked(recipe, { highestUnlockedAct, clearedAreaIds, checkpoints }));
  if (unlockedRecipes.length === 0) return [];

  const eligibleSlots = inspectCraftableGearSlots(items, characterLevel).filter((s) => s.craftedModCount === 0);
  if (eligibleSlots.length === 0) return [];

  const suggestions: BenchCraftSuggestion[] = [];
  const usedPrefixSlots = new Set<BenchEquipSlot>();
  const usedSuffixSlots = new Set<BenchEquipSlot>();

  if (highestUnlockedAct >= 3) {
    const boots = eligibleSlots.find((s) => s.slot === "Boots");
    if (boots && !boots.existingCategories.has("movement_speed")) {
      const msPick = pickBestSlotAndRecipe({
        eligibleSlots: [boots],
        recipes: unlockedRecipes.filter((r) => r.category === "movement_speed"),
        affixType: "prefix",
        characterLevel,
        usedSlots: usedPrefixSlots,
        scoreRecipe: (recipe) => recipe.maxVal * 10,
      });
      if (msPick) {
        usedPrefixSlots.add(msPick.slot.slot);
        suggestions.push(
          formatSuggestion("bench_boots_ms", "high", "Boots have 0% Movement Speed", msPick.slot.slot, msPick.recipe),
        );
      }
    }
  }

  const remainingDeficits: Record<ResistanceElement, number> = {
    fire: Math.max(0, resistances.fire.target - resistances.fire.actual),
    cold: Math.max(0, resistances.cold.target - resistances.cold.actual),
    lightning: Math.max(0, resistances.lightning.target - resistances.lightning.actual),
    chaos: Math.max(0, resistances.chaos.target - resistances.chaos.actual),
  };

  const sortedElems = (Object.keys(remainingDeficits) as ResistanceElement[]).sort(
    (a, b) => remainingDeficits[b] - remainingDeficits[a],
  );
  for (const elem of sortedElems) {
    const deficit = remainingDeficits[elem];
    if (deficit <= 0) continue;

    const pick = pickBestSlotAndRecipe({
      eligibleSlots,
      recipes: unlockedRecipes,
      affixType: "suffix",
      characterLevel,
      usedSlots: usedSuffixSlots,
      scoreRecipe: (recipe) => {
        const elems = RESISTANCE_CONTRIBUTIONS[recipe.category] ?? [];
        if (!elems.includes(elem)) return 0;
        const useful = elems.reduce((sum, e) => sum + Math.min(recipe.maxVal, remainingDeficits[e]), 0);
        const activeCovered = elems.filter((e) => remainingDeficits[e] > 0).length;
        return useful * 10 + (activeCovered >= 2 ? 25 : 0) + recipe.benchTier;
      },
    });
    if (!pick) continue;

    usedSuffixSlots.add(pick.slot.slot);
    for (const covered of RESISTANCE_CONTRIBUTIONS[pick.recipe.category] ?? []) {
      remainingDeficits[covered] = Math.max(0, remainingDeficits[covered] - pick.recipe.maxVal);
    }
    suggestions.push(
      formatSuggestion(
        `bench_res_${elem}_${pick.slot.slot}`,
        "high",
        `${ELEM_LABEL[elem]} Res -${deficit}% under cap`,
        pick.slot.slot,
        pick.recipe,
      ),
    );
  }

  for (const attr of ["strength", "dexterity", "intelligence"] as const) {
    const deficit = Math.max(0, attributeDeficits?.[attr] ?? 0);
    if (deficit <= 0) continue;
    const pick = pickBestSlotAndRecipe({
      eligibleSlots,
      recipes: unlockedRecipes,
      affixType: "suffix",
      characterLevel,
      usedSlots: usedSuffixSlots,
      scoreRecipe: (recipe) => {
        if (recipe.category !== attr && recipe.category !== "all_attributes") return 0;
        return Math.min(recipe.maxVal, deficit) * 10 + (recipe.category === attr ? 5 : 0) + recipe.benchTier;
      },
    });
    if (!pick) continue;
    usedSuffixSlots.add(pick.slot.slot);
    suggestions.push(
      formatSuggestion(
        `bench_attr_${attr}_${pick.slot.slot}`,
        "medium",
        `Missing ${deficit} ${ATTR_LABEL[attr]}`,
        pick.slot.slot,
        pick.recipe,
      ),
    );
  }

  return suggestions;
}
