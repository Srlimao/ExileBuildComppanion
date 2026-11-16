import type { DeviceFormFactor, HudContextMode } from "@exile-hud/core";
import { ExileRelayBrandIcon, useHudI18n } from "@exile-hud/hud-ui";
import { Compass, History, MonitorSmartphone, Play, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DesktopCompanionDownloadCard } from "../desktop_download/desktop_companion_download_card.js";
import { detectDeviceFormFactor, type ConnectionPhase } from "./edge_websocket_room_client.js";
import { LandingThemePlaygroundBar } from "./landing_theme_playground_bar.js";
import { clearRecentRoomId, loadRecentRoomId, normalizeRoomCode, saveRecentRoomId } from "./recent_room_storage.js";

interface QrPinJoinModalProps {
  initialRoomId: string;
  initialPin: string;
  connectionPhase?: ConnectionPhase;
  errorMessage: string | null;
  onJoinRoom: (roomId: string, pin: string) => void;
  onStartDemo: (initialMode?: HudContextMode) => void;
}

const DEMO_QUICK_MODES: ReadonlyArray<HudContextMode> = ["FIELD", "TOWN", "TREE", "LAB"];
const HIGHLIGHT_ICONS = [Compass, Sparkles, SlidersHorizontal] as const;

export function QrPinJoinModal({
  initialRoomId,
  initialPin,
  connectionPhase = "idle",
  errorMessage,
  onJoinRoom,
  onStartDemo,
}: QrPinJoinModalProps) {
  const { msg, appMsg } = useHudI18n();
  const [roomId, setRoomId] = useState(initialRoomId);
  const [pin, setPin] = useState(initialPin);
  const [recentRoomId, setRecentRoomId] = useState<string | null>(() => loadRecentRoomId());
  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(detectDeviceFormFactor);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onResize = () => setFormFactor(detectDeviceFormFactor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobileOrDeepLink = formFactor === "phone" || formFactor === "tablet-portrait";
  const isConnecting = connectionPhase === "connecting" || connectionPhase === "reconnecting";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanRoom = normalizeRoomCode(roomId);
    const cleanPin = pin.trim();
    if (!cleanRoom || !cleanPin) return;
    saveRecentRoomId(cleanRoom);
    setRecentRoomId(loadRecentRoomId());
    onJoinRoom(cleanRoom, cleanPin);
  };

  const handleApplyRecentRoom = () => {
    if (!recentRoomId) return;
    setRoomId(recentRoomId);
    pinInputRef.current?.focus();
  };

  const handleClearRecentRoom = () => {
    clearRecentRoomId();
    setRecentRoomId(null);
  };

  return (
    <div className="min-h-screen bg-hud-bg text-hud-text flex flex-col justify-center px-4 sm:px-6 py-5 transition-colors">
      <div className="w-full max-w-5xl mx-auto space-y-5">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ExileRelayBrandIcon className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-hud-text">Exile Relay</h1>
                <span className="rounded-md bg-hud-subtle border border-hud-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
                  {appMsg.pwa.pairingBadge}
                </span>
              </div>
              <p className="text-xs text-hud-muted mt-0.5">{appMsg.pwa.landingSubtitle}</p>
            </div>
          </div>

          <LandingThemePlaygroundBar />
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <section
            className={`lg:col-span-7 rounded-2xl bg-hud-surface border border-hud-hairline p-5 flex flex-col gap-4 ${
              isMobileOrDeepLink ? "order-2 lg:order-1" : "order-1"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {appMsg.pwa.highlights.map((item, idx) => {
                const Icon = HIGHLIGHT_ICONS[idx] ?? Compass;
                return (
                  <div key={item.title} className="rounded-lg bg-hud-subtle border border-hud-hairline px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-hud-text">
                      <Icon className="h-3.5 w-3.5 text-hud-accent shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                    <p className="text-[11px] text-hud-muted mt-0.5 leading-snug">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            <DesktopCompanionDownloadCard />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onStartDemo()}
                className="flex-1 min-w-[200px] rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold py-2 px-3.5 text-sm transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="h-4 w-4 shrink-0" />
                <span>{appMsg.pwa.launchDemo}</span>
              </button>

              <div className="inline-flex items-center gap-1 rounded-lg bg-hud-subtle border border-hud-hairline p-1">
                {DEMO_QUICK_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onStartDemo(mode)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide text-hud-muted hover:text-hud-text hover:bg-hud-surface transition-colors cursor-pointer"
                  >
                    {msg.modes[mode]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStartDemo()}
              className="group relative rounded-xl border border-hud-hairline hover:border-hud-accent/50 overflow-hidden bg-hud-bg transition-colors text-left cursor-pointer"
              title={appMsg.pwa.openDemoTitle}
            >
              <img
                src="/preview-modes-showcase.png"
                alt={appMsg.pwa.showcaseAlt}
                className="w-full h-auto block"
              />
            </button>
          </section>

          <section
            className={`lg:col-span-5 rounded-2xl bg-hud-surface border border-hud-hairline p-5 flex flex-col justify-between gap-5 ${
              isMobileOrDeepLink ? "order-1 lg:order-2" : "order-2"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-hud-text">{appMsg.pwa.connectSecondScreen}</h2>
                  <p className="text-xs text-hud-muted mt-0.5">{appMsg.pwa.connectSecondScreenDesc}</p>
                </div>
                <span className="shrink-0 rounded-md bg-hud-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-hud-accent">
                  {isMobileOrDeepLink ? appMsg.pwa.mobileQuickPair : appMsg.pwa.secondScreenSync}
                </span>
              </div>

              {recentRoomId && (
                <div className="inline-flex items-center gap-1 rounded-lg bg-hud-subtle border border-hud-hairline pl-2.5 pr-1 py-1 text-xs">
                  <button
                    type="button"
                    onClick={handleApplyRecentRoom}
                    className="inline-flex items-center gap-1.5 text-hud-text hover:text-hud-accent transition-colors cursor-pointer"
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
                    className="p-1 rounded text-hud-muted hover:text-hud-text hover:bg-hud-surface transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {errorMessage && (
                <p className="border-l-2 border-hud-danger pl-3 py-1 text-sm text-hud-danger">{errorMessage}</p>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
                    {appMsg.pwa.roomCode}
                  </span>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(normalizeRoomCode(e.target.value))}
                    placeholder={appMsg.pwa.roomCodePlaceholder}
                    className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:outline-none focus:border-hud-accent"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
                    {appMsg.pwa.fourDigitPin}
                  </span>
                  <input
                    ref={pinInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="1234"
                    className="w-full rounded-lg bg-hud-subtle border border-hud-hairline px-3 py-2.5 text-base font-mono tracking-widest text-hud-text focus:outline-none focus:border-hud-accent"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold py-2.5 text-sm transition-opacity flex items-center justify-center gap-2 cursor-pointer"
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
        </main>

        <footer className="text-center text-[11px] text-hud-dim">{appMsg.legalDisclaimer}</footer>
      </div>
    </div>
  );
}
