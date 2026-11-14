import { useCallback, useEffect, useState } from "react";
import {
  checkForAppUpdateIpc,
  getAppUpdateStateIpc,
  installAppUpdateIpc,
  subscribeAppUpdateState,
  type AppUpdateStateSnapshot,
} from "./auto_updater_ipc_client.js";

const INITIAL_PLACEHOLDER: AppUpdateStateSnapshot = {
  phase: "idle",
  currentVersion: "0.1.0",
  latestVersion: null,
  installVariant: "portableStandalone",
  updateAvailable: false,
  assetDownloadUrl: null,
  checksumsUrl: null,
  releasePageUrl: null,
  assetSizeBytes: null,
  progressPercent: null,
  lastCheckedAtMs: null,
  error: null,
};

export function useDesktopAutoUpdater() {
  const [state, setState] = useState<AppUpdateStateSnapshot>(INITIAL_PLACEHOLDER);

  useEffect(() => {
    let active = true;
    let unsub: () => void = () => undefined;

    void getAppUpdateStateIpc().then((initial) => {
      if (active) setState(initial);
    });

    void subscribeAppUpdateState((next) => {
      if (active) setState(next);
    }).then((fn) => {
      if (active) unsub = fn;
      else fn();
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const checkNow = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      phase: prev.updateAvailable ? prev.phase : "checking",
      error: null,
    }));
    const next = await checkForAppUpdateIpc();
    setState(next);
  }, []);

  const installNow = useCallback(async () => {
    try {
      await installAppUpdateIpc();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, phase: "error", error: msg }));
    }
  }, []);

  return { state, checkNow, installNow };
}
