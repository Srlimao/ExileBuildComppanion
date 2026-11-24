import type { GemAcquisitionStep } from "../protocol/session_room_wire_protocol.js";

/** Builds a <= 50-char PoE 2 town vendor filter regex focusing on MS boots, +Skills, Spirit & Salvage. */
export function buildPoe2VendorSearchRegex(params: {
  gemSteps: GemAcquisitionStep[];
  currentAct: number;
  maxLength?: number;
}): string {
  const { gemSteps, currentAct, maxLength = 50 } = params;
  const tokens: string[] = [
    "m.*sp", // Movement Speed boots
    '"to l"', // "+ to Level of all ... Skills" weapons/amulets
  ];

  const hasPendingSpirit = gemSteps.some(
    (g) =>
      (g.gemKind === "spirit" || g.gemKind === "meta" || (g.spiritCost ?? 0) > 0) &&
      !g.verifiedByApi &&
      !g.softAcquired &&
      !g.manualCompleted &&
      g.act <= Math.max(1, currentAct),
  );
  if (hasPendingSpirit) {
    tokens.push("spirit");
  }

  tokens.push("qual|sock"); // Quality / Rune-socketed salvage items

  let result = "";
  for (const token of tokens) {
    const candidate = result ? `${result}|${token}` : token;
    if (candidate.length > maxLength) break;
    result = candidate;
  }
  return result;
}
