import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HudSessionSnapshot, RoomToClientMessage } from "@exile-hud/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../..");
const PORT = 8799;
const BASE_HTTP = `http://127.0.0.1:${PORT}`;
const BASE_WS = `ws://127.0.0.1:${PORT}`;

function createSampleSnapshot(roomId: string, areaName = "The Twilight Strand"): HudSessionSnapshot {
  return {
    version: 1,
    roomId,
    profileId: "e2e-prof",
    buildName: "RF League Start",
    characterClass: "Witch",
    ascendancyName: "Elementalist",
    characterName: "E2ETester",
    characterLevel: 2,
    isEndgameOnlyFallback: false,
    fallbackNotice: null,
    leagueStart: true,
    poeRunning: true,
    clientLogHooked: true,
    characterSyncStatus: "ONLINE_PUBLIC",
    lastCharacterSyncAt: Date.now(),
    mode: "FIELD",
    currentAreaId: "1_1_1",
    currentAreaName: areaName,
    currentAreaLevel: 1,
    currentAreaSeed: "999",
    currentAct: 1,
    highestUnlockedAct: 1,
    lastCombatZoneId: "1_1_1",
    lastCombatZoneName: areaName,
    recentDeath: false,
    resumeZoneBanner: null,
    activeVendorRegex: "b-b|nne",
    autoClipboardEnabled: true,
    runElapsedMs: 1000,
    runTimerRunning: true,
    actSplitsMs: {},
    checkpoints: [
      {
        id: "cp-1",
        sectionAct: 1,
        areaId: "1_1_2",
        areaName: "The Coast",
        category: "MANDATORY_PATH",
        title: "Grab Coast Waypoint",
        subNotes: [],
        directions: [45],
        completed: false,
        softCompleted: false,
      },
    ],
    gemSteps: [],
    nextTownCurrencyBudget: { wisdom: 1, transmutation: 0, alteration: 0, chance: 0, alchemy: 0 },
    linkGroups: [],
    resistances: {
      source: "ACT_TARGET_FALLBACK",
      kitavaPenalty: 0,
      fire: { actual: 0, target: 35 },
      cold: { actual: 0, target: 35 },
      lightning: { actual: 0, target: 35 },
      chaos: { actual: 0, target: 0 },
      upcomingBossWarning: null,
    },
    gearHygiene: [],
    passiveTree: {
      specName: "Main",
      targetNodeCount: 0,
      allocatedTargetCount: 0,
      remainingNodeIds: [],
      remainingNotableNames: [],
      respecPointsNeeded: 0,
      targetNodesPreview: [],
    },
    lab: {
      hasDailyLayout: false,
      difficultyLabel: "Normal",
      currentRoomId: null,
      currentRoomName: null,
      rooms: [],
      completedTrialAreaIds: [],
    },
    zoneLayoutPaths: [],
  };
}

interface QueuedSocket {
  ws: WebSocket;
  nextMessage: (predicate?: (msg: RoomToClientMessage) => boolean, timeoutMs?: number) => Promise<RoomToClientMessage>;
  closed: Promise<{ code: number; reason: string }>;
}

function connectQueuedWs(url: string): QueuedSocket {
  const ws = new WebSocket(url);
  const queue: RoomToClientMessage[] = [];
  const waiters: Array<{ predicate?: (m: RoomToClientMessage) => boolean; resolve: (m: RoomToClientMessage) => void }> = [];

  ws.on("message", (data) => {
    const parsed = JSON.parse(String(data)) as RoomToClientMessage;
    const idx = waiters.findIndex((w) => !w.predicate || w.predicate(parsed));
    if (idx >= 0) {
      const [waiter] = waiters.splice(idx, 1);
      waiter!.resolve(parsed);
    } else {
      queue.push(parsed);
    }
  });

  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.on("close", (code, reasonBuf) => resolve({ code, reason: reasonBuf.toString() }));
  });

  const nextMessage = (predicate?: (msg: RoomToClientMessage) => boolean, timeoutMs = 6000) => {
    const queuedIdx = queue.findIndex((m) => !predicate || predicate(m));
    if (queuedIdx >= 0) {
      return Promise.resolve(queue.splice(queuedIdx, 1)[0]!);
    }
    return new Promise<RoomToClientMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), timeoutMs);
      waiters.push({
        predicate,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  };

  return { ws, nextMessage, closed };
}

