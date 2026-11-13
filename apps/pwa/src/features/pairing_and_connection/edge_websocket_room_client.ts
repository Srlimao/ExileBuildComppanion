import type {
  DeviceFormFactor,
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  RoomToClientMessage,
  ViewerToRoomMessage,
  WidgetGridItemLayout,
} from "@exile-hud/core";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface RoomConnectionCallbacks {
  onStatusChange: (status: ConnectionPhase, detail?: string) => void;
  onHydrated: (snapshot: HudSessionSnapshot, layouts: ModeWidgetGrids) => void;
  onSnapshotPatch: (snapshot: HudSessionSnapshot) => void;
  onLayoutUpdated: (formFactor: DeviceFormFactor, mode: HudContextMode, items: WidgetGridItemLayout[]) => void;
}

export function detectDeviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Browser";
  if (/iPad/i.test(ua)) return "iPad Tablet";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android Phone" : "Android Tablet";
  return "Second Monitor";
}

export function detectDeviceFormFactor(): DeviceFormFactor {
  if (typeof window === "undefined") return "tablet-landscape";
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.min(w, h) < 520) return "phone";
  return w >= h ? "tablet-landscape" : "tablet-portrait";
}

export class EdgeWebSocketRoomClient {
  private socket: WebSocket | null = null;
  private retryAttempt = 0;
  private retryTimer: number | null = null;
  private pingTimer: number | null = null;
  private closedManually = false;

  constructor(
    private readonly roomId: string,
    private readonly pin: string,
    private readonly callbacks: RoomConnectionCallbacks,
  ) {}

  connect(): void {
    this.closedManually = false;
    this.openSocket();
  }

  disconnect(): void {
    this.closedManually = true;
    this.clearTimers();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.callbacks.onStatusChange("idle");
  }

  private clearTimers(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  sendCommand(cmd: ViewerToRoomMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(cmd));
    }
  }

  private openSocket(): void {
    this.clearTimers();
    this.callbacks.onStatusChange(this.retryAttempt > 0 ? "reconnecting" : "connecting");
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const device = encodeURIComponent(detectDeviceLabel());
    const url = `${proto}//${window.location.host}/api/session/${encodeURIComponent(this.roomId)}/ws?role=viewer&pin=${encodeURIComponent(this.pin)}&device=${device}`;

    const ws = new WebSocket(url);
    this.socket = ws;

    ws.onopen = () => {
      this.retryAttempt = 0;
      this.callbacks.onStatusChange("connected");
      this.pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "viewer:ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as RoomToClientMessage;
        if (msg.type === "room:hydrated_state") {
          this.callbacks.onHydrated(msg.snapshot, msg.layouts);
        } else if (msg.type === "room:state_patch") {
          this.callbacks.onSnapshotPatch(msg.snapshot);
        } else if (msg.type === "room:layout_updated") {
          this.callbacks.onLayoutUpdated(msg.deviceFormFactor, msg.mode, msg.items);
        }
      } catch {
        // Ignore malformed server payload
      }
    };

    ws.onclose = (ev) => {
      if (this.pingTimer !== null) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.closedManually) return;
      if (ev.code === 4001 || ev.code === 4003) {
        this.callbacks.onStatusChange("error", "Invalid Room ID or 4-digit PIN");
        return;
      }
      const delayMs = Math.min(15_000, 1000 * Math.pow(1.6, this.retryAttempt));
      this.retryAttempt++;
      this.callbacks.onStatusChange("reconnecting", `Retrying in ${Math.round(delayMs / 1000)}s`);
      this.retryTimer = window.setTimeout(() => this.openSocket(), delayMs);
    };
  }
}
