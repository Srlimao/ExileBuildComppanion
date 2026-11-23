import { registerSW } from "virtual:pwa-register";

let storedRegistration: ServiceWorkerRegistration | null = null;
let storedUpdateSw: ((reloadPage?: boolean) => Promise<void>) | null = null;
let inFlightRefresh: Promise<void> | null = null;

export interface ForcePwaRefreshOptions {
  registration?: ServiceWorkerRegistration | null;
  updateSw?: ((reloadPage?: boolean) => Promise<void>) | null;
  reload?: () => void;
  timeoutMs?: number;
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);
    promise.then(
      (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function waitForInstallingWorker(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeEventListener?.("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
        finish();
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    worker.addEventListener?.("statechange", onStateChange);
  });
}

/** Registers the Workbox service worker and stores handles for forced pull-to-refresh checks. */
export function initPwaServiceWorker(): void {
  if (typeof window === "undefined") return;
  storedUpdateSw = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) storedRegistration = registration;
    },
  });
}

/** Checks for waiting Workbox Service Worker updates (timeout-safe offline) and reloads the PWA. */
export function forcePwaRefresh(options: ForcePwaRefreshOptions = {}): Promise<void> {
  if (inFlightRefresh) return inFlightRefresh;

  const run = async () => {
    const timeoutMs = options.timeoutMs ?? 2000;
    const reg =
      options.registration !== undefined
        ? options.registration
        : (storedRegistration ??
          (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistration
            ? await raceWithTimeout(
                navigator.serviceWorker.getRegistration().then((r) => r ?? null).catch(() => null),
                400,
                null,
              )
            : null));

    const updateSw = options.updateSw !== undefined ? options.updateSw : storedUpdateSw;
    const reload =
      options.reload ??
      (() => {
        if (typeof window !== "undefined") window.location.reload();
      });

    if (reg) {
      await raceWithTimeout(Promise.resolve(reg.update()).catch(() => undefined), timeoutMs, undefined);
      if (reg.installing) {
        await waitForInstallingWorker(reg.installing, timeoutMs);
      }
      if (reg.waiting && updateSw) {
        await raceWithTimeout(Promise.resolve(updateSw(true)).catch(() => undefined), 800, undefined);
      }
    }

    reload();
  };

  inFlightRefresh = run().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}
