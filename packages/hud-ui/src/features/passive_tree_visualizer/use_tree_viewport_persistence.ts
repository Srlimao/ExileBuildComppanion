import { useEffect, useRef } from "react";
import type { TreeWorldBounds } from "./passive_tree_camera_bounds.js";
import { saveTreeViewport } from "./passive_tree_viewport_storage.js";
import type { ViewportCamera } from "./pinch_zoom_math.js";

/** Auto-fits new brackets and persists tree viewport cameras across tab switches and reloads. */
export function useTreeViewportPersistence(params: {
  profileId: string;
  currentSpecKey: string;
  manualSpecId: string | null;
  hasRestoredCamera: boolean;
  getNextBounds: () => TreeWorldBounds;
  fitBounds: (bounds: TreeWorldBounds) => void;
  getCamera: () => ViewportCamera;
}): void {
  const {
    profileId,
    currentSpecKey,
    manualSpecId,
    hasRestoredCamera,
    getNextBounds,
    fitBounds,
    getCamera,
  } = params;

  const lastFittedSpecKey = useRef<string>(hasRestoredCamera ? currentSpecKey : "");

  useEffect(() => {
    if (lastFittedSpecKey.current === currentSpecKey) return;
    lastFittedSpecKey.current = currentSpecKey;
    fitBounds(getNextBounds());
  }, [currentSpecKey, getNextBounds, fitBounds]);

  useEffect(() => {
    saveTreeViewport(profileId, {
      specKey: currentSpecKey,
      camera: getCamera(),
      manualSpecId,
    });
  }, [profileId, currentSpecKey, manualSpecId, getCamera]);

  const latestPersistRef = useRef({ profileId, specKey: currentSpecKey, manualSpecId, getCamera });
  latestPersistRef.current = { profileId, specKey: currentSpecKey, manualSpecId, getCamera };

  useEffect(
    () => () => {
      const latest = latestPersistRef.current;
      saveTreeViewport(
        latest.profileId,
        {
          specKey: latest.specKey,
          camera: latest.getCamera(),
          manualSpecId: latest.manualSpecId,
        },
        true,
      );
    },
    [],
  );
}
