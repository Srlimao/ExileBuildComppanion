import type { HudSessionSnapshot } from "@exile-hud/core";

interface DeferredBacklogWidgetProps {
  snapshot: HudSessionSnapshot;
  onToggleCheckpoint: (checkpointId: string) => void;
}

export function DeferredBacklogWidget({ snapshot, onToggleCheckpoint }: DeferredBacklogWidgetProps) {
  const skipped = snapshot.checkpoints.filter(
    (cp) =>
      !cp.completed &&
      (cp.category === "SKILL_BOOK" || cp.category === "LAB_TRIAL") &&
      cp.sectionAct <= snapshot.highestUnlockedAct,
  );

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Cleanup Backlog</h2>
        <span className="text-xs font-mono tabular-nums text-hud-muted">{skipped.length} open</span>
      </div>

      <div className="space-y-0.5 overflow-y-auto pr-1">
        {skipped.slice(0, 8).map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => onToggleCheckpoint(cp.id)}
            className="w-full text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-hud-subtle flex items-baseline justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-hud-text truncate">{cp.title}</div>
              <div className="text-xs text-hud-muted">
                Act {cp.sectionAct} · {cp.areaName}
              </div>
            </div>
            <span
              className={`text-xs font-medium shrink-0 ${
                cp.category === "SKILL_BOOK" ? "text-hud-quest" : "text-hud-ok"
              }`}
            >
              {cp.category === "SKILL_BOOK" ? "Book" : "Trial"}
            </span>
          </button>
        ))}

        {skipped.length === 0 && (
          <p className="text-sm text-hud-ok py-3">No skipped skill books or Lab trials.</p>
        )}
      </div>
    </div>
  );
}
