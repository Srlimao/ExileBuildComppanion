import type { ViewerPresenceEntry } from "@exile-hud/core";
import { Check, Copy, Link2, RefreshCw, Users, Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

interface QrRoomPairingCardProps {
  roomId: string;
  pin: string;
  relayUrl: string;
  relayConnected: boolean;
  relayError: string | null;
  viewers: ViewerPresenceEntry[];
  onChangeRelayUrl: (nextUrl: string) => void;
  onRotatePin: () => void;
  onReconnectRelay: () => void;
}

export function QrRoomPairingCard({
  roomId,
  pin,
  relayUrl,
  relayConnected,
  relayError,
  viewers,
  onChangeRelayUrl,
  onRotatePin,
  onReconnectRelay,
}: QrRoomPairingCardProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [draftRelay, setDraftRelay] = useState(relayUrl);

  const normalizedBase = relayUrl.replace(/\/+$/, "");
  const pairUrl = `${normalizedBase}/?room=${encodeURIComponent(roomId)}&pin=${encodeURIComponent(pin)}`;

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(pairUrl).catch(() => undefined);
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1500);
  };

  return (
    <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Second-Screen Pairing</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            relayConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {relayConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {relayConnected ? "Relay Live" : "Offline / Local"}
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <div className="bg-white p-2 rounded-lg shrink-0">
          <QRCodeSVG value={pairUrl} size={92} level="M" includeMargin={false} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Room ID</div>
              <div className="font-mono text-sm font-semibold tracking-wider text-white">{roomId}</div>
            </div>
            <div className="rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-400">PIN</div>
                <div className="font-mono text-sm font-semibold tracking-widest text-amber-300">{pin}</div>
              </div>
              <button
                type="button"
                onClick={onRotatePin}
                title="Rotate 4-digit PIN"
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedUrl ? "Copied URL" : "Copy Pair Link"}
            </button>
            <button
              type="button"
              onClick={onReconnectRelay}
              className="rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 px-2.5 py-1.5 text-xs font-medium text-indigo-300 cursor-pointer"
            >
              Sync Room
            </button>
          </div>
        </div>
      </div>

      {relayError && (
        <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
          {relayError}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span>Cloudflare Relay URL</span>
          <button
            type="button"
            onClick={() => {
              setDraftRelay("http://127.0.0.1:8787");
              onChangeRelayUrl("http://127.0.0.1:8787");
            }}
            className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            Use local :8787
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            type="url"
            value={draftRelay}
            onChange={(e) => setDraftRelay(e.target.value)}
            className="flex-1 rounded-lg bg-black border border-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => onChangeRelayUrl(draftRelay.trim())}
            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 cursor-pointer"
          >
            Set
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/70">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          Connected screens: {viewers.length}
        </span>
        <span className="truncate max-w-[200px] text-neutral-300">
          {viewers.length > 0 ? viewers.map((v) => v.deviceLabel).join(", ") : "None yet"}
        </span>
      </div>
    </section>
  );
}
