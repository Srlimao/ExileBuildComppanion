import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

const SOCKET_HEX: Record<"R" | "G" | "B" | "W", string> = {
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  W: "#fafafa",
};

/** Frameless Whisper socket link display with inline connected color pips. */
export function SocketLinksWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { msg } = useHudI18n();

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.linksTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-hud-muted">
          {msg.widgets.groupsCount(snapshot.linkGroups.length)}
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {snapshot.linkGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-hud-muted">{group.title}</span>
              {group.missingAuraWarning && (
                <span className="text-xs font-medium text-hud-warn">{msg.widgets.missingAura}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-y-1 text-sm leading-snug">
              {group.gems.map((gem, idx) => (
                <span key={`${gem.gemId}-${idx}`} className="inline-flex items-center">
                  {idx > 0 && <span className="mx-1.5 text-hud-dim">—</span>}
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      gem.unlinkedWarning
                        ? "text-hud-danger font-semibold"
                        : gem.verifiedSocketed
                          ? "text-hud-text"
                          : "text-hud-text/85"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: SOCKET_HEX[gem.color],
                        boxShadow: "0 0 0 1.5px var(--hud-socket-ring)",
                      }}
                    />
                    <span>{gem.name}</span>
                    {!gem.verifiedSocketed && gem.reserveLocation && (
                      <span className="text-xs font-mono text-hud-warn">
                        ({gem.reserveLocation === "backpack" ? msg.widgets.bag.toUpperCase() : msg.widgets.swap.toUpperCase()})
                      </span>
                    )}
                    {gem.unlinkedWarning && <span className="text-xs font-mono text-hud-danger">!</span>}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
