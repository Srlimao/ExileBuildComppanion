import { useHudI18n } from "@exile-hud/hud-ui";
import { History, MonitorSmartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ConnectionPhase } from "./edge_websocket_room_client.js";
import { clearCachedRoomSnapshot } from "./pwa_local_persistence.js";
import {
  clearRecentRoomId,
  loadRecentRoomId,
  loadRecentRoomSession,
  normalizeRoomCode,
  saveRecentRoomSession,
} from "./recent_room_storage.js";

interface RoomPairingFormCardProps {
  initialRoomId: string;
  initialPin: string;
  connectionPhase: ConnectionPhase;
  errorMessage: string | null;
  onJoinRoom: (roomId: string, pin: string) => void;
}

/** Room Code + 4-digit PIN pairing card with inline validation and recent room recall. */
export function RoomPairingFormCard({
  initialRoomId,
  initialPin,
  connectionPhase,
  errorMessage,
  onJoinRoom,
}: RoomPairingFormCardProps) {
  const { msg, appMsg } = useHudI18n();
  const [roomId, setRoomId] = useState(initialRoomId);
  const [pin, setPin] = useState(initialPin);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [recentRoomId, setRecentRoomId] = useState<string | null>(() => loadRecentRoomId());
  const [hasSavedPin, setHasSavedPin] = useState<boolean>(() => Boolean(loadRecentRoomSession()));
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRoomId(initialRoomId);
  }, [initialRoomId]);

  useEffect(() => {
    setPin(initialPin);
  }, [initialPin]);

  useEffect(() => {
    setRecentRoomId(loadRecentRoomId());
    setHasSavedPin(Boolean(loadRecentRoomSession()));
  }, [errorMessage]);

  const isConnecting = connectionPhase === "connecting" || connectionPhase === "reconnecting";
  const displayedError = validationError ?? errorMessage;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanRoom = normalizeRoomCode(roomId);
    const cleanPin = pin.trim();
    if (!cleanRoom || !cleanPin) {
      setValidationError(msg.a11y.enterRoomAndPin);
      return;
    }
    setValidationError(null);
    saveRecentRoomSession(cleanRoom, cleanPin, true);
    setRecentRoomId(loadRecentRoomId());
    setHasSavedPin(Boolean(loadRecentRoomSession()));
    onJoinRoom(cleanRoom, cleanPin);
  };

  const handleApplyRecentRoom = () => {
    if (!recentRoomId) return;
    setValidationError(null);
    const saved = loadRecentRoomSession();
    if (saved && saved.roomId === recentRoomId && saved.pin) {
      setRoomId(saved.roomId);
      setPin(saved.pin);
      onJoinRoom(saved.roomId, saved.pin);
      return;
    }
    setRoomId(recentRoomId);
    pinInputRef.current?.focus();
  };

  const handleClearRecentRoom = () => {
    clearRecentRoomId();
    clearCachedRoomSnapshot();
    setRecentRoomId(null);
    setHasSavedPin(false);
  };

  return (
    <section className="lg:col-span-5 order-1 lg:order-2 rounded-2xl bg-hud-surface border border-hud-hairline p-5 flex flex-col justify-between gap-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-hud-text">{appMsg.pwa.connectSecondScreen}</h2>
            <p className="text-xs text-hud-muted mt-0.5">{appMsg.pwa.connectSecondScreenDesc}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-hud-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-hud-accent">
            <span className="lg:hidden">{appMsg.pwa.mobileQuickPair}</span>
            <span className="hidden lg:inline">{appMsg.pwa.secondScreenSync}</span>
          </span>
        </div>

        {recentRoomId && (
          <div className="inline-flex items-center gap-1 rounded-lg bg-hud-subtle border border-hud-hairline pl-3 pr-1 py-0.5 text-xs">
            <button
              type="button"
              onClick={handleApplyRecentRoom}
              title={hasSavedPin ? appMsg.pwa.recentRoomReconnectTitle : undefined}
              className="inline-flex items-center gap-1.5 py-1.5 rounded-lg text-hud-text hover:text-hud-accent transition-colors cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-hud-muted" />
              <span className="text-hud-muted">{appMsg.pwa.recentRoom}</span>
              <span className="font-mono font-semibold tracking-wider">{recentRoomId}</span>
            </button>
            <button
              type="button"
              onClick={handleClearRecentRoom}
              aria-label={appMsg.pwa.clearRecentRoom}
              title={appMsg.pwa.clearRecentRoom}
              className="p-2 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-surface transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {displayedError && (
          <p role="alert" className="border-l-2 border-hud-danger pl-3 py-1 text-sm text-hud-danger">
            {displayedError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
              {appMsg.pwa.roomCode}
            </span>
            <input
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={roomId}
              onChange={(e) => {
                setRoomId(normalizeRoomCode(e.target.value));
                if (validationError) setValidationError(null);
              }}
              placeholder={appMsg.pwa.roomCodePlaceholder}
              className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:border-hud-accent"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
              {appMsg.pwa.fourDigitPin}
            </span>
            <input
              ref={pinInputRef}
              type="text"
              required
              autoComplete="off"
              inputMode="numeric"
              minLength={4}
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="1234"
              className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:border-hud-accent"
            />
          </label>

          <button
            type="submit"
            disabled={isConnecting}
            aria-busy={isConnecting}
            className="w-full rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed font-semibold py-2.5 text-sm transition-opacity flex items-center justify-center gap-2 cursor-pointer"
          >
            <MonitorSmartphone className="h-4 w-4 shrink-0" />
            <span>{isConnecting ? appMsg.pwa.connectingPc : appMsg.pwa.connectPc}</span>
          </button>
        </form>
      </div>

      <ol className="pt-4 border-t border-hud-hairline space-y-1.5 text-xs text-hud-muted">
        <li>
          <span className="font-mono text-hud-text mr-1.5">1.</span>
          {appMsg.pwa.step1Prefix} <span className="text-hud-text font-medium">ExileRelay.exe</span>{" "}
          {appMsg.pwa.step1Suffix}
        </li>
        <li>
          <span className="font-mono text-hud-text mr-1.5">2.</span>
          {appMsg.pwa.step2}
        </li>
        <li>
          <span className="font-mono text-hud-text mr-1.5">3.</span>
          {appMsg.pwa.step3}
        </li>
      </ol>
    </section>
  );
}
