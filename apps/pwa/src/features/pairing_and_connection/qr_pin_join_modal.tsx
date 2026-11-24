import type { HudContextMode, SupportedGameId } from "@exile-hud/core";
import { ExileRelayBrandIcon, useHudI18n } from "@exile-hud/hud-ui";
import { Compass, Play, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { DesktopCompanionDownloadCard } from "../desktop_download/desktop_companion_download_card.js";
import type { ConnectionPhase } from "./edge_websocket_room_client.js";
import { LandingThemePlaygroundBar } from "./landing_theme_playground_bar.js";
import { RoomPairingFormCard } from "./room_pairing_form_card.js";

interface QrPinJoinModalProps {
  initialRoomId: string;
  initialPin: string;
  connectionPhase?: ConnectionPhase;
  errorMessage: string | null;
  onJoinRoom: (roomId: string, pin: string) => void;
  onStartDemo: (initialMode?: HudContextMode, gameId?: SupportedGameId) => void;
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
  const [demoGame, setDemoGame] = useState<SupportedGameId>("poe1");

  return (
    <div className="min-h-screen bg-hud-bg text-hud-text flex flex-col justify-center pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] transition-colors">
      <div className="w-full max-w-5xl mx-auto space-y-5">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ExileRelayBrandIcon className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-hud-text">Exile Relay</h1>
                <span className="rounded-lg bg-hud-subtle border border-hud-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
                  {appMsg.pwa.pairingBadge}
                </span>
              </div>
              <p className="text-xs text-hud-muted mt-0.5">{appMsg.pwa.landingSubtitle}</p>
            </div>
          </div>

          <LandingThemePlaygroundBar />
        </header>

        <main id="hud-main-content" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <section className="lg:col-span-7 order-2 lg:order-1 rounded-2xl bg-hud-surface border border-hud-hairline p-5 flex flex-col gap-4">
            <h2 className="sr-only">{msg.a11y.showcaseSectionTitle}</h2>

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
              <div
                role="group"
                aria-label={appMsg.poe2.demoGameToggleTitle}
                className="inline-flex items-center gap-0.5 rounded-lg bg-hud-subtle border border-hud-hairline p-1"
              >
                {(["poe1", "poe2"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={demoGame === g}
                    onClick={() => setDemoGame(g)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      demoGame === g
                        ? "bg-hud-accent text-hud-accent-fg"
                        : "text-hud-muted hover:text-hud-text"
                    }`}
                  >
                    {appMsg.poe2.gameShortLabels[g]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onStartDemo(undefined, demoGame)}
                className="flex-1 min-w-[180px] rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold py-2 px-3.5 text-sm transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="h-4 w-4 shrink-0" />
                <span>{demoGame === "poe2" ? appMsg.poe2.launchPoe2Demo : appMsg.pwa.launchDemo}</span>
              </button>

              <div className="inline-flex items-center gap-1 rounded-lg bg-hud-subtle border border-hud-hairline p-1">
                {DEMO_QUICK_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onStartDemo(mode, demoGame)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide text-hud-muted hover:text-hud-text hover:bg-hud-surface transition-colors cursor-pointer"
                  >
                    {msg.modes[mode]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStartDemo(undefined, demoGame)}
              className="group relative rounded-xl border border-hud-hairline hover:border-hud-accent/50 overflow-hidden bg-hud-bg transition-colors text-left cursor-pointer"
              title={appMsg.pwa.openDemoTitle}
            >
              <img
                src="/preview-modes-showcase.png"
                alt={appMsg.pwa.showcaseAlt}
                width={1360}
                height={696}
                decoding="async"
                className="w-full h-auto block"
              />
            </button>
          </section>

          <RoomPairingFormCard
            initialRoomId={initialRoomId}
            initialPin={initialPin}
            connectionPhase={connectionPhase}
            errorMessage={errorMessage}
            onJoinRoom={onJoinRoom}
          />
        </main>

        <footer className="text-center text-[11px] text-hud-dim">{appMsg.legalDisclaimer}</footer>
      </div>
    </div>
  );
}
