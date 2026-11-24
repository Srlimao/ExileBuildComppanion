import type { HudSessionSnapshot, SupportedGameId } from "@exile-hud/core";
import { ExileRelayBrandIcon, ThemeSelectorPopover, useHudI18n } from "@exile-hud/hud-ui";
import { Eye, EyeOff } from "lucide-react";
import { QuickQrPairPopover } from "../pairing_panel/quick_qr_pair_popover.js";

export type DesktopTabKey = "builds" | "overlay" | "connect" | "game";

interface DesktopControlHeaderProps {
  activeGameId: SupportedGameId;
  onSelectGame: (gameId: SupportedGameId) => void;
  tab: DesktopTabKey;
  onSelectTab: (tab: DesktopTabKey) => void;
  snapshot: HudSessionSnapshot | null;
  overlayEnabled: boolean;
  overlayToggleHotkey: string;
  onToggleOverlay: () => void;
  roomId: string;
  pin: string;
  relayUrl: string;
  relayConnected: boolean;
  viewerCount: number;
  onRotatePin: () => void;
}

const TAB_KEYS: readonly DesktopTabKey[] = ["builds", "overlay", "connect", "game"];
const GAME_KEYS: readonly SupportedGameId[] = ["poe1", "poe2"];

/** Compact 2-row tray-companion header with PoE 1/2 switcher, live status, Quick-QR, and nav. */
export function DesktopControlHeader({
  activeGameId,
  onSelectGame,
  tab,
  onSelectTab,
  snapshot,
  overlayEnabled,
  overlayToggleHotkey,
  onToggleOverlay,
  roomId,
  pin,
  relayUrl,
  relayConnected,
  viewerCount,
  onRotatePin,
}: DesktopControlHeaderProps) {
  const { msg, appMsg } = useHudI18n();
  const poeRunning = Boolean(snapshot?.poeRunning);

  return (
    <header className="shrink-0 bg-hud-surface border-b border-hud-hairline px-4 pt-3 pb-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ExileRelayBrandIcon className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-hud-text leading-tight truncate">
              Exile Relay
            </h1>
            <p className="text-[10px] font-mono text-hud-muted flex items-center gap-1.5 truncate">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  poeRunning ? "bg-hud-ok" : "bg-hud-warn"
                }`}
              />
              <span className="truncate">
                {snapshot
                  ? `${msg.modes[snapshot.mode]} · ${snapshot.currentAreaName}`
                  : appMsg.desktop.initializing}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div
            role="group"
            aria-label={appMsg.poe2.gameSwitchAria}
            className="inline-flex items-center p-0.5 rounded-lg bg-hud-bg border border-hud-hairline"
          >
            {GAME_KEYS.map((id) => {
              const selected = activeGameId === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`game-mode-${id}`}
                  aria-pressed={selected}
                  title={appMsg.poe2.gameFullLabels[id]}
                  onClick={() => onSelectGame(id)}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${
                    selected
                      ? "bg-hud-accent text-hud-accent-fg shadow-sm"
                      : "text-hud-muted hover:text-hud-text"
                  }`}
                >
                  {appMsg.poe2.gameShortLabels[id]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleOverlay}
            title={appMsg.desktop.toggleOverlayTitle(overlayToggleHotkey)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              overlayEnabled
                ? "text-hud-ok bg-hud-subtle"
                : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle"
            }`}
          >
            {overlayEnabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            HUD
          </button>

          <QuickQrPairPopover
            roomId={roomId}
            pin={pin}
            relayUrl={relayUrl}
            relayConnected={relayConnected}
            viewerCount={viewerCount}
            onRotatePin={onRotatePin}
            onOpenConnectTab={() => onSelectTab("connect")}
          />

          <ThemeSelectorPopover compact />
        </div>
      </div>

      <nav className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-hud-bg border border-hud-hairline text-xs font-medium">
        {TAB_KEYS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectTab(key)}
              className={`py-1.5 rounded-lg cursor-pointer transition-colors truncate px-1 ${
                active
                  ? "bg-hud-surface text-hud-text font-semibold shadow-sm border border-hud-hairline/80"
                  : "text-hud-muted hover:text-hud-text hover:bg-hud-subtle border border-transparent"
              }`}
            >
              {appMsg.desktop.tabs[key]}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
