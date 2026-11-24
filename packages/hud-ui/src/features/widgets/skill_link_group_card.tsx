import type { TargetLinkGroupSummary } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

export const SOCKET_COLOR_HEX: Record<"R" | "G" | "B" | "W", string> = {
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  W: "#fafafa",
};

type LinkGemEntry = TargetLinkGroupSummary["gems"][number];

export interface PartitionedLinkGroup {
  primaryGems: LinkGemEntry[];
  linkedGems: LinkGemEntry[];
  supportCount: number;
}

/** Splits a link group into header skill(s) and linked pills, falling back to the first gem when no active skill exists. */
export function partitionLinkGroupGems(
  group: TargetLinkGroupSummary,
  isPoe2: boolean,
): PartitionedLinkGroup {
  if (group.gems.length === 0) {
    return { primaryGems: [], linkedGems: [], supportCount: 0 };
  }
  const activeGems = group.gems.filter((g) => !g.isSupport);
  const supportGems = group.gems.filter((g) => g.isSupport);

  if (isPoe2) {
    if (activeGems.length > 0) {
      return { primaryGems: activeGems, linkedGems: supportGems, supportCount: supportGems.length };
    }
    return {
      primaryGems: [group.gems[0]!],
      linkedGems: group.gems.slice(1),
      supportCount: supportGems.length,
    };
  }

  if (activeGems.length > 0) {
    return {
      primaryGems: [activeGems[0]!],
      linkedGems: [...activeGems.slice(1), ...supportGems],
      supportCount: supportGems.length,
    };
  }

  return {
    primaryGems: [group.gems[0]!],
    linkedGems: group.gems.slice(1),
    supportCount: supportGems.length,
  };
}

/** Shared OLED socket/gem link group card used by both PoE 1 (R/G/B/W links) and PoE 2 (Jeweller tiers). */
export function SkillLinkGroupCard({
  group,
  isPoe2,
}: {
  group: TargetLinkGroupSummary;
  isPoe2: boolean;
}) {
  const { msg, appMsg } = useHudI18n();
  const { primaryGems, linkedGems, supportCount } = partitionLinkGroupGems(group, isPoe2);
  const targetSlots = Math.min(5, Math.max(2, supportCount));
  const tierLabel = appMsg.poe2.jewellerTierLabel(supportCount);
  const poe1LinkBadge = group.gems.length > 1 ? `${group.gems.length}L` : "1S";
  const orderedGems = [...primaryGems, ...linkedGems];

  const primaryTitleLower = primaryGems.map((g) => g.name.toLowerCase()).join(" / ");
  const rawTitleLower = group.title.trim().toLowerCase();
  const showGroupSubtitle =
    !isPoe2 &&
    Boolean(rawTitleLower) &&
    Boolean(primaryTitleLower) &&
    !rawTitleLower.includes(primaryTitleLower) &&
    !primaryTitleLower.includes(rawTitleLower);

  return (
    <div className="space-y-1.5 pb-2 border-b border-hud-hairline/70 last:border-b-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          {primaryGems.length > 0 ? (
            primaryGems.map((gem, idx) => (
              <span
                key={`${gem.gemId}-primary-${idx}`}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  gem.unlinkedWarning
                    ? "text-hud-danger"
                    : gem.verifiedSocketed
                      ? "text-hud-text"
                      : "text-hud-text/90"
                }`}
              >
                {idx > 0 && <span className="text-hud-dim font-normal">/</span>}
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: SOCKET_COLOR_HEX[gem.color] }}
                />
                <span className="truncate">{gem.name}</span>
                {!gem.verifiedSocketed && gem.reserveLocation && (
                  <span className="text-[11px] font-mono text-hud-warn">
                    ({gem.reserveLocation === "backpack" ? msg.widgets.bag.toUpperCase() : msg.widgets.swap.toUpperCase()})
                  </span>
                )}
                {gem.unlinkedWarning && <span className="text-[11px] font-mono text-hud-danger">!</span>}
              </span>
            ))
          ) : (
            <span className="text-xs font-semibold text-hud-text truncate">{group.title}</span>
          )}
          {showGroupSubtitle && (
            <span className="text-[11px] text-hud-muted truncate">· {group.title}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isPoe2 && group.missingAuraWarning && (
            <span className="text-[11px] font-medium text-hud-warn">{msg.widgets.missingAura}</span>
          )}
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-hud-subtle text-hud-accent shrink-0">
            {isPoe2 ? tierLabel : poe1LinkBadge}
          </span>
        </div>
      </div>

      {isPoe2 ? (
        <div className="flex items-center gap-1.5" aria-label={tierLabel}>
          {Array.from({ length: 5 }, (_, idx) => {
            const filled = idx < supportCount;
            const unlocked = idx < targetSlots;
            return (
              <span
                key={idx}
                className={`h-2 w-4 rounded-sm border transition-colors ${
                  filled
                    ? "bg-hud-accent border-hud-accent"
                    : unlocked
                      ? "bg-hud-subtle border-hud-hairline"
                      : "bg-transparent border-hud-hairline/40 opacity-35"
                }`}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex items-center flex-wrap" aria-label={poe1LinkBadge}>
          {orderedGems.map((gem, idx) => (
            <span key={`${gem.gemId}-slot-${idx}`} className="inline-flex items-center">
              {idx > 0 && <span className="h-0.5 w-1.5 bg-hud-hairline" />}
              <span
                className={`h-2 w-4 rounded-sm border ${
                  gem.unlinkedWarning ? "border-hud-danger ring-1 ring-hud-danger" : "border-white/20"
                }`}
                style={{
                  backgroundColor: SOCKET_COLOR_HEX[gem.color],
                  opacity: gem.verifiedSocketed ? 1 : 0.72,
                }}
              />
            </span>
          ))}
        </div>
      )}

      {group.note && <p className="text-[11px] text-hud-muted leading-snug">{group.note}</p>}

      {linkedGems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedGems.map((gem, idx) => (
            <span
              key={`${gem.gemId}-linked-${idx}`}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-hud-subtle text-xs ${
                gem.unlinkedWarning
                  ? "border border-hud-danger/60 text-hud-danger font-semibold"
                  : gem.verifiedSocketed
                    ? "text-hud-text"
                    : "text-hud-text/90"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: SOCKET_COLOR_HEX[gem.color] }}
              />
              <span>{gem.name}</span>
              {!gem.verifiedSocketed && gem.reserveLocation && (
                <span className="text-[11px] font-mono text-hud-warn">
                  ({gem.reserveLocation === "backpack" ? msg.widgets.bag.toUpperCase() : msg.widgets.swap.toUpperCase()})
                </span>
              )}
              {gem.unlinkedWarning && <span className="text-[11px] font-mono text-hud-danger">!</span>}
            </span>
          ))}
        </div>
      ) : (
        isPoe2 && <p className="text-[11px] text-hud-muted">{appMsg.poe2.noSupportGems}</p>
      )}
    </div>
  );
}
