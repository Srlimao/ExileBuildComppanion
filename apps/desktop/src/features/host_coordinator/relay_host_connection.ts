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
  onViewersChange: (viewers: ViewerPresenceEntry[]) => void;
  onViewerCommand: (cmd: ViewerToRoomMessage) => void;
}

export async function registerAndOpenHostRelaySocket(params: RegisterAndOpenRelayParams): Promise<WebSocket> {
  const base = params.relayUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/session/${encodeURIComponent(params.roomId)}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: params.roomId,
      hostSecret: params.hostSecret,
      pin: params.pin,
      snapshot: params.snapshot,
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const wsBase = base.replace(/^http/i, "ws");
  const ws = new WebSocket(
    `${wsBase}/api/session/${encodeURIComponent(params.roomId)}/ws?role=host&secret=${encodeURIComponent(params.hostSecret)}&device=PC%20Control%20Center`,
  );

  ws.onopen = () => {
    params.onConnected();
    ws.send(JSON.stringify({ type: "host:full_snapshot", snapshot: params.getLatestSnapshot() ?? params.snapshot }));
  };
  ws.onclose = () => params.onDisconnected();
  ws.onerror = () => params.onDisconnected();
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

  return ws;
}
