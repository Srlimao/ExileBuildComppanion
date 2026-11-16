# `twink_gear` Domain

Pure recommendation and timeline engine for leveling twink gear in Path of Exile 1.

## Responsibilities
- **Archetype Detection (`twink_archetype_detector.ts`):** Infers `"spell" | "bow" | "melee" | "minion" | "hollow_palm"` from loaded PoB `linkGroups`, `ascendancyName`, `itemSets` (e.g., `One With Nothing`), `equippedItemNames`, and `characterClass` fallback.
- **Leveling Timeline (`twink_gear_recommender.ts`):**
  - Filters curated PoE 1 twink uniques (`GameAdapter.getTwinkGearCatalog()`) by universal + active archetype, enforcing the `Unencumbered` rule (`Weapon`, `Offhand`, `Gloves` omitted) when `hollow_palm` is active.
  - Merges leveling Unique items (`rarity === "unique" && levelReq <= 67`) from imported PoB `itemSets`, tagging them `inPobPlan: true` and resolving official 2D art URLs via `GameAdapter.resolveOfficialUniqueIconUrl()`.
  - Groups items into 5 level brackets (`Lv 1`, `Lv 4–9`, `Lv 10–16`, `Lv 18–25`, `Lv 28+`), computes `activeBracketId` from `characterLevel`, tracks live `equipped` state from `equippedItemNames` / `verifiedEquipped`, and generates a compact `<= 240`-character PoE Stash search regex for unequipped items.
