import type { ViewerPresenceEntry } from "@exile-hud/core";
import { localizeConnectionOrSyncMessage, useHudI18n } from "@exile-hud/hud-ui";
import { Check, ChevronDown, ChevronRight, Copy, RefreshCw, Users, Wifi, WifiOff } from "lucide-react";
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

/** Second-screen QR pairing card with a collapsible Advanced Relay URL accordion. */
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    <div className="space-y-3">
      <section className="rounded-2xl bg-hud-surface border border-hud-hairline p-4 space-y-3.5">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl border border-hud-hairline shrink-0">
            <QRCodeSVG value={pairUrl} size={96} level="M" includeMargin={false} />
          </div>

          <div className="flex-1 min-w-0 space-y-2.5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-hud-muted">
                {appMsg.desktop.roomId}
              </div>
              <div className="font-mono text-base font-bold tracking-wider text-hud-text">
                {roomId}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-hud-muted">
                  {appMsg.desktop.pin}
                </div>
                <div className="font-mono text-base font-bold tracking-widest text-hud-quest">
                  {pin}
                </div>
              </div>
              <button
                type="button"
                onClick={onRotatePin}
                title={appMsg.desktop.rotatePinTitle}
                className="text-hud-muted hover:text-hud-text p-1.5 rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex-1 rounded-xl bg-hud-accent text-hud-accent-fg hover:opacity-90 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedUrl ? appMsg.desktop.copiedUrl : appMsg.desktop.copyPairLink}
          </button>
          <button
            type="button"
            onClick={onReconnectRelay}
            className="rounded-xl bg-hud-subtle hover:bg-hud-hairline/50 px-3 py-2 text-xs font-medium text-hud-text cursor-pointer"
          >
            {appMsg.desktop.syncRoom}
          </button>
        </div>

        {localizedRelayError && (
          <p className="border-l-2 border-hud-warn pl-2.5 py-0.5 text-xs text-hud-warn">
            {localizedRelayError}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-hud-hairline text-[11px]">
          <span
            className={`inline-flex items-center gap-1 font-medium shrink-0 ${
              relayConnected ? "text-hud-ok" : "text-hud-warn"
            }`}
          >
            {relayConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {relayConnected ? appMsg.desktop.relayLive : appMsg.desktop.offlineLocal}
          </span>
          <span className="inline-flex items-center gap-1.5 text-hud-muted truncate">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {viewers.length > 0
                ? viewers.map((v) => v.deviceLabel).join(", ")
                : appMsg.desktop.connectedScreens(0)}
            </span>
          </span>
        </div>
      </section>

      <div className="rounded-xl border border-hud-hairline overflow-hidden">
        <button
          type="button"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full px-3.5 py-2.5 bg-hud-surface hover:bg-hud-subtle/60 flex items-center justify-between text-[11px] text-hud-muted hover:text-hud-text cursor-pointer transition-colors"
        >
          <span>{appMsg.desktop.advancedRelayToggle}</span>
          {showAdvanced ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-3 bg-hud-bg border-t border-hud-hairline space-y-2">
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
                className="flex-1 min-w-0 rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
              />
              <button
                type="button"
                onClick={() => onChangeRelayUrl(draftRelay.trim())}
                className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-2.5 py-1.5 text-xs font-medium text-hud-text cursor-pointer"
              >
                {appMsg.desktop.setBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
