export type HudAppearanceMode = "oled" | "soft-dark" | "light";

export type HudAccentPresetId =
  | "chalk"
  | "gold"
  | "crimson"
  | "cyan"
  | "viridian"
  | "amethyst"
  | "custom";

export interface SavedHudTheme {
  mode: HudAppearanceMode;
  accentId: HudAccentPresetId;
  customHex: string;
}

export interface HudAccentSwatch {
  id: Exclude<HudAccentPresetId, "custom">;
  label: string;
  darkHex: string;
  lightHex: string;
  previewHex: string;
}

export interface PassiveTreeThemePalette {
  canvasBg: string;
  wireframeEdge: string;
  nodeFill: string;
  masteryFill: string;
  nodeStroke: string;
  nodeRim: string;
  notableRim: string;
  selectedRing: string;
  searchRing: string;
  allocated: string;
  newBracket: string;
  earlier: string;
  respec: string;
  future: string;
  masteryActive: string;
}

export const DEFAULT_HUD_THEME: SavedHudTheme = {
  mode: "oled",
  accentId: "chalk",
  customHex: "#eab308",
};

export const HUD_ACCENT_SWATCHES: readonly HudAccentSwatch[] = [
  { id: "chalk", label: "Chalk", darkHex: "#ffffff", lightHex: "#09090b", previewHex: "#e4e4e7" },
  { id: "gold", label: "Exile Gold", darkHex: "#eab308", lightHex: "#b45309", previewHex: "#eab308" },
  { id: "crimson", label: "Vaal Crimson", darkHex: "#f87171", lightHex: "#dc2626", previewHex: "#ef4444" },
  { id: "cyan", label: "Mana Cyan", darkHex: "#22d3ee", lightHex: "#0891b2", previewHex: "#06b6d4" },
  { id: "viridian", label: "Viridian", darkHex: "#34d399", lightHex: "#059669", previewHex: "#10b981" },
  { id: "amethyst", label: "Amethyst", darkHex: "#c084fc", lightHex: "#7e22ce", previewHex: "#a855f7" },
];

/** Normalizes a 3- or 6-digit hex color string into `#rrggbb` lowercase. */
export function normalizeHexColor(raw: string, fallback = "#eab308"): string {
  const cleaned = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split("")
      .map((c) => `${c}${c}`)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return fallback;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex);
  return [
    parseInt(norm.slice(1, 3), 16),
    parseInt(norm.slice(3, 5), 16),
    parseInt(norm.slice(5, 7), 16),
  ];
}

function rgbTupleToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Computes WCAG 2.x relative luminance in [0, 1]. */
export function computeRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgbTuple(hex).map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Adjusts custom accent brightness if needed so it stays readable against Light or OLED backgrounds. */
export function resolveReadableAccentForMode(hex: string, mode: HudAppearanceMode): string {
  const norm = normalizeHexColor(hex);
  const [r, g, b] = hexToRgbTuple(norm);
  const lum = computeRelativeLuminance(norm);

  if (mode === "light" && lum > 0.48) {
    const factor = 0.56;
    return rgbTupleToHex(r * factor, g * factor, b * factor);
  }
  if (mode !== "light" && lum < 0.07) {
    const lift = 96;
    return rgbTupleToHex(
      r + (255 - r) * (lift / 255),
      g + (255 - g) * (lift / 255),
      b + (255 - b) * (lift / 255),
    );
  }
  return norm;
}

function resolveAccentHex(theme: SavedHudTheme): string {
  if (theme.accentId === "custom") {
    return resolveReadableAccentForMode(theme.customHex, theme.mode);
  }
  const preset = HUD_ACCENT_SWATCHES.find((s) => s.id === theme.accentId) ?? HUD_ACCENT_SWATCHES[0]!;
  return theme.mode === "light" ? preset.lightHex : preset.darkHex;
}

