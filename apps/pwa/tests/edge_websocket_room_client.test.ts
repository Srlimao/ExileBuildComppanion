import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EdgeWebSocketRoomClient,
  type ConnectionPhase,
} from "../src/features/pairing_and_connection/edge_websocket_room_client.js";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }

  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function installBrowserMocks() {
  const winListeners = new Map<string, Set<() => void>>();
  const docListeners = new Map<string, Set<() => void>>();
  let visibilityState = "visible";

  const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const origDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const origWebSocket = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");

  Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: MockWebSocket });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { protocol: "https:", host: "exile.dunhas.com" },
      innerWidth: 400,
      innerHeight: 800,
      addEventListener(type: string, fn: () => void) {
        if (!winListeners.has(type)) winListeners.set(type, new Set());
        winListeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: () => void) {
        winListeners.get(type)?.delete(fn);
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener(type: string, fn: () => void) {
        if (!docListeners.has(type)) docListeners.set(type, new Set());
        docListeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: () => void) {
        docListeners.get(type)?.delete(fn);
      },
    },
  });

  return {
    emitWindow(type: string) {
      winListeners.get(type)?.forEach((fn) => fn());
    },
    setVisibility(next: "visible" | "hidden") {
      visibilityState = next;
      docListeners.get("visibilitychange")?.forEach((fn) => fn());
    },
    restore() {
      if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (origDocument) Object.defineProperty(globalThis, "document", origDocument);
      else Reflect.deleteProperty(globalThis, "document");
      if (origWebSocket) Object.defineProperty(globalThis, "WebSocket", origWebSocket);
      else Reflect.deleteProperty(globalThis, "WebSocket");
    },
  };
}

describe("EdgeWebSocketRoomClient Android resilience", () => {
  let env: ReturnType<typeof installBrowserMocks>;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    env = installBrowserMocks();
  });

  afterEach(() => {
    env.restore();
    vi.useRealTimers();
  });

  it("accelerates backoff immediately on visibilitychange and online events", () => {
    const statuses: Array<{ phase: ConnectionPhase; closeCode?: number }> = [];
    const client = new EdgeWebSocketRoomClient("EXILE9", "1234", {
      onStatusChange: (phase, _detail, closeCode) => statuses.push({ phase, closeCode }),
      onHydrated: () => undefined,
      onSnapshotPatch: () => undefined,
      onLayoutUpdated: () => undefined,
    });

    client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);
    MockWebSocket.instances[0]!.close(1006);
    expect(statuses.at(-1)?.phase).toBe("reconnecting");

    env.setVisibility("visible");
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1]!.close(1006);
    env.emitWindow("online");
    expect(MockWebSocket.instances).toHaveLength(3);
    client.disconnect();
  });

  it("detects half-open zombie sockets via pong watchdog and replaces them cleanly", () => {
    const client = new EdgeWebSocketRoomClient("EXILE9", "1234", {
      onStatusChange: () => undefined,
      onHydrated: () => undefined,
      onSnapshotPatch: () => undefined,
      onLayoutUpdated: () => undefined,
    });

    client.connect();
    const first = MockWebSocket.instances[0]!;
    first.triggerOpen();
    expect(first.sent).toHaveLength(1);
    first.triggerMessage({ type: "room:pong", ts: Date.now() });

    // 25s heartbeat fires; server never replies within 8s watchdog -> replaces socket
    vi.advanceTimersByTime(25_000);
    expect(first.sent).toHaveLength(2);
    vi.advanceTimersByTime(8_000);

    expect(MockWebSocket.instances).toHaveLength(2);
    const second = MockWebSocket.instances[1]!;
    second.triggerOpen();

    // Late close from superseded socket must not affect active socket
    first.onclose?.({ code: 1006 });
    expect(MockWebSocket.instances).toHaveLength(2);
    client.disconnect();
  });

  it("stops retrying on 4003 and 4001 close codes and reports closeCode", () => {
    const statuses: Array<{ phase: ConnectionPhase; closeCode?: number }> = [];
    const client = new EdgeWebSocketRoomClient("EXILE9", "0000", {
      onStatusChange: (phase, _detail, closeCode) => statuses.push({ phase, closeCode }),
      onHydrated: () => undefined,
      onSnapshotPatch: () => undefined,
      onLayoutUpdated: () => undefined,
    });

    client.connect();
    MockWebSocket.instances[0]!.close(4003);
    expect(statuses.at(-1)).toEqual({ phase: "error", closeCode: 4003 });

    vi.advanceTimersByTime(30_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    client.disconnect();
  });
});
