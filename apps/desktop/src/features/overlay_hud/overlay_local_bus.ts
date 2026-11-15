import type { HudSessionSnapshot, ViewerToRoomMessage } from "@exile-hud/core";
import { useEffect, useRef, type MutableRefObject } from "react";

export const LOCAL_OVERLAY_BUS_CHANNEL = "exile_local_hud_bus_v1";

export type LocalOverlayBusMessage =
  | { type: "overlay:request_hydrate" }
  | { type: "host:snapshot"; snapshot: HudSessionSnapshot }
  | { type: "overlay:command"; command: ViewerToRoomMessage };

export interface OverlayViewerBusClient {
  sendCommand: (command: ViewerToRoomMessage) => void;
  requestHydrate: () => void;
  close: () => void;
}

function openChannel(channelName: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(channelName);
  } catch {
    return null;
  }
}

/** Local zero-Cloudflare BroadcastChannel client used by the PC overlay window. */
export function createOverlayViewerBusClient(
  onSnapshot: (snapshot: HudSessionSnapshot) => void,
  channelName = LOCAL_OVERLAY_BUS_CHANNEL,
): OverlayViewerBusClient {
  const channel = openChannel(channelName);
  if (channel) {
    channel.onmessage = (ev: MessageEvent<unknown>) => {
      const msg = ev.data as LocalOverlayBusMessage | null;
      if (msg && msg.type === "host:snapshot" && msg.snapshot) {
        onSnapshot(msg.snapshot);
      }
    };
    channel.postMessage({ type: "overlay:request_hydrate" } satisfies LocalOverlayBusMessage);
  }

  return {
    sendCommand: (command) => {
      channel?.postMessage({ type: "overlay:command", command } satisfies LocalOverlayBusMessage);
    },
    requestHydrate: () => {
      channel?.postMessage({ type: "overlay:request_hydrate" } satisfies LocalOverlayBusMessage);
    },
    close: () => {
      channel?.close();
    },
  };
}

/** Local zero-Cloudflare BroadcastChannel server mounted inside the PC Control Center host. */
export function createHostOverlayBusServer(params: {
  getLatestSnapshot: () => HudSessionSnapshot | null;
  onOverlayCommand: (command: ViewerToRoomMessage) => void;
  channelName?: string;
}): { broadcastSnapshot: (snapshot: HudSessionSnapshot) => void; close: () => void } {
  const channel = openChannel(params.channelName ?? LOCAL_OVERLAY_BUS_CHANNEL);
  if (channel) {
    channel.onmessage = (ev: MessageEvent<unknown>) => {
      const msg = ev.data as LocalOverlayBusMessage | null;
      if (!msg) return;
      if (msg.type === "overlay:request_hydrate") {
        const snap = params.getLatestSnapshot();
        if (snap) {
          channel.postMessage({ type: "host:snapshot", snapshot: snap } satisfies LocalOverlayBusMessage);
        }
        return;
      }
      if (msg.type === "overlay:command" && msg.command) {
        params.onOverlayCommand(msg.command);
      }
    };
  }

  return {
    broadcastSnapshot: (snapshot) => {
      channel?.postMessage({ type: "host:snapshot", snapshot } satisfies LocalOverlayBusMessage);
    },
    close: () => {
      channel?.close();
    },
  };
}

/** React hook keeping the in-process overlay window synchronized with the desktop host snapshot. */
export function useHostOverlayBroadcastBridge(
  snapshot: HudSessionSnapshot | null,
  snapshotRef: MutableRefObject<HudSessionSnapshot | null>,
  onOverlayCommand: (command: ViewerToRoomMessage) => void,
  getLatestSnapshot?: () => HudSessionSnapshot | null,
): void {
  const serverRef = useRef<ReturnType<typeof createHostOverlayBusServer> | null>(null);
  const cmdRef = useRef(onOverlayCommand);
  const getLatestRef = useRef(getLatestSnapshot);
  cmdRef.current = onOverlayCommand;
  getLatestRef.current = getLatestSnapshot;

  useEffect(() => {
    const server = createHostOverlayBusServer({
      getLatestSnapshot: () => getLatestRef.current?.() ?? snapshotRef.current,
      onOverlayCommand: (cmd) => cmdRef.current(cmd),
    });
    serverRef.current = server;
    if (snapshotRef.current) {
      server.broadcastSnapshot(snapshotRef.current);
    }
    return () => {
      server.close();
      serverRef.current = null;
    };
  }, [snapshotRef]);

  useEffect(() => {
    if (!snapshot) return;
    serverRef.current?.broadcastSnapshot(snapshot);
  }, [snapshot]);
}
