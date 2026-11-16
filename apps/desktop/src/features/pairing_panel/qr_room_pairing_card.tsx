import type { ViewerPresenceEntry } from "@exile-hud/core";
import { localizeConnectionOrSyncMessage, useHudI18n } from "@exile-hud/hud-ui";
import { Check, Copy, RefreshCw, Users, Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

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
  const { locale, appMsg } = useHudI18n();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [draftRelay, setDraftRelay] = useState(relayUrl);

  useEffect(() => {
    setDraftRelay(relayUrl);
  }, [relayUrl]);

  const normalizedBase = relayUrl.replace(/\/+$/, "");
  const pairUrl = `${normalizedBase}/?room=${encodeURIComponent(roomId)}&pin=${encodeURIComponent(pin)}`;
  const localizedRelayError = localizeConnectionOrSyncMessage(relayError, locale);

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(pairUrl).catch(() => undefined);
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1500);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.desktop.secondScreenPairing}
        </h2>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            relayConnected ? "text-hud-ok" : "text-hud-warn"
          }`}
        >
          {relayConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {relayConnected ? appMsg.desktop.relayLive : appMsg.desktop.offlineLocal}
        </span>
      </div>

      <div className="flex items-start gap-4">
        <div className="bg-white p-2 rounded-lg border border-hud-hairline shrink-0">
          <QRCodeSVG value={pairUrl} size={92} level="M" includeMargin={false} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-hud-muted">{appMsg.desktop.roomId}</div>
              <div className="font-mono text-base font-semibold tracking-wider text-hud-text">{roomId}</div>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-hud-muted">{appMsg.desktop.pin}</div>
                <div className="font-mono text-base font-semibold tracking-widest text-hud-quest">{pin}</div>
              </div>
              <button
                type="button"
                onClick={onRotatePin}
                title={appMsg.desktop.rotatePinTitle}
                className="text-hud-muted hover:text-hud-text p-1 rounded hover:bg-hud-subtle cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex-1 rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedUrl ? appMsg.desktop.copiedUrl : appMsg.desktop.copyPairLink}
            </button>
            <button
              type="button"
              onClick={onReconnectRelay}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-hud-accent hover:bg-hud-subtle cursor-pointer"
            >
              {appMsg.desktop.syncRoom}
            </button>
          </div>
        </div>
      </div>

      {localizedRelayError && (
        <p className="border-l-2 border-hud-warn pl-2.5 py-0.5 text-xs text-hud-warn">{localizedRelayError}</p>
      )}

      <div className="space-y-1.5 pt-2 border-t border-hud-hairline">
        <div className="flex items-center justify-between text-[11px] text-hud-muted">
          <span>{appMsg.desktop.relayUrlLabel}</span>
          <button
            type="button"
            onClick={() => {
              setDraftRelay("http://127.0.0.1:8787");
              onChangeRelayUrl("http://127.0.0.1:8787");
            }}
            className="text-hud-accent hover:underline cursor-pointer"
          >
            {appMsg.desktop.useLocal8787}
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            type="url"
            value={draftRelay}
            onChange={(e) => setDraftRelay(e.target.value)}
            className="flex-1 rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
          />
          <button
            type="button"
            onClick={() => onChangeRelayUrl(draftRelay.trim())}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            {appMsg.desktop.setBtn}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-hud-muted pt-2 border-t border-hud-hairline">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {appMsg.desktop.connectedScreens(viewers.length)}
        </span>
        <span className="truncate max-w-[200px] text-hud-text">
          {viewers.length > 0 ? viewers.map((v) => v.deviceLabel).join(", ") : appMsg.desktop.noneYet}
        </span>
      </div>
    </section>
  );
}