/** Resolves all CSS custom properties for the selected appearance mode and accent color. */
export function resolveThemeCssVariables(theme: SavedHudTheme): Record<string, string> {
  const isLight = theme.mode === "light";
  const accentHex = resolveAccentHex(theme);
  const [ar, ag, ab] = hexToRgbTuple(accentHex);
  const accentLum = computeRelativeLuminance(accentHex);
  const accentFg = accentLum > 0.42 ? "#09090b" : "#ffffff";

  const surfaceTokens = isLight
    ? {
        "--hud-bg": "#fafafa",
        "--hud-bg-rgb": "250, 250, 250",
        "--hud-surface": "#ffffff",
        "--hud-subtle": "rgba(9, 9, 11, 0.045)",
        "--hud-hairline": "rgba(9, 9, 11, 0.11)",
        "--hud-text": "#09090b",
        "--hud-muted": "#52525b",
        "--hud-dim": "#a1a1aa",
        "--hud-quest": "#b45309",
        "--hud-ok": "#059669",
        "--hud-warn": "#d97706",
        "--hud-danger": "#dc2626",
        "--hud-fire": "#dc2626",
        "--hud-cold": "#2563eb",
        "--hud-lightning": "#ca8a04",
        "--hud-chaos": "#a21caf",
        "--hud-socket-ring": "rgba(9, 9, 11, 0.42)",
      }
    : theme.mode === "soft-dark"
      ? {
          "--hud-bg": "#0c0c0e",
          "--hud-bg-rgb": "12, 12, 14",
          "--hud-surface": "#141418",
          "--hud-subtle": "rgba(255, 255, 255, 0.045)",
          "--hud-hairline": "rgba(255, 255, 255, 0.1)",
          "--hud-text": "#f4f4f5",
          "--hud-muted": "#a1a1aa",
          "--hud-dim": "#52525b",
          "--hud-quest": "#eab308",
          "--hud-ok": "#34d399",
          "--hud-warn": "#fbbf24",
          "--hud-danger": "#f87171",
          "--hud-fire": "#ef4444",
          "--hud-cold": "#3b82f6",
          "--hud-lightning": "#eab308",
          "--hud-chaos": "#d946ef",
          "--hud-socket-ring": "rgba(255, 255, 255, 0.22)",
        }
      : {
          "--hud-bg": "#000000",
          "--hud-bg-rgb": "0, 0, 0",
          "--hud-surface": "#09090b",
          "--hud-subtle": "rgba(255, 255, 255, 0.04)",
          "--hud-hairline": "rgba(255, 255, 255, 0.09)",
          "--hud-text": "#f4f4f5",
          "--hud-muted": "#71717a",
          "--hud-dim": "#3f3f46",
          "--hud-quest": "#eab308",
          "--hud-ok": "#34d399",
          "--hud-warn": "#fbbf24",
          "--hud-danger": "#f87171",
          "--hud-fire": "#ef4444",
          "--hud-cold": "#3b82f6",
          "--hud-lightning": "#eab308",
          "--hud-chaos": "#d946ef",
          "--hud-socket-ring": "rgba(255, 255, 255, 0.22)",
        };

  return {
    ...surfaceTokens,
    "--hud-accent": accentHex,
    "--hud-accent-fg": accentFg,
    "--hud-accent-soft": `rgba(${ar}, ${ag}, ${ab}, ${isLight ? 0.12 : 0.16})`,
    "--hud-accent-glow": `rgba(${ar}, ${ag}, ${ab}, ${isLight ? 0.35 : 0.72})`,
  };
}

/** Resolves SVG colors for the Passive Tree canvas and mini-preview in the active appearance mode. */
export function resolvePassiveTreePalette(theme: SavedHudTheme): PassiveTreeThemePalette {
  const accentHex = resolveAccentHex(theme);
  if (theme.mode === "light") {
    return {
      canvasBg: "#f4f4f5",
      wireframeEdge: "#cbd5e1",
      nodeFill: "#ffffff",
      masteryFill: "#e4e4e7",
      nodeStroke: "#94a3b8",
      nodeRim: "#ffffff",
      notableRim: "#92400e",
      selectedRing: "#09090b",
      searchRing: accentHex,
      allocated: "#059669",
      newBracket: "#d97706",
      earlier: "#0284c7",
      respec: "#e11d48",
      future: "#7c3aed",
      masteryActive: "#4f46e5",
    };
  }
  return {
    canvasBg: theme.mode === "soft-dark" ? "#0c0c0e" : "#000000",
    wireframeEdge: theme.mode === "soft-dark" ? "#27272a" : "#1c1c21",
    nodeFill: theme.mode === "soft-dark" ? "#18181b" : "#0d0d10",
    masteryFill: theme.mode === "soft-dark" ? "#101014" : "#070709",
    nodeStroke: "#3f3f46",
    nodeRim: "#09090b",
    notableRim: "#fef3c7",
    selectedRing: "#ffffff",
    searchRing: accentHex,
    allocated: "#10b981",
    newBracket: "#f59e0b",
    earlier: "#06b6d4",
    respec: "#f43f5e",
    future: "#7c3aed",
    masteryActive: "#6366f1",
  };
}
