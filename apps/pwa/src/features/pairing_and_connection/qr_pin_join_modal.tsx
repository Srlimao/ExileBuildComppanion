import { ThemeSelectorPopover } from "@exile-hud/hud-ui";
import { MonitorSmartphone, Play, QrCode } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DesktopCompanionDownloadCard } from "../desktop_download/desktop_companion_download_card.js";

interface QrPinJoinModalProps {
  initialRoomId: string;
  initialPin: string;
  errorMessage: string | null;
  onJoinRoom: (roomId: string, pin: string) => void;
  onStartDemo: () => void;
}

export function QrPinJoinModal({
  initialRoomId,
  initialPin,
  errorMessage,
  onJoinRoom,
  onStartDemo,
}: QrPinJoinModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [pin, setPin] = useState(initialPin);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !pin.trim()) return;
    onJoinRoom(roomId.trim().toUpperCase(), pin.trim());
  };

  return (
    <div className="min-h-screen bg-hud-bg text-hud-text flex items-center justify-center px-5 py-8 transition-colors">
      <div className="w-full max-w-md space-y-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <QrCode className="h-6 w-6 text-hud-accent shrink-0" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-hud-text">Exile Relay</h1>
              <p className="text-xs text-hud-muted mt-0.5">
                Pair with your PC Control Center via Room ID &amp; PIN
              </p>
            </div>
          </div>
          <ThemeSelectorPopover />
        </div>

        {errorMessage && (
          <p className="border-l-2 border-hud-danger pl-3 py-1 text-sm text-hud-danger">
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
              Room Code
            </span>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. EXILE9"
              className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:outline-none focus:border-hud-accent"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
              4-Digit PIN
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:outline-none focus:border-hud-accent"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold py-2.5 text-sm transition-opacity flex items-center justify-center gap-2 cursor-pointer"
          >
            <MonitorSmartphone className="h-4 w-4" />
            Connect to PC Host
          </button>
        </form>

        <div className="pt-5 border-t border-hud-hairline space-y-4">
          <DesktopCompanionDownloadCard />

          <button
            type="button"
            onClick={onStartDemo}
            className="w-full rounded-md py-2 text-sm font-medium text-hud-text hover:bg-hud-subtle flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Play className="h-4 w-4 text-hud-ok" />
            Preview Interactive Demo HUD
          </button>
        </div>

        <p className="text-[11px] text-center text-hud-dim">
          This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
        </p>
      </div>
    </div>
  );
}
