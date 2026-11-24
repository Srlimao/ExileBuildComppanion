import type { NormalizedPoe2BuildDocument } from "./poe2_build_file_schema.js";

/** Computes up to 6 milestone character level breakpoints from `.build` `level_interval` ranges. */
export function computeBuildLevelBreakpoints(doc: NormalizedPoe2BuildDocument): number[] {
  const points = new Set<number>([1]);
  let hasExplicit = false;

  const collect = (item: { minLevel: number; maxLevel: number; hasExplicitInterval: boolean }) => {
    if (!item.hasExplicitInterval) return;
    hasExplicit = true;
    points.add(item.minLevel);
    if (item.maxLevel < 100) points.add(Math.min(100, item.maxLevel + 1));
  };

  for (const p of doc.passives) collect(p);
  for (const s of doc.skills) {
    collect(s);
    for (const sup of s.supports) collect(sup);
  }
  for (const slot of doc.inventorySlots) collect(slot);

  if (!hasExplicit) return [1];
  const sorted = [...points].sort((a, b) => a - b);
  if (sorted.length <= 6) return sorted;

  const sampled = [sorted[0]!];
  for (let i = 1; i < 5; i++) {
    sampled.push(sorted[Math.round((i * (sorted.length - 1)) / 5)]!);
  }
  sampled.push(sorted[sorted.length - 1]!);
  return [...new Set(sampled)].sort((a, b) => a - b);
}

/** Formats a synthesized milestone bracket title from its level span. */
export function formatBuildBracketTitle(
  startLv: number,
  nextStart: number | undefined,
  isSingle: boolean,
): string {
  if (isSingle) return "Campaign / Endgame";
  if (nextStart === undefined) return `Lv ${startLv}+`;
  return `Lv ${startLv}-${Math.max(startLv, nextStart - 1)}`;
}
