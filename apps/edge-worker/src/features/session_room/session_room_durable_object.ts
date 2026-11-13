import {
  ViewerCommandSchema,
  type HostToRoomMessage,
  type HudSessionSnapshot,
  type RoomToClientMessage,
  type ViewerPresenceEntry,
} from "@exile-hud/core";
import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { containsForbiddenSecret, SessionRoomSqliteRepository } from "./session_room_sqlite_repository.js";

const RegisterBodySchema = z.object({
  roomId: z.string().min(3).max(32).optional(),
  hostSecret: z.string().min(6).max(128),
  pin: z.string().min(4).max(8),
  snapshot: z.custom<HudSessionSnapshot>((val) => typeof val === "object" && val !== null),
});

interface SocketAttachment {
  role: "host" | "viewer";
  connectionId: string;
  deviceLabel: string;
  connectedAt: number;
}

/** Hibernating WebSocket + SQLite Durable Object managing one companion HUD room. */
export class SessionRoomDurableObject extends DurableObject<unknown> {
  private readonly repo: SessionRoomSqliteRepository;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.repo = new SessionRoomSqliteRepository(ctx.storage.sql);
  }

  async fetch(request: Request): Promise<Response> {
    if (containsForbiddenSecret(request.url)) {
      return Response.json({ error: "POESESSID is prohibited from edge relay requests." }, { status: 400 });
    }

    const url = new URL(request.url);
    if (url.pathname === "/register" && request.method === "POST") {
      return this.handleRegister(request, url);
    }
    if (url.pathname === "/ws" && request.method === "GET") {
      return this.handleWebSocketUpgrade(request, url);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  private async handleRegister(request: Request, url: URL): Promise<Response> {
    const rawBody = await request.text();
    if (containsForbiddenSecret(rawBody)) {
      return Response.json({ error: "POESESSID must never leave the PC keychain." }, { status: 400 });
    }

    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = RegisterBodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return Response.json({ error: "Invalid registration payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const roomId = (parsed.data.roomId ?? url.searchParams.get("roomId") ?? parsed.data.snapshot.roomId).toUpperCase();
    const result = this.repo.registerOrUpdateRoom({
      roomId,
      hostSecret: parsed.data.hostSecret,
      pin: parsed.data.pin,
      snapshot: parsed.data.snapshot,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const viewers = this.collectViewerPresence();
    this.broadcastToRole("role:viewer", {
      type: "room:state_patch",
      snapshot: parsed.data.snapshot,
      eventTag: "room_registered",
    });

    return Response.json({ ok: true, roomId, viewerCount: viewers.length });
  }

  private handleWebSocketUpgrade(request: Request, url: URL): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "Expected WebSocket upgrade." }, { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const role = url.searchParams.get("role");
    const meta = this.repo.getRoomMeta();

    if (!meta) {
      server.accept();
      server.close(4001, "Room not found");
      return new Response(null, { status: 101, webSocket: client });
    }

    if (role === "host") {
      if (url.searchParams.get("secret") !== meta.host_secret) {
        server.accept();
        server.close(4003, "Invalid host secret");
        return new Response(null, { status: 101, webSocket: client });
      }
    } else if (role === "viewer") {
      if (url.searchParams.get("pin") !== meta.pin) {
        server.accept();
        server.close(4003, "Invalid room PIN");
        return new Response(null, { status: 101, webSocket: client });
      }
    } else {
      server.accept();
      server.close(4003, "Invalid role");
      return new Response(null, { status: 101, webSocket: client });
    }

    const connectionId = crypto.randomUUID().slice(0, 8);
    const deviceLabel = (url.searchParams.get("device") || (role === "host" ? "PC Host" : "Viewer")).slice(0, 48);
    const attachment: SocketAttachment = { role, connectionId, deviceLabel, connectedAt: Date.now() };

    this.ctx.acceptWebSocket(server, [`role:${role}`]);
    server.serializeAttachment(attachment);

    const snapshot = this.repo.getSnapshot();
    const layouts = this.repo.getLayouts();
    const viewers = this.collectViewerPresence();
    if (snapshot) {
      this.sendJson(server, { type: "room:hydrated_state", snapshot, layouts, viewers });
    }
    if (role === "viewer") {
      this.broadcastAll({ type: "room:viewer_presence", viewers });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (containsForbiddenSecret(raw)) {
      ws.close(1008, "POESESSID forbidden on WebSocket transport");
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) return;

    if (attachment.role === "host") {
      const hostMsg = payload as HostToRoomMessage;
      if ((hostMsg.type === "host:full_snapshot" || hostMsg.type === "host:state_patch") && hostMsg.snapshot) {
        this.repo.saveSnapshot(hostMsg.snapshot);
        const eventTag = hostMsg.type === "host:state_patch" ? hostMsg.eventTag : "full_snapshot";
        this.broadcastToRole("role:viewer", {
          type: "room:state_patch",
          snapshot: hostMsg.snapshot,
          eventTag,
        });
      }
      return;
    }

    const parsed = ViewerCommandSchema.safeParse(payload);
    if (!parsed.success) return;
    const cmd = parsed.data;

    if (cmd.type === "viewer:save_widget_layout") {
      this.repo.saveLayout(cmd.deviceFormFactor, cmd.mode, cmd.items);
      this.broadcastAll({
        type: "room:layout_updated",
        deviceFormFactor: cmd.deviceFormFactor,
        mode: cmd.mode,
        items: cmd.items,
      });
    } else {
      const patched = this.repo.applyViewerToggleToSnapshot(cmd);
      if (patched) {
        this.broadcastToRole("role:viewer", { type: "room:state_patch", snapshot: patched, eventTag: cmd.type });
      }
    }

    this.broadcastToRole("role:host", { type: "room:command_forwarded", command: cmd });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const viewers = this.collectViewerPresence(ws);
    this.broadcastAll({ type: "room:viewer_presence", viewers }, ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const viewers = this.collectViewerPresence(ws);
    this.broadcastAll({ type: "room:viewer_presence", viewers }, ws);
  }

  private collectViewerPresence(exclude?: WebSocket): ViewerPresenceEntry[] {
    const entries: ViewerPresenceEntry[] = [];
    for (const sock of this.ctx.getWebSockets("role:viewer")) {
      if (exclude && sock === exclude) continue;
      const meta = sock.deserializeAttachment() as SocketAttachment | null;
      if (!meta || meta.role !== "viewer") continue;
      entries.push({
        connectionId: meta.connectionId,
        deviceLabel: meta.deviceLabel,
        connectedAt: meta.connectedAt,
      });
    }
    return entries;
  }

  private sendJson(ws: WebSocket, msg: RoomToClientMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket already closing
    }
  }

  private broadcastToRole(tag: "role:host" | "role:viewer", msg: RoomToClientMessage): void {
    const encoded = JSON.stringify(msg);
    for (const sock of this.ctx.getWebSockets(tag)) {
      try {
        sock.send(encoded);
      } catch {
        // Ignore stale socket
      }
    }
  }

  private broadcastAll(msg: RoomToClientMessage, exclude?: WebSocket): void {
    const encoded = JSON.stringify(msg);
    for (const sock of this.ctx.getWebSockets()) {
      if (exclude && sock === exclude) continue;
      try {
        sock.send(encoded);
      } catch {
        // Ignore stale socket
      }
    }
  }
}
