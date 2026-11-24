import type { TargetItemSlotSummary } from "@exile-hud/core";
import type { CharmVisualKind, FlaskVisualKind, PaperDollSlotKey } from "./gear_slot_normalizer.js";

const RARITY_STROKE_COLOR: Record<TargetItemSlotSummary["rarity"] | "empty", string> = {
  unique: "#fb923c",
  rare: "#facc15",
  magic: "#60a5fa",
  normal: "var(--hud-text)",
  unknown: "var(--hud-muted)",
  empty: "var(--hud-dim)",
};

const FLASK_LIQUID_COLOR: Record<FlaskVisualKind, string> = {
  life: "#ef4444",
  mana: "#3b82f6",
  hybrid: "#a855f7",
  quicksilver: "#22d3ee",
  granite: "#f59e0b",
  jade: "#34d399",
  silver: "#e4e4e7",
  utility: "#a1a1aa",
};

const CHARM_TINT_COLOR: Record<CharmVisualKind, string> = {
  cold: "#60a5fa",
  fire: "#f87171",
  lightning: "#eab308",
  bleed: "#ef4444",
  chaos: "#d946ef",
  gold: "#fbbf24",
  utility: "#a1a1aa",
};

const POE1_SOCKET_COLOR: Record<string, string> = {
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  W: "#f4f4f5",
};

interface SilhouetteProps {
  slotKey: PaperDollSlotKey | "extra";
  rarity?: TargetItemSlotSummary["rarity"] | "empty";
  flaskKind?: FlaskVisualKind;
  charmKind?: CharmVisualKind;
  className?: string;
}

/** Crisp inline SVG equipment silhouettes matching PoE 1 & PoE 2 inventory slots. */
export function EquipmentSlotSilhouette({
  slotKey,
  rarity = "empty",
  flaskKind = "utility",
  charmKind = "utility",
  className = "w-6 h-6",
}: SilhouetteProps) {
  const stroke = RARITY_STROKE_COLOR[rarity];
  const opacity = rarity === "empty" ? 0.36 : 0.92;

  if (slotKey === "weapon1") {
    return (
      <svg viewBox="0 0 32 48" className={className} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M21 5 L11 42" />
        <path d="M18 4 C21 4 24 7 23 11 C21 13 18 11 18 8 Z" fill={stroke} fillOpacity="0.2" />
        <path d="M13 31 L18 33" />
        <circle cx="20.5" cy="7.5" r="1.4" fill={stroke} />
      </svg>
    );
  }
  if (slotKey === "weapon2") {
    return (
      <svg viewBox="0 0 32 48" className={className} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M16 6 L26 11 L24 27 C23 34 19 39 16 42 C13 39 9 34 8 27 L6 11 Z" fill={stroke} fillOpacity="0.14" />
        <path d="M16 12 V36" />
        <path d="M11 21 H21" />
      </svg>
    );
  }
  if (slotKey === "helmet") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M7 18 C7 10 11 6 16 6 C21 6 25 10 25 18 L24 24 H8 Z" fill={stroke} fillOpacity="0.16" />
        <path d="M10 16 H22" />
        <path d="M16 6 V16" />
      </svg>
    );
  }
  if (slotKey === "body") {
    return (
      <svg viewBox="0 0 36 44" className={className} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M12 6 L6 11 L9 18 L11 16 L10 38 H26 L25 16 L27 18 L30 11 L24 6 L21 9 H15 Z" fill={stroke} fillOpacity="0.16" />
        <path d="M18 9 V38" />
        <path d="M12 22 H24" />
      </svg>
    );
  }
  if (slotKey === "amulet") {
    return (
      <svg viewBox="0 0 28 28" className={className} fill="none" stroke={stroke} strokeWidth="1.7" style={{ opacity }} aria-hidden="true">
        <path d="M8 6 C8 12 11 15 14 15 C17 15 20 12 20 6" />
        <circle cx="14" cy="19" r="5" fill={stroke} fillOpacity="0.2" />
        <circle cx="14" cy="19" r="1.9" fill={stroke} />
      </svg>
    );
  }
  if (slotKey === "ring1" || slotKey === "ring2") {
    return (
      <svg viewBox="0 0 28 28" className={className} fill="none" stroke={stroke} strokeWidth="1.75" style={{ opacity }} aria-hidden="true">
        <circle cx="14" cy="15.5" r="7" fill={stroke} fillOpacity="0.12" />
        <polygon points="14,5 17,8.5 14,11 11,8.5" fill={stroke} fillOpacity="0.45" />
      </svg>
    );
  }
  if (slotKey === "gloves") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M9 14 V8 C9 6.5 11 6.5 11 8 V13 M11 7.5 C11 6 13.5 6 13.5 7.5 V13 M13.5 7.5 C13.5 6 16 6 16 7.5 V13 M16 9 C16 7.5 18.5 7.5 18.5 9 V17 L22 14 C23.5 13 24.5 14.5 23.5 16 L19 22 V26 H10 V20 Z" fill={stroke} fillOpacity="0.16" />
      </svg>
    );
  }
  if (slotKey === "boots") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <path d="M10 6 H17 V18 L24 21 C25.5 21.5 26 23 26 25 H9 V6 Z" fill={stroke} fillOpacity="0.16" />
        <path d="M9 22 H25" />
      </svg>
    );
  }
  if (slotKey === "belt") {
    return (
      <svg viewBox="0 0 44 24" className={className} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
        <rect x="4" y="8" width="36" height="8" rx="2" fill={stroke} fillOpacity="0.14" />
        <rect x="18" y="6" width="8" height="12" rx="1.5" fill={stroke} fillOpacity="0.28" />
        <circle cx="22" cy="12" r="1.4" fill={stroke} />
      </svg>
    );
  }
  if (slotKey === "charm1" || slotKey === "charm2" || slotKey === "charm3") {
    const tint = rarity === "empty" ? stroke : CHARM_TINT_COLOR[charmKind];
    return (
      <svg viewBox="0 0 28 28" className={className} fill="none" stroke={tint} strokeWidth="1.6" style={{ opacity }} aria-hidden="true">
        <path d="M14 4 L21 11 L18 23 H10 L7 11 Z" fill={tint} fillOpacity="0.22" />
        <circle cx="14" cy="13" r="2.1" fill={tint} />
      </svg>
    );
  }
  if (slotKey === "extra") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.7" style={{ opacity }} aria-hidden="true">
        <polygon points="12,3 20,12 12,21 4,12" fill={stroke} fillOpacity="0.2" />
      </svg>
    );
  }

  const liquid = FLASK_LIQUID_COLOR[flaskKind];
  return (
    <svg viewBox="0 0 28 40" className={className} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" style={{ opacity }} aria-hidden="true">
      <rect x="11" y="4" width="6" height="4" rx="1" />
      <path d="M12 8 V13 L7 20 V33 C7 35 8.5 36 10.5 36 H17.5 C19.5 36 21 35 21 33 V20 L16 13 V8" />
      {rarity !== "empty" && (
        <path d="M8 22 H20 V33 C20 34.2 19 35 17.5 35 H10.5 C9 35 8 34.2 8 33 Z" fill={liquid} fillOpacity="0.72" stroke="none" />
      )}
    </svg>
  );
}