async function waitForHealth(timeoutMs = 25_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_HTTP}/api/health`);
      if (res.ok) return;
    } catch {
      // Retry until wrangler dev finishes booting
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error("Timed out waiting for wrangler dev /api/health");
}

describe("Cloudflare Worker + SessionRoomDurableObject E2E", () => {
  let child: ChildProcess | null = null;
  let tempPersistDir = "";

  beforeAll(async () => {
    tempPersistDir = fs.mkdtempSync(path.join(os.tmpdir(), "exile-wrangler-e2e-"));
    const wranglerBin = path.join(REPO_ROOT, "node_modules/wrangler/bin/wrangler.js");
    child = spawn(
      process.execPath,
      [wranglerBin, "dev", "--port", String(PORT), "--local", "--ip", "127.0.0.1", "--persist-to", tempPersistDir],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    await waitForHealth();
  });

  afterAll(async () => {
    if (child?.pid) {
      if (process.platform === "win32") {
        try {
          execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } catch {
          child.kill();
        }
      } else {
        child.kill("SIGTERM");
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    if (tempPersistDir) {
      try {
        fs.rmSync(tempPersistDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
      } catch {
        // Ignore transient Windows handle release lag in %TEMP%
      }
    }
  });

  it("rejects POESESSID payloads on query and body with 400 and closes unregistered WS with 4001", async () => {
    const portableRedirect = await fetch(`${BASE_HTTP}/api/download/desktop`, { redirect: "manual" });
    expect(portableRedirect.status).toBe(302);
    expect(portableRedirect.headers.get("location")).toBe(
      "https://github.com/Srlimao/ExileBuildComppanion/releases/latest/download/ExileRelay.exe",
    );

    const setupRedirect = await fetch(`${BASE_HTTP}/api/download/desktop?variant=setup`, { redirect: "manual" });
    expect(setupRedirect.status).toBe(302);
    expect(setupRedirect.headers.get("location")).toBe(
      "https://github.com/Srlimao/ExileBuildComppanion/releases/latest/download/ExileRelay-Setup.exe",
    );

    const queryLeak = await fetch(`${BASE_HTTP}/api/session/LEAK01/register?poesessid=secret`);
    expect(queryLeak.status).toBe(400);

    const bodyLeak = await fetch(`${BASE_HTTP}/api/session/LEAK01/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostSecret: "host-secret-123",
        pin: "4455",
        snapshot: createSampleSnapshot("LEAK01"),
        poesessid: "never-send-this",
      }),
    });
    expect(bodyLeak.status).toBe(400);

    const missingRoom = connectQueuedWs(`${BASE_WS}/api/session/NOPE99/ws?role=viewer&pin=1234`);
    const closeInfo = await missingRoom.closed;
    expect(closeInfo.code).toBe(4001);
  });

  it("registers room, rejects wrong PIN (4003), relays host patches, and persists SQLite snapshot/layouts across reconnects", async () => {
    const regRes = await fetch(`${BASE_HTTP}/api/session/TEST01/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "TEST01",
        hostSecret: "host-secret-abc",
        pin: "7890",
        snapshot: createSampleSnapshot("TEST01", "The Twilight Strand"),
      }),
    });
    expect(regRes.status).toBe(200);

    const badPin = connectQueuedWs(`${BASE_WS}/api/session/TEST01/ws?role=viewer&pin=0000`);
    expect((await badPin.closed).code).toBe(4003);

    const host = connectQueuedWs(`${BASE_WS}/api/session/TEST01/ws?role=host&secret=host-secret-abc`);
    const hostHydrated = await host.nextMessage((m) => m.type === "room:hydrated_state");
    expect(hostHydrated.type).toBe("room:hydrated_state");

    const viewer = connectQueuedWs(`${BASE_WS}/api/session/TEST01/ws?role=viewer&pin=7890&device=iPad`);
    const viewerHydrated = await viewer.nextMessage((m) => m.type === "room:hydrated_state");
    if (viewerHydrated.type !== "room:hydrated_state") throw new Error("Unexpected message");
    expect(viewerHydrated.snapshot.currentAreaName).toBe("The Twilight Strand");

    const nextSnap = createSampleSnapshot("TEST01", "The Coast");
    host.ws.send(JSON.stringify({ type: "host:state_patch", snapshot: nextSnap, eventTag: "zone_changed" }));
    const patched = await viewer.nextMessage((m) => m.type === "room:state_patch");
    if (patched.type !== "room:state_patch") throw new Error("Unexpected patch");
    expect(patched.snapshot.currentAreaName).toBe("The Coast");

    viewer.ws.send(
      JSON.stringify({
        type: "viewer:save_widget_layout",
        deviceFormFactor: "tablet-landscape",
        mode: "FIELD",
        items: [{ widgetId: "zone_layout", colSpan: 2, rowSpan: 2, order: 0 }],
      }),
    );
    const layoutBroadcast = await host.nextMessage((m) => m.type === "room:command_forwarded");
    expect(layoutBroadcast.type).toBe("room:command_forwarded");

    viewer.ws.send(JSON.stringify({ type: "viewer:request_regex_copy", regex: "b-b-g" }));
    const regexForward = await host.nextMessage(
      (m) => m.type === "room:command_forwarded" && m.command.type === "viewer:request_regex_copy",
    );
    expect(regexForward.type).toBe("room:command_forwarded");

    viewer.ws.send(JSON.stringify({ type: "viewer:toggle_checkpoint", checkpointId: "cp-1", completed: true }));
    await viewer.nextMessage((m) => m.type === "room:state_patch" && m.eventTag === "viewer:toggle_checkpoint");
    viewer.ws.send(JSON.stringify({ type: "viewer:reset_progress" }));
    const resetForward = await host.nextMessage(
      (m) => m.type === "room:command_forwarded" && m.command.type === "viewer:reset_progress",
    );
    expect(resetForward.type).toBe("room:command_forwarded");

    viewer.ws.close();
    host.ws.close();

    // Fresh viewer reconnect confirms SQLite Durable Object persistence of snapshot + layout
    const reconnected = connectQueuedWs(`${BASE_WS}/api/session/TEST01/ws?role=viewer&pin=7890&device=Phone`);
    const rehydrated = await reconnected.nextMessage((m) => m.type === "room:hydrated_state");
    if (rehydrated.type !== "room:hydrated_state") throw new Error("Unexpected rehydrate");
    expect(rehydrated.snapshot.currentAreaName).toBe("The Coast");
    expect(rehydrated.snapshot.checkpoints[0]?.completed).toBe(false);
    expect(rehydrated.layouts["tablet-landscape"]?.FIELD?.[0]?.widgetId).toBe("zone_layout");
    reconnected.ws.close();
  });
});
