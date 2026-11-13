import type { HudSessionSnapshot, RoomToClientMessage, ViewerPresenceEntry, ViewerToRoomMessage } from "@exile-hud/core";

export interface RegisterAndOpenRelayParams {
  relayUrl: string;
  roomId: string;
  hostSecret: string;
  pin: string;
  snapshot: HudSessionSnapshot;
  getLatestSnapshot: () => HudSessionSnapshot | null;
  onConnected: () => void;
  onDisconnected: () => void;
  onError?: (message: string) => void;
  onViewersChange: (viewers: ViewerPresenceEntry[]) => void;
  onViewerCommand: (cmd: ViewerToRoomMessage) => void;
}

export interface HostRelaySession {
  sendPatch: (snapshot: HudSessionSnapshot, eventTag: string) => void;
  close: () => void;
}

/** Managed Host<->Relay session with 25s keepalive heartbeats and automatic exponential-backoff reconnect. */
export function createHostRelaySession(params: RegisterAndOpenRelayParams): HostRelaySession {
  let socket: WebSocket | null = null;
  let retryAttempt = 0;
  let retryTimer: number | null = null;
  let pingTimer: number | null = null;
  let closedManually = false;

  const clearTimers = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (pingTimer !== null) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (closedManually) return;
    const delayMs = Math.min(15_000, Math.round(1500 * Math.pow(1.6, retryAttempt)));
    retryAttempt += 1;
    params.onError?.(`${reason} — retrying in ${Math.round(delayMs / 1000)}s`);
    retryTimer = window.setTimeout(() => {
      void connectAttempt();
    }, delayMs);
  };

  const connectAttempt = async () => {
    clearTimers();
    if (closedManually) return;
    const base = params.relayUrl.replace(/\/+$/, "");
    const activeSnapshot = params.getLatestSnapshot() ?? params.snapshot;

    try {
      const res = await fetch(`${base}/api/session/${encodeURIComponent(params.roomId)}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: params.roomId,
          hostSecret: params.hostSecret,
          pin: params.pin,
          snapshot: activeSnapshot,
        }),
      });
      if (closedManually) return;
      if (res.status === 403 || res.status === 400) {
        params.onDisconnected();
        params.onError?.(`Relay rejected host registration (HTTP ${res.status})`);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const wsBase = base.replace(/^http/i, "ws");
      const ws = new WebSocket(
        `${wsBase}/api/session/${encodeURIComponent(params.roomId)}/ws?role=host&secret=${encodeURIComponent(params.hostSecret)}&device=PC%20Control%20Center`,
      );
      socket = ws;

      ws.onopen = () => {
        if (closedManually || socket !== ws) {
          ws.close();
          return;
        }
        retryAttempt = 0;
        params.onConnected();
        ws.send(JSON.stringify({ type: "host:full_snapshot", snapshot: params.getLatestSnapshot() ?? params.snapshot }));
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "host:ping" }));
          }
        }, 25_000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as RoomToClientMessage;
          if (msg.type === "room:hydrated_state" || msg.type === "room:viewer_presence") {
            params.onViewersChange(msg.viewers);
          } else if (msg.type === "room:command_forwarded") {
            params.onViewerCommand(msg.command);
          }
        } catch {
          // Ignore malformed server frame
        }
      };

      ws.onerror = () => {
        if (socket === ws) params.onDisconnected();
      };

      ws.onclose = (ev) => {
        if (pingTimer !== null) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (socket === ws) {
          socket = null;
        }
        params.onDisconnected();
        if (closedManually) return;
        if (ev.code === 4003) {
          params.onError?.("Relay rejected host secret (4003) — click Sync Room to refresh");
          return;
        }
        scheduleReconnect("Relay connection dropped");
      };
    } catch (err) {
      if (closedManually) return;
      params.onDisconnected();
      const detail = err instanceof Error ? err.message : String(err);
      scheduleReconnect(`Relay unreachable (${detail})`);
    }
  };

  void connectAttempt();

  return {
    sendPatch(snapshot: HudSessionSnapshot, eventTag: string) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "host:state_patch", snapshot, eventTag }));
      }
    },
    close() {
      closedManually = true;
      clearTimers();
      if (socket) {
        socket.close();
        socket = null;
      }
    },
  };
}
