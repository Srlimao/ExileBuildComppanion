import { useHudI18n } from "@exile-hud/hud-ui";
import { RefreshCw } from "lucide-react";
import { PULL_TRIGGER_DISTANCE_PX } from "./pull_to_refresh_math.js";
import { PWA_REFRESH_MESSAGES } from "./pwa_refresh_messages.js";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isReady: boolean;
  isRefreshing: boolean;
}

/** Floating OLED pill showing pull-to-refresh progress above the HUD header. */
export function PullToRefreshIndicator({
  pullDistance,
  isReady,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  const { locale } = useHudI18n();
  if (pullDistance <= 0 && !isRefreshing) return null;

  const t = PWA_REFRESH_MESSAGES[locale];
  const progress = Math.min(1, pullDistance / PULL_TRIGGER_DISTANCE_PX);
  const offsetPx = isRefreshing ? 44 : Math.max(8, Math.min(56, pullDistance * 0.65));
  const rotationDeg = Math.round(progress * 180);
  const label = isRefreshing ? t.refreshing : isReady ? t.releaseToRefresh : t.pullToRefresh;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-pull-refresh-indicator"
      style={{
        transform: `translate(-50%, calc(env(safe-area-inset-top, 0px) + ${Math.round(offsetPx)}px))`,
      }}
      className={`fixed top-0 left-1/2 z-40 pointer-events-none inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hud-surface/95 backdrop-blur border shadow-lg text-xs font-medium transition-colors ${
        isRefreshing || isReady
          ? "border-hud-accent text-hud-accent"
          : "border-hud-hairline text-hud-muted"
      }`}
    >
      <RefreshCw
        className={`h-3.5 w-3.5 shrink-0 ${isRefreshing ? "motion-safe:animate-spin" : ""}`}
        style={isRefreshing ? undefined : { transform: `rotate(${rotationDeg}deg)` }}
      />
      <span>{label}</span>
    </div>
  );
}
