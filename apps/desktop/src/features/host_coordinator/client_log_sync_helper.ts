import { parseClientLogLine, reduceTelemetrySession, type HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  checkPoeRunning,
  detectClientLogPath,
  hasPoesessid,
  isTauriRuntime,
  readBootstrapLogLines,
  setClientLogPath,
} from "./tauri_ipc_adapter.js";

export function applyLogLinesToSnapshot(cur: HudSessionSnapshot, lines: string[]): HudSessionSnapshot {
  let next = cur;
  for (const raw of lines) {
    const parsed = parseClientLogLine(raw);
    if (!parsed) continue;
    next = reduceTelemetrySession(next, { type: "client_log", event: parsed, autoDetectCharacter: true }, poe1GameAdapter);
  }
  return next;
}

export async function hookAndBootstrapLogPath(
  path: string,
  manual: boolean,
  cur: HudSessionSnapshot | null,
): Promise<{ hooked: boolean; nextSnapshot: HudSessionSnapshot | null }> {
  const hooked = await setClientLogPath(path, manual);
  let nextSnapshot = cur ? { ...cur, clientLogHooked: hooked } : null;
  if (hooked) {
    const bootLines = await readBootstrapLogLines();
    if (nextSnapshot && bootLines.length > 0) {
      nextSnapshot = applyLogLinesToSnapshot(nextSnapshot, bootLines);
    }
  }
  return { hooked, nextSnapshot };
}

export async function bootstrapHostEnvironment(initialSnap: HudSessionSnapshot): Promise<{
  detectedPath: string | null;
  hooked: boolean;
  hasSession: boolean;
  snapshot: HudSessionSnapshot;
}> {
  let snap = initialSnap;
  const [logRes, hasSession, poeLive] = await Promise.all([
    detectClientLogPath(),
    hasPoesessid(),
    checkPoeRunning(),
  ]);

  if (isTauriRuntime()) {
    snap = reduceTelemetrySession(snap, { type: "process_state", running: poeLive }, poe1GameAdapter);
  }

  let hooked = false;
  if (logRes.detectedPath) {
    const result = await hookAndBootstrapLogPath(logRes.detectedPath, false, snap);
    hooked = result.hooked;
    if (result.nextSnapshot) snap = result.nextSnapshot;
  }

  return {
    detectedPath: logRes.detectedPath,
    hooked,
    hasSession,
    snapshot: snap,
  };
}
