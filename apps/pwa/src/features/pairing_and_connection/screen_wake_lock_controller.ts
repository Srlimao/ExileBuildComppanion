import { useEffect, useState } from "react";

export function useScreenWakeLock(active: boolean): { supported: boolean; locked: boolean } {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!supported || !active) {
      setLocked(false);
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (!cancelled) setLocked(true);
        sentinel.addEventListener("release", () => {
          if (!cancelled) setLocked(false);
        });
      } catch {
        if (!cancelled) setLocked(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && active) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [supported, active]);

  return { supported, locked };
}