/** Renders PoE 1 R/G/B/W linked sockets or PoE 2 Rune diamond pips. */
export function ItemSocketPips({
  sockets,
  isPoe2,
  compact = false,
}: {
  sockets: string;
  isPoe2: boolean;
  compact?: boolean;
}) {
  const trimmed = sockets.trim();
  if (!trimmed) return null;

  if (isPoe2 || trimmed.startsWith("RUNE:") || /\bS\b/i.test(trimmed)) {
    const runeMatch = /^RUNE:(\d+)\((\d+)\)/i.exec(trimmed);
    const tokens = trimmed.split(/[\s-]+/).filter(Boolean);
    const total = runeMatch ? Number(runeMatch[1]) : Math.min(3, tokens.length || 1);
    const filled = runeMatch ? Number(runeMatch[2]) : tokens.filter((t) => /^S$/i.test(t)).length;
    const pipSize = compact ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
    return (
      <span className="inline-flex items-center gap-1" aria-label={trimmed}>
        {Array.from({ length: Math.max(1, total) }).map((_, idx) => {
          const isActive = idx < filled;
          return (
            <span
              key={idx}
              className={`${pipSize} inline-block rotate-45 border ${
                isActive ? "bg-hud-cold border-hud-cold" : "bg-transparent border-hud-dim"
              }`}
            />
          );
        })}
      </span>
    );
  }

  const groups = trimmed.split(/\s+/).filter(Boolean);
  const dotSize = compact ? 5 : 7;
  const linkWidth = compact ? 3 : 4;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap" aria-label={trimmed}>
      {groups.map((group, gIdx) => {
        const colors = group.split("-").filter(Boolean);
        return (
          <span key={gIdx} className="inline-flex items-center">
            {colors.map((code, cIdx) => {
              const bg = POE1_SOCKET_COLOR[code.toUpperCase()] ?? "#a1a1aa";
              return (
                <span key={cIdx} className="inline-flex items-center">
                  {cIdx > 0 && (
                    <span
                      className="inline-block bg-hud-muted"
                      style={{ width: linkWidth, height: 1.5 }}
                    />
                  )}
                  <span
                    className="inline-block rounded-full border border-black/50"
                    style={{ width: dotSize, height: dotSize, backgroundColor: bg }}
                  />
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
