import type { GemAcquisitionStep, SupportedGameId, TargetLinkGroupSummary } from "../protocol/session_room_wire_protocol.js";
import { buildPoe2VendorSearchRegex } from "./poe2_vendor_regex_builder.js";

function formatSocketChainPattern(colors: Array<"R" | "G" | "B" | "W">): string | null {
  if (colors.length < 2 || colors.length > 4) return null;
  const counts = { R: 0, G: 0, B: 0 };
  for (const c of colors) {
    if (c === "R") counts.R++;
    else if (c === "G") counts.G++;
    else if (c === "B") counts.B++;
  }
  const parts: string[] = [];
  if (counts.R > 0) parts.push("r".repeat(counts.R));
  if (counts.G > 0) parts.push("g".repeat(counts.G));
  if (counts.B > 0) parts.push("b".repeat(counts.B));
  const chain = parts.join("-");
  return chain.includes("-") ? chain : null;
}

function abbreviateGemName(name: string): string {
  const clean = name.replace(/\s+support$/i, "").replace(/[^a-zA-Z\s]/g, "").trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 5).toLowerCase();
  return words.map((w) => w.slice(0, 3)).join(" ").slice(0, 9).toLowerCase();
}

export function buildVendorSearchRegex(params: {
  gemSteps: GemAcquisitionStep[];
  linkGroups: TargetLinkGroupSummary[];
  currentAct: number;
  maxLength?: number;
  gameId?: SupportedGameId;
}): string {
  const { gemSteps, linkGroups, currentAct, maxLength = 50, gameId = "poe1" } = params;
  if (gameId === "poe2") {
    return buildPoe2VendorSearchRegex({ gemSteps, currentAct, maxLength });
  }
  const tokens: string[] = [];

  for (const group of linkGroups) {
    const missingAny = group.gems.some((g) => !g.verifiedSocketed);
    if (!missingAny) continue;
    const colors = group.gems.slice(0, 4).map((g) => g.color);
    const chain = formatSocketChainPattern(colors);
    if (chain && !tokens.includes(chain)) tokens.push(chain);
  }

  const neededGems = gemSteps.filter(
    (g) => !g.verifiedByApi && !g.softAcquired && !g.manualCompleted && g.act <= Math.max(1, currentAct),
  );
  for (const gem of neededGems) {
    const abbr = abbreviateGemName(gem.gemName);
    if (abbr && !tokens.includes(abbr)) tokens.push(abbr);
  }

  if (currentAct <= 3 && !tokens.some((t) => /r-g|g-r|b-g|g-b|r-b|b-r/.test(t))) {
    tokens.push("nne"); // Matches "Runner's" movement speed boots in Act 1-3 vendor windows
  }

  let result = "";
  for (const token of tokens) {
    const formatted = token.includes(" ") ? `"${token}"` : token;
    const candidate = result ? `${result}|${formatted}` : formatted;
    if (candidate.length > maxLength) break;
    result = candidate;
  }

  return result;
}
