import type { HudSessionSnapshot } from "@exile-hud/core";
import { normalizeSupportedGameId } from "@exile-hud/game-data";
import { Loader2 } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { PassiveTreeWorkspaceView } from "./passive_tree_workspace_view.js";
import { useLazyPassiveTreeGeometry } from "./use_lazy_passive_tree_geometry.js";

interface PassiveTreeCommandViewProps {
  snapshot: HudSessionSnapshot;
  onTriggerManualSync: () => void;
}

/** Lazy-loaded read-only passive tree tab wrapper supporting PoE 1 (sync) and PoE 2 (async chunk). */
export function PassiveTreeCommandView({
  snapshot,
  onTriggerManualSync,
}: PassiveTreeCommandViewProps) {
  const { appMsg } = useHudI18n();
  const gameId = normalizeSupportedGameId(snapshot.gameId);
  const { geometry, error } = useLazyPassiveTreeGeometry(gameId);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <p className="border-l-2 border-hud-danger pl-3 py-1 text-xs text-hud-danger">{error}</p>
      </div>
    );
  }

  if (!geometry) {
    return (
      <div className="max-w-7xl mx-auto px-4 pt-10 flex items-center justify-center gap-2 text-xs text-hud-muted">
        <Loader2 className="h-4 w-4 animate-spin text-hud-accent" />
        <span>{appMsg.poe2.loadingPassiveTree}</span>
      </div>
    );
  }

  return (
    <PassiveTreeWorkspaceView
      key={gameId}
      snapshot={snapshot}
      geometry={geometry}
      onTriggerManualSync={onTriggerManualSync}
    />
  );
}
