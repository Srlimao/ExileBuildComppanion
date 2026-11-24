import type { GameAdapter } from "@exile-hud/game-data";
import type {
  CheckpointStepItem,
  HudSessionSnapshot,
  Poe2PermanentBonusState,
  Poe2RuneHintItem,
  Poe2SpiritSummary,
  ResistanceTelemetry,
} from "../protocol/session_room_wire_protocol.js";
import { buildVendorSearchRegex } from "../vendor_regex/vendor_search_regex_builder.js";

const CAMPAIGN_GUARANTEED_SPIRIT = 100;

function extractNumericSpiritGrant(summary: string): number {
  const match = /\+(\d+)/.exec(summary);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

/** Computes PoE 2 permanent campaign boss/quest bonus completion states from cleared zones and checkpoints. */
export function computePoe2PermanentBonusStates(
  adapter: GameAdapter,
  clearedAreaIds: readonly string[],
  checkpoints: readonly CheckpointStepItem[],
): Poe2PermanentBonusState[] {
  const clearedSet = new Set(clearedAreaIds);
  const completedAreas = new Set<string>();
  for (const cp of checkpoints) {
    if (cp.completed || cp.softCompleted) completedAreas.add(cp.areaId);
  }

  return adapter.getPermanentCampaignBonuses().map((bonus) => ({
    id: bonus.id,
    act: bonus.act,
    areaId: bonus.areaId,
    bossOrQuestName: bonus.bossOrQuestName,
    rewardLabel: bonus.rewardLabelEn,
    bonusType: bonus.bonusType,
    valueSummary: bonus.valueSummary,
    completed: clearedSet.has(bonus.areaId) || completedAreas.has(bonus.areaId),
  }));
}

/** Computes Spirit budget summary (required Spirit gems vs unlocked permanent campaign Spirit). */
export function computePoe2SpiritSummary(
  gemSteps: HudSessionSnapshot["gemSteps"],
  permanentBonuses: readonly Poe2PermanentBonusState[],
): Poe2SpiritSummary {
  let requiredSpirit = 0;
  for (const step of gemSteps) {
    if ((step.spiritCost ?? 0) > 0) {
      requiredSpirit += step.spiritCost ?? 0;
    }
  }

  let unlockedSpirit = 0;
  for (const bonus of permanentBonuses) {
    if (bonus.completed && bonus.bonusType === "spirit") {
      unlockedSpirit += extractNumericSpiritGrant(bonus.valueSummary);
    }
  }

  return {
    requiredSpirit,
    unlockedSpirit,
    campaignGuaranteedSpirit: CAMPAIGN_GUARANTEED_SPIRIT,
  };
}

/** Prioritizes PoE 2 Rune and Soul Core socket recommendations from elemental deficits & stage. */
export function computePoe2RuneSuggestions(
  resistances: ResistanceTelemetry,
  highestUnlockedAct: number,
  adapter: GameAdapter,
): Poe2RuneHintItem[] {
  const hints = adapter.getRuneSocketHints();
  if (hints.length === 0) return [];

  const deficits: Record<string, number> = {
    fire_res: Math.max(0, resistances.fire.target - resistances.fire.actual),
    cold_res: Math.max(0, resistances.cold.target - resistances.cold.actual),
    lightning_res: Math.max(0, resistances.lightning.target - resistances.lightning.actual),
    chaos_res: highestUnlockedAct >= 3 ? Math.max(0, resistances.chaos.target - resistances.chaos.actual) : 0,
  };

  const out: Poe2RuneHintItem[] = [];
  const resCategories = ["cold_res", "lightning_res", "fire_res", "chaos_res"] as const;
  const sortedRes = [...resCategories].sort((a, b) => (deficits[b] ?? 0) - (deficits[a] ?? 0));

  for (const cat of sortedRes) {
    const deficit = deficits[cat] ?? 0;
    const hint = hints.find((h) => h.category === cat);
    if (!hint || deficit <= 0) continue;
    const labelMap: Record<(typeof resCategories)[number], string> = {
      fire_res: `Fire Res -${deficit}%`,
      cold_res: `Cold Res -${deficit}%`,
      lightning_res: `Lightning Res -${deficit}%`,
      chaos_res: `Chaos Res -${deficit}%`,
    };
    out.push({
      id: hint.id,
      priority: deficit >= 15 ? "high" : "medium",
      problemSummary: labelMap[cat],
      runeName: hint.runeName,
      slotHint: hint.slotHint,
      effectLabel: hint.effectLabel,
    });
  }

  for (const hint of hints) {
    if (out.length >= 4) break;
    if (hint.category === "damage" || hint.category === "life" || hint.category === "movement_speed") {
      if (out.some((item) => item.id === hint.id)) continue;
      out.push({
        id: hint.id,
        priority: "medium",
        problemSummary: hint.category === "damage" ? "Weapon Rune DPS" : "Campaign EHP / Utility",
        runeName: hint.runeName,
        slotHint: hint.slotHint,
        effectLabel: hint.effectLabel,
      });
    }
  }

  return out.slice(0, 4);
}

/** Enriches a PoE 2 snapshot with progressive res penalty, permanent bonuses, Spirit budget & Runes. */
export function reconcilePoe2SnapshotTelemetry(
  snapshot: HudSessionSnapshot,
  adapter: GameAdapter,
): HudSessionSnapshot {
  if (adapter.gameId !== "poe2") return snapshot;

  const penalty = adapter.getResistancePenaltyForAct(snapshot.highestUnlockedAct, []);
  const bossWarning = adapter.getBossElementalWarnings(snapshot.highestUnlockedAct)[0]?.warningText ?? null;
  const resistances: ResistanceTelemetry = {
    ...snapshot.resistances,
    kitavaPenalty: penalty,
    upcomingBossWarning: bossWarning,
  };
  const permanentBonuses = computePoe2PermanentBonusStates(
    adapter,
    snapshot.clearedAreaIds ?? [],
    snapshot.checkpoints,
  );
  const poe2SpiritSummary = computePoe2SpiritSummary(snapshot.gemSteps, permanentBonuses);
  const runeSuggestions = computePoe2RuneSuggestions(resistances, snapshot.highestUnlockedAct, adapter);
  const activeVendorRegex = buildVendorSearchRegex({
    gemSteps: snapshot.gemSteps,
    linkGroups: snapshot.linkGroups,
    currentAct: snapshot.highestUnlockedAct,
    gameId: "poe2",
  });

  return {
    ...snapshot,
    gameId: "poe2",
    resistances,
    permanentBonuses,
    poe2SpiritSummary,
    runeSuggestions,
    activeVendorRegex,
  };
}
