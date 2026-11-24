import { buildAscendancyProgressionPlan, type HudSessionSnapshot } from "@exile-hud/core";
import { getGameAdapter } from "@exile-hud/game-data";
import { Check } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { AscendancyTreeSvgPreview } from "./ascendancy_tree_svg_preview.js";

interface AscendancyOrderWidgetProps {
  snapshot: HudSessionSnapshot;
}

/** Read-only Lab widget displaying only the Ascendancy tree, class name, and ordered nodes. */
export const AscendancyOrderWidget = memo(function AscendancyOrderWidget({
  snapshot,
}: AscendancyOrderWidgetProps) {
  const { msg, appMsg } = useHudI18n();
  const isPoe2 = snapshot.gameId === "poe2";
  const t = msg.widgets.ascendancyOrder;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [manualPhaseId, setManualPhaseId] = useState<string | null>(null);

  useEffect(() => {
    setManualPhaseId(null);
    setSelectedNodeId(null);
  }, [snapshot.profileId]);

  const adapter = getGameAdapter(snapshot.gameId);
  const plan = useMemo(
    () =>
      buildAscendancyProgressionPlan({
        characterClass: snapshot.characterClass,
        ascendancyName: snapshot.ascendancyName,
        specs: snapshot.passiveTree.specs ?? [],
        allocatedNodeIds: snapshot.passiveTree.allocatedNodeIds,
        ascendancyNoteOrderIds: snapshot.passiveTree.ascendancyNoteOrderIds,
        characterLevel: snapshot.characterLevel,
        activeSpecId: snapshot.passiveTree.activeSpecId,
        manualPhaseId,
        adapter,
      }),
    [
      snapshot.characterClass,
      snapshot.ascendancyName,
      snapshot.passiveTree.specs,
      snapshot.passiveTree.allocatedNodeIds,
      snapshot.passiveTree.ascendancyNoteOrderIds,
      snapshot.characterLevel,
      snapshot.passiveTree.activeSpecId,
      manualPhaseId,
      adapter,
    ],
  );

  useEffect(() => {
    setSelectedNodeId(null);
  }, [plan.activePhaseId]);

  const toggleSelected = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const allocatedStepsCount = plan.steps.filter((s) => s.allocated).length;
  const allStepsAllocated = plan.steps.length > 0 && allocatedStepsCount === plan.steps.length;
  const activeHighlightId = hoveredNodeId ?? selectedNodeId;
  const headerName =
    plan.displayName ??
    (snapshot.ascendancyName && snapshot.ascendancyName !== "None"
      ? snapshot.ascendancyName
      : t.eyebrow);
  const sourceBadge = t.sourceBadges[plan.orderSource];
  const hasMultipleSameName =
    plan.phases.length > 1 && new Set(plan.phases.map((p) => p.displayName)).size < plan.phases.length;

  return (
    <div className="@container flex flex-col h-full gap-2.5 min-h-0">
      <div className="flex items-start justify-between gap-2 flex-wrap shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
            {t.eyebrow}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-base font-bold text-hud-text tracking-tight truncate">
              {headerName}
            </h2>
            {snapshot.characterClass && (
              <span className="text-xs text-hud-muted">{snapshot.characterClass}</span>
            )}
          </div>
        </div>

        {plan.steps.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {sourceBadge && (
              <span className="px-2 py-0.5 rounded-lg bg-hud-subtle text-[11px] text-hud-muted">
                {sourceBadge}
              </span>
            )}
            <span
              className={`font-mono tabular-nums font-semibold ${
                allStepsAllocated ? "text-hud-ok" : "text-hud-muted"
              }`}
            >
              {t.nodesShort(allocatedStepsCount, plan.steps.length)}
            </span>
          </div>
        )}
      </div>

      {plan.phases.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
          <button
            type="button"
            aria-pressed={manualPhaseId === null}
            onClick={() => setManualPhaseId(null)}
            className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
              manualPhaseId === null
                ? "border-hud-accent bg-hud-accent/15 text-hud-text font-semibold"
                : "border-hud-hairline text-hud-muted hover:text-hud-text"
            }`}
          >
            {t.autoPhaseLabel(snapshot.characterLevel)}
          </button>

          {plan.phases.map((phase) => {
            const active = phase.id === plan.activePhaseId;
            const phaseLabel = hasMultipleSameName
              ? `${t.lvShort(phase.minLevel)} · ${phase.finalSpecTitle}`
              : `${t.lvShort(phase.minLevel)} · ${phase.displayName}`;
            return (
              <button
                key={phase.id}
                type="button"
                aria-pressed={active}
                onClick={() => setManualPhaseId(phase.id)}
                className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
                  active
                    ? "border-hud-accent bg-hud-accent/15 text-hud-text font-semibold"
                    : "border-hud-hairline text-hud-muted hover:text-hud-text"
                }`}
              >
                {phaseLabel}
              </button>
            );
          })}
        </div>
      )}

      {plan.allocatedOtherAscendancyName && plan.displayName && (
        <div className="px-2.5 py-1.5 rounded-lg border border-hud-warn/45 bg-hud-warn/10 text-[11px] text-hud-warn font-medium shrink-0">
          {t.swapAscendancyNotice(plan.allocatedOtherAscendancyName, plan.displayName)}
        </div>
      )}

      {plan.respecSteps.length > 0 && (
        <div className="px-2.5 py-1.5 rounded-lg border border-hud-danger/45 bg-hud-danger/10 text-[11px] text-hud-danger font-medium shrink-0">
          {t.respecNodesPrefix} {plan.respecSteps.map((r) => r.name).join(", ")}
        </div>
      )}

      {!plan.clusterKey ? (
        <p className="text-xs text-hud-muted my-auto leading-relaxed">{t.noAscendancySelected}</p>
      ) : (
        <div className="grid grid-cols-1 @md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 flex-1 min-h-0">
          <AscendancyTreeSvgPreview
            plan={plan}
            focusedNodeId={activeHighlightId}
            onSelectNode={toggleSelected}
            onHoverNode={setHoveredNodeId}
          />

          <div className="flex flex-col gap-1.5 min-h-0 overflow-y-auto pr-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted shrink-0">
              {t.nodeOrderHeading}
            </div>

            {plan.steps.length === 0 ? (
              <p className="text-xs text-hud-muted leading-relaxed">{t.noAscendancyNodesInPob}</p>
            ) : (
              <ol className="space-y-1">
                {plan.steps.map((step) => {
                  const expanded = selectedNodeId === step.nodeId;
                  const subLabel = step.labTier
                    ? (isPoe2 ? appMsg.poe2.trialTiers[step.labTier] : t.labTiers[step.labTier])
                    : step.sourceSpecTitle;

                  return (
                    <li key={step.nodeId}>
                      <button
                        type="button"
                        aria-pressed={expanded}
                        onClick={() => toggleSelected(step.nodeId)}
                        onMouseEnter={() => setHoveredNodeId(step.nodeId)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors cursor-pointer border ${
                          step.isNext
                            ? "border-hud-quest/45 bg-hud-subtle"
                            : expanded
                              ? "border-hud-hairline bg-hud-subtle"
                              : "border-transparent hover:bg-hud-subtle"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-5 w-5 rounded-md font-mono tabular-nums text-[11px] font-bold inline-flex items-center justify-center shrink-0 border ${
                                step.allocated
                                  ? "bg-hud-ok/15 text-hud-ok border-hud-ok/40"
                                  : step.isNext
                                    ? "bg-hud-quest/20 text-hud-quest border-hud-quest/50"
                                    : "bg-hud-subtle text-hud-muted border-hud-hairline"
                              }`}
                            >
                              {step.order}
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`text-xs sm:text-sm font-semibold truncate ${
                                  step.allocated ? "text-hud-text/75" : "text-hud-text"
                                }`}
                              >
                                {step.name}
                              </div>
                              {(subLabel || step.respecLater) && (
                                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-hud-muted">
                                  {subLabel && <span className="truncate">{subLabel}</span>}
                                  {step.respecLater && (
                                    <span className="text-[10px] font-mono text-hud-warn shrink-0">
                                      · {t.respecLaterBadge}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {step.allocated ? (
                            <Check
                              aria-label={t.allocatedBadge}
                              className="h-3.5 w-3.5 text-hud-ok shrink-0"
                            />
                          ) : step.isNext ? (
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-hud-quest shrink-0">
                              {t.nextBadge}
                            </span>
                          ) : null}
                        </div>

                        {expanded && step.stats.length > 0 && (
                          <ul className="text-[11px] text-hud-muted leading-snug pt-1.5 mt-1.5 border-t border-hud-hairline/70 space-y-0.5">
                            {step.stats.map((stat) => (
                              <li key={stat}>{stat}</li>
                            ))}
                          </ul>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
