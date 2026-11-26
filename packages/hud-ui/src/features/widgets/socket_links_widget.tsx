import {
  resolveSnapshotGameId,
  selectActiveSkillSet,
  type HudSessionSnapshot,
  type TargetLinkGroupSummary,
  type TargetSkillSetSummary,
} from "@exile-hud/core";
import { useEffect, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizePobFallbackText } from "../i18n/telemetry_advisor_localizer.js";
import { SkillLinkGroupCard } from "./skill_link_group_card.js";

export interface ResolvedSocketLinksDisplay {
  isPoe2: boolean;
  skillSets: TargetSkillSetSummary[];
  defaultSkillSet: TargetSkillSetSummary | null;
  activeSkillSet: TargetSkillSetSummary | null;
  displayedGroups: TargetLinkGroupSummary[];
}

/** Resolves the active PoE 1 skill set (manual override or level default) and target link groups for display. */
export function resolveSocketLinksDisplay(
  snapshot: HudSessionSnapshot,
  manualSkillSetId: string | null,
): ResolvedSocketLinksDisplay {
  const isPoe2 = resolveSnapshotGameId(snapshot) === "poe2";
  const skillSets = !isPoe2 ? (snapshot.skillSets ?? []) : [];
  const defaultSkillSet = selectActiveSkillSet(skillSets, snapshot.characterLevel);
  const activeSkillSet =
    (manualSkillSetId ? skillSets.find((set) => set.id === manualSkillSetId) : null) ?? defaultSkillSet;
  const displayedGroups = !isPoe2 && activeSkillSet ? activeSkillSet.groups : snapshot.linkGroups;

  return { isPoe2, skillSets, defaultSkillSet, activeSkillSet, displayedGroups };
}

/** Unified PoE 1 & PoE 2 socket link widget using the shared card, socket bar, and linked-gem pill layout. */
export function SocketLinksWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, msg, appMsg } = useHudI18n();
  const [manualSkillSetId, setManualSkillSetId] = useState<string | null>(null);
  const { isPoe2, skillSets, defaultSkillSet, activeSkillSet, displayedGroups } = resolveSocketLinksDisplay(
    snapshot,
    manualSkillSetId,
  );

  useEffect(() => {
    setManualSkillSetId(null);
  }, [snapshot.profileId]);

  useEffect(() => {
    if (manualSkillSetId && !skillSets.some((set) => set.id === manualSkillSetId)) {
      setManualSkillSetId(null);
    }
  }, [manualSkillSetId, skillSets]);

  return (
    <div className="flex flex-col h-full gap-2.5 min-h-0">
      <div className="flex items-baseline justify-between gap-2 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {isPoe2 ? appMsg.poe2.skillSocketsTitle : msg.widgets.linksTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-hud-muted">
          {msg.widgets.groupsCount(displayedGroups.length)}
        </span>
      </div>

      {!isPoe2 && skillSets.length > 0 && activeSkillSet && (
        <div
          role="group"
          aria-label={msg.widgets.skillSetsLabel}
          className="flex items-center gap-3 overflow-x-auto pb-0.5 border-b border-hud-hairline shrink-0"
        >
          {skillSets.map((set) => {
            const isSelected = set.id === activeSkillSet.id;
            const localizedTitle = localizePobFallbackText(set.title, locale);
            const showLevelSuffix = !/\b(lv|lvl|level|nv)\b/i.test(localizedTitle);
            return (
              <button
                key={set.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setManualSkillSetId(set.id === defaultSkillSet?.id ? null : set.id)}
                className={`py-1 text-xs whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  isSelected
                    ? "border-hud-accent text-hud-text font-semibold"
                    : "border-transparent text-hud-muted hover:text-hud-text"
                }`}
              >
                {localizedTitle}
                {showLevelSuffix ? ` · Lv ${set.minLevel}+` : ""}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
        {displayedGroups.length > 0 ? (
          displayedGroups.map((group, idx) => (
            <SkillLinkGroupCard
              key={`${activeSkillSet?.id ?? "default"}-${group.title}-${idx}`}
              group={group}
              isPoe2={isPoe2}
            />
          ))
        ) : (
          !isPoe2 &&
          activeSkillSet && <p className="text-xs text-hud-muted">{msg.widgets.noSkillGroupsInSet}</p>
        )}
      </div>

      {isPoe2 && (
        <p className="text-[11px] text-hud-dim leading-snug shrink-0">
          {appMsg.poe2.skillSocketsNote}
        </p>
      )}
    </div>
  );
}
