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
  onStatusChange: (status: ConnectionPhase, detail?: string, closeCode?: number) => void;
  onHydrated: (snapshot: HudSessionSnapshot, layouts: ModeWidgetGrids) => void;
  onSnapshotPatch: (snapshot: HudSessionSnapshot) => void;
  onLayoutUpdated: (formFactor: DeviceFormFactor, mode: HudContextMode, items: WidgetGridItemLayout[]) => void;
}

const CONNECT_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 8_000;
const RESUME_PROBE_TIMEOUT_MS = 4_000;
const STALE_ACTIVITY_THRESHOLD_MS = 10_000;
const MAX_BACKOFF_MS = 10_000;

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
  private retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private pingTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  private connectTimeoutTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private pongWatchdogTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private lastActivityAtMs = 0;
  private connectStartedAtMs = 0;
  private closedManually = false;
  private listenersAttached = false;

  constructor(
    private readonly roomId: string,
    private readonly pin: string,
    private readonly callbacks: RoomConnectionCallbacks,
  ) {}

  private readonly onVisibilityChange = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.handleResumeSignal();
    }
  };

  private readonly onResumeEvent = (): void => {
    this.handleResumeSignal();
  };

  connect(): void {
    this.closedManually = false;
    this.attachLifecycleListeners();
    this.openSocket();
  }

  disconnect(): void {
    this.closedManually = true;
    this.detachLifecycleListeners();
    this.clearTimers();
    this.teardownCurrentSocket();
    this.callbacks.onStatusChange("idle");
  }

  reconnectNow(): void {
    if (this.closedManually) return;
    this.retryAttempt = 0;
    this.openSocket();
  }

  sendCommand(cmd: ViewerToRoomMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(cmd));
    }
  }

  private attachLifecycleListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onResumeEvent);
      window.addEventListener("pageshow", this.onResumeEvent);
      window.addEventListener("focus", this.onResumeEvent);
    }
  }

  private detachLifecycleListeners(): void {
    if (!this.listenersAttached) return;
    this.listenersAttached = false;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onResumeEvent);
      window.removeEventListener("pageshow", this.onResumeEvent);
      window.removeEventListener("focus", this.onResumeEvent);
    }
  }

  private clearTimers(): void {
    if (this.retryTimer !== null) {
      globalThis.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.pingTimer !== null) {
      globalThis.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.connectTimeoutTimer !== null) {
      globalThis.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.pongWatchdogTimer !== null) {
      globalThis.clearTimeout(this.pongWatchdogTimer);
      this.pongWatchdogTimer = null;
    }
  }

  private teardownCurrentSocket(): void {
    const prev = this.socket;
    this.socket = null;
    if (!prev) return;
    prev.onopen = null;
    prev.onmessage = null;
    prev.onerror = null;
    prev.onclose = null;
    try {
      prev.close();
    } catch {
      // Ignore already-closed socket
    }
  }

  private handleResumeSignal(): void {
    if (this.closedManually) return;
    const sock = this.socket;
    if (
      this.retryTimer !== null ||
      !sock ||
      sock.readyState === WebSocket.CLOSING ||
      sock.readyState === WebSocket.CLOSED
    ) {
      this.reconnectNow();
      return;
    }
    if (sock.readyState === WebSocket.CONNECTING) {
      if (Date.now() - this.connectStartedAtMs > CONNECT_TIMEOUT_MS) {
        this.reconnectNow();
      }
      return;
    }
    if (sock.readyState === WebSocket.OPEN && Date.now() - this.lastActivityAtMs > STALE_ACTIVITY_THRESHOLD_MS) {
      this.sendHeartbeatProbe(RESUME_PROBE_TIMEOUT_MS);
    }
  }

  private sendHeartbeatProbe(timeoutMs: number): void {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (this.pongWatchdogTimer !== null) {
      globalThis.clearTimeout(this.pongWatchdogTimer);
      this.pongWatchdogTimer = null;
    }
    try {
      ws.send(JSON.stringify({ type: "viewer:ping" }));
    } catch {
      this.forceRetryFromStalledSocket(ws);
      return;
    }
    this.pongWatchdogTimer = globalThis.setTimeout(() => {
      this.pongWatchdogTimer = null;
      if (this.socket === ws) {
        this.forceRetryFromStalledSocket(ws);
      }
    }, timeoutMs);
  }

  private forceRetryFromStalledSocket(ws: WebSocket): void {
    if (this.socket !== ws || this.closedManually) return;
    this.teardownCurrentSocket();
    this.clearTimers();
    this.retryAttempt = Math.max(1, this.retryAttempt);
    this.openSocket();
  }

  private openSocket(): void {
    this.clearTimers();
    this.teardownCurrentSocket();
    this.callbacks.onStatusChange(this.retryAttempt > 0 ? "reconnecting" : "connecting");

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const device = encodeURIComponent(detectDeviceLabel());
    const url = `${proto}//${window.location.host}/api/session/${encodeURIComponent(this.roomId)}/ws?role=viewer&pin=${encodeURIComponent(this.pin)}&device=${device}`;

    const ws = new WebSocket(url);
    this.socket = ws;
    this.connectStartedAtMs = Date.now();
    this.connectTimeoutTimer = globalThis.setTimeout(() => {
      this.connectTimeoutTimer = null;
      if (this.socket === ws && ws.readyState === WebSocket.CONNECTING) {
        this.forceRetryFromStalledSocket(ws);
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (this.socket !== ws) return;
      if (this.connectTimeoutTimer !== null) {
        globalThis.clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this.retryAttempt = 0;
      this.lastActivityAtMs = Date.now();
      this.callbacks.onStatusChange("connected");
      this.sendHeartbeatProbe(PONG_TIMEOUT_MS);
      this.pingTimer = globalThis.setInterval(() => {
        if (this.socket === ws) {
          this.sendHeartbeatProbe(PONG_TIMEOUT_MS);
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (this.socket !== ws) return;
      this.lastActivityAtMs = Date.now();
      if (this.pongWatchdogTimer !== null) {
        globalThis.clearTimeout(this.pongWatchdogTimer);
        this.pongWatchdogTimer = null;
      }
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
      if (this.socket !== ws) return;
      this.socket = null;
      this.clearTimers();
      if (this.closedManually) return;
      if (ev.code === 4001) {
        this.callbacks.onStatusChange(
          "error",
          "Room not found — check Room Code or click Sync Room on PC",
          4001,
        );
        return;
      }
      if (ev.code === 4003) {
        this.callbacks.onStatusChange("error", "Invalid 4-digit PIN", 4003);
        return;
      }
      const delayMs = Math.min(MAX_BACKOFF_MS, Math.round(1000 * Math.pow(1.6, this.retryAttempt)));
      this.retryAttempt++;
      this.callbacks.onStatusChange("reconnecting", `Retrying in ${Math.round(delayMs / 1000)}s`);
      this.retryTimer = globalThis.setTimeout(() => {
        this.retryTimer = null;
        this.openSocket();
      }, delayMs);
    };
  }
}
