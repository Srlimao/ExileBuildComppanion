import type { SupportedGameId } from "@exile-hud/game-data";
import { useEffect, useState } from "react";
import {
  getCachedPassiveTreeGeometry,
  loadBuiltPassiveTreeGeometry,
  type BuiltTreeGeometry,
} from "./passive_tree_geometry_builder.js";

/** Loads the game-scoped passive tree geometry on demand without blocking PoE 1 synchronous renders. */
export function useLazyPassiveTreeGeometry(gameId: SupportedGameId = "poe1"): {
  geometry: BuiltTreeGeometry | null;
  loading: boolean;
  error: string | null;
} {
  const [geometry, setGeometry] = useState<BuiltTreeGeometry | null>(() =>
    getCachedPassiveTreeGeometry(gameId),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedPassiveTreeGeometry(gameId);
    if (cached) {
      setGeometry(cached);
      setError(null);
      return;
    }

    let cancelled = false;
    setGeometry(null);
    setError(null);

    void loadBuiltPassiveTreeGeometry(gameId)
      .then((loaded) => {
        if (!cancelled) setGeometry(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return {
    geometry,
    loading: geometry === null && error === null,
    error,
  };
}
