import { useHudI18n } from "@exile-hud/hud-ui";
import { Check, Copy, QrCode, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

interface QuickQrPairPopoverProps {
  roomId: string;
  pin: string;
  relayUrl: string;
  relayConnected: boolean;
  viewerCount: number;
  onRotatePin: () => void;
  onOpenConnectTab: () => void;
}

/** Compact header popover for scanning/copying the companion pairing QR from any desktop tab. */
export function QuickQrPairPopover({
  roomId,
  pin,
  relayUrl,
  relayConnected,
  viewerCount,
  onRotatePin,
  onOpenConnectTab,
}: QuickQrPairPopoverProps) {
  const { appMsg } = useHudI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const normalizedBase = relayUrl.replace(/\/+$/, "");
  const pairUrl = `${normalizedBase}/?room=${encodeURIComponent(roomId)}&pin=${encodeURIComponent(pin)}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(pairUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={appMsg.desktop.quickPairTitle}
        title={appMsg.desktop.quickPairTitle}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 text-hud-text cursor-pointer transition-colors"
      >
        <QrCode className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl bg-hud-surface border border-hud-hairline p-3.5 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-hud-text">{appMsg.desktop.quickPairTitle}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
              aria-label={appMsg.desktop.cancel}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="bg-white p-2 rounded-xl mx-auto w-fit border border-hud-hairline">
            <QRCodeSVG value={pairUrl} size={116} level="M" includeMargin={false} />
          </div>

          <div className="flex items-center justify-center gap-1.5 font-mono text-xs">
            <span className="text-hud-text font-semibold tracking-wider">{roomId}</span>
            <span className="text-hud-muted">·</span>
            <span className="text-hud-quest font-bold tracking-widest">{pin}</span>
            <button
              type="button"
              onClick={onRotatePin}
              title={appMsg.desktop.rotatePinTitle}
              className="p-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 px-2.5 py-1.5 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? appMsg.desktop.copiedUrl : appMsg.desktop.copyPairLink}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenConnectTab();
              }}
              className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-2 py-1.5 text-[11px] text-hud-text cursor-pointer shrink-0"
            >
              {appMsg.desktop.openConnectTab}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline text-[10px]">
            <span className={`inline-flex items-center gap-1 font-medium ${relayConnected ? "text-hud-ok" : "text-hud-warn"}`}>
              {relayConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {relayConnected ? appMsg.desktop.relayLive : appMsg.desktop.offlineLocal}
            </span>
            <span className="text-hud-muted font-mono">{appMsg.desktop.connectedScreens(viewerCount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
