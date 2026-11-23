import { RotateCcw, Skull } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

interface DeathRespawnResumeBannerProps {
  areaName: string;
  onDismiss: () => void;
}

export function DeathRespawnResumeBanner({ areaName, onDismiss }: DeathRespawnResumeBannerProps) {
  const { msg } = useHudI18n();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
      <div
        role="alert"
        className="border-l-2 border-hud-danger pl-3.5 py-2 bg-hud-subtle rounded-r-lg flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Skull className="h-4 w-4 text-hud-danger shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-hud-danger">
              {msg.deathBanner.slainPrefix}{" "}
              <span className="text-hud-text underline">{areaName}</span>
            </p>
            <p className="text-xs text-hud-muted truncate">
              {msg.deathBanner.subtextPrefix} {areaName}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-hud-muted hover:text-hud-text hover:bg-hud-subtle inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {msg.deathBanner.dismiss}
        </button>
      </div>
    </div>
  );
}
