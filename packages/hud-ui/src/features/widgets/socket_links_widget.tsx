import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { SkillLinkGroupCard } from "./skill_link_group_card.js";

/** Unified PoE 1 & PoE 2 socket link widget using the shared card, socket bar, and linked-gem pill layout. */
export function SocketLinksWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { msg, appMsg } = useHudI18n();
  const isPoe2 = snapshot.gameId === "poe2";

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {isPoe2 ? appMsg.poe2.skillSocketsTitle : msg.widgets.linksTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-hud-muted">
          {msg.widgets.groupsCount(snapshot.linkGroups.length)}
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
        {snapshot.linkGroups.map((group, idx) => (
          <SkillLinkGroupCard key={`${group.title}-${idx}`} group={group} isPoe2={isPoe2} />
        ))}
      </div>

      {isPoe2 && (
        <p className="text-[11px] text-hud-dim leading-snug shrink-0">
          {appMsg.poe2.skillSocketsNote}
        </p>
      )}
    </div>
  );
}
