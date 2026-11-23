const POB_COLOUR_REGEX = /\^(x[a-zA-Z0-9]{6}|[0-9])/g;

/** Strips Path of Building inline ^xRRGGBB and ^0..^9 colour codes. */
export function cleanPobColorCodes(value: unknown): string {
  return String(value ?? "").replace(POB_COLOUR_REGEX, "").trim();
}

/** Infers the minimum character level from a PoB set/spec title. */
export function inferLevelFromTitle(title: string, fallback = 1): number {
  const cleaned = cleanPobColorCodes(title);
  const lvlMatch = /(?:lv|lvl|level)\s*[:.]?\s*(\d+)/i.exec(cleaned);
  if (lvlMatch?.[1]) return Number.parseInt(lvlMatch[1], 10);

  const actMatch = /act\s*(\d+)|\ba(\d{1,2})\b/i.exec(cleaned);
  const actStr = actMatch?.[1] ?? actMatch?.[2];
  if (actStr) {
    const act = Number.parseInt(actStr, 10);
    if (act >= 1 && act <= 10) {
      return Math.max(1, Math.min(68, (act - 1) * 8 + 1));
    }
  }

  if (/\b(?:uber\s*lab|eternal\s*lab|4th\s*lab|fourth\s*lab|red\s*maps)\b/i.test(cleaned)) return 75;
  if (/\b(?:endgame|maps|mapping|final|late)\b/i.test(cleaned)) return Math.max(fallback, 68);
  if (/\b(?:merc\s*lab|merciless\s*lab|3rd\s*lab|third\s*lab)\b/i.test(cleaned)) return 68;
  if (/\b(?:cruel\s*lab|2nd\s*lab|second\s*lab)\b/i.test(cleaned)) return 55;
  if (/\b(?:normal\s*lab|1st\s*lab|first\s*lab)\b/i.test(cleaned)) return 33;
  if (/\b(?:starter|twilight|strand|leveling\s*start)\b/i.test(cleaned)) return 1;

  return fallback;
}

/** Parses PoB Spec masteryEffects="{nodeId,effectId},..." attributes into a map. */
export function parseXmlMasteryEffectsAttr(rawAttr: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const text = String(rawAttr ?? "");
  const regex = /\{(\d+)\s*,\s*(\d+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      out[match[1]] = match[2];
    }
  }
  return out;
}
