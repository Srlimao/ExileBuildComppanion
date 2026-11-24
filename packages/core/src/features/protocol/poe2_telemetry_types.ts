export interface Poe2SpiritSummary {
  requiredSpirit: number;
  unlockedSpirit: number;
  campaignGuaranteedSpirit: number;
}

export interface Poe2PermanentBonusState {
  id: string;
  act: number;
  areaId: string;
  bossOrQuestName: string;
  rewardLabel: string;
  bonusType: string;
  valueSummary: string;
  completed: boolean;
}

export interface Poe2RuneHintItem {
  id: string;
  priority: "high" | "medium";
  problemSummary: string;
  runeName: string;
  slotHint: string;
  effectLabel: string;
}
