import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

const ATTR_PILL_HEX: Record<"R" | "G" | "B" | "W", string> = {
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  W: "#fafafa",
};

/** Displays PoE 2 Skill Gem Jeweller socket tiers and linked support gems without gear R/G/B links. */
export function Poe2SkillSocketsPanel({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { msg, appMsg } = useHudI18n();

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.poe2.skillSocketsTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-hud-muted">
          {msg.widgets.groupsCount(snapshot.linkGroups.length)}
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
        {snapshot.linkGroups.map((group) => {
          const activeGems = group.gems.filter((g) => !g.isSupport);
          const supportGems = group.gems.filter((g) => g.isSupport);
          const targetSlots = Math.min(5, Math.max(2, supportGems.length));
          const tierLabel = appMsg.poe2.jewellerTierLabel(supportGems.length);

          return (
            <div key={group.title} className="space-y-1.5 pb-2 border-b border-hud-hairline/70 last:border-b-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-hud-text truncate">
                  {activeGems.length > 0 ? activeGems.map((g) => g.name).join(" / ") : group.title}
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-hud-subtle text-hud-accent shrink-0">
                  {tierLabel}
                </span>
              </div>

              <div className="flex items-center gap-1.5" aria-label={tierLabel}>
                {Array.from({ length: 5 }, (_, idx) => {
                  const filled = idx < supportGems.length;
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

              {group.note && <p className="text-[11px] text-hud-muted leading-snug">{group.note}</p>}

              {supportGems.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {supportGems.map((sup, idx) => (
                    <span
                      key={`${sup.gemId}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-hud-subtle text-xs text-hud-text/90"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: ATTR_PILL_HEX[sup.color] }}
                      />
                      <span>{sup.name}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-hud-muted">{appMsg.poe2.noSupportGems}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-hud-dim leading-snug shrink-0">{appMsg.poe2.skillSocketsNote}</p>
    </div>
  );
}
