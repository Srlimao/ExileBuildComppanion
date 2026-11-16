import type { HudSessionSnapshot } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { useEffect } from "react";
import { deriveTrayIndicator } from "./desktop_telemetry_bridge.js";
import { setTrayLocaleIpc, setTrayTelemetryStatus } from "./tauri_ipc_adapter.js";

/** Synchronizes the active HUD locale and localized telemetry tooltip with the Windows System Tray. */
export function useTrayStatusAndLocaleSync(
  snapshot: HudSessionSnapshot | null,
  relayConnected: boolean,
): void {
  const { locale } = useHudI18n();

  useEffect(() => {
    void setTrayLocaleIpc(locale);
  }, [locale]);

  useEffect(() => {
    if (!snapshot) return;
    const indicator = deriveTrayIndicator(snapshot, relayConnected, locale);
    void setTrayTelemetryStatus(indicator.status, indicator.tooltip);
  }, [snapshot, relayConnected, locale]);
}
