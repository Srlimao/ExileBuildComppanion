import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe2GameAdapter } from "@exile-hud/game-data";
import { AlertTriangle, Compass, MapPin } from "lucide-react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizeRouteSubNote } from "../i18n/route_subnote_localizer.js";

/** Displays PoE 2 campaign zone landmarks, exit cues, and boss tips instead of PoE 1 map seed images. */
export function Poe2ZoneLandmarksPanel({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, appMsg } = useHudI18n();
  const hint = poe2GameAdapter.getZoneLandmarkHints(snapshot.currentAreaId);
  const zoneCheckpoints = snapshot.checkpoints.filter(
    (cp) => cp.areaId === snapshot.currentAreaId && (cp.subNotes.length > 0 || cp.directions.length > 0),
  );
  const subNotes = zoneCheckpoints.flatMap((c) => c.subNotes);
  const degreeHints = Array.from(new Set(zoneCheckpoints.flatMap((c) => c.directions)));
  const exits = hint?.exitDirections ?? [];
  const landmarks = hint ? (locale === "pt-BR" ? hint.landmarksPtBr : hint.landmarksEn) : [];
  const bossTip = hint ? (locale === "pt-BR" ? hint.bossTipPtBr : hint.bossTipEn) : undefined;

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.poe2.zoneLandmarksTitle}
        </h2>
        <div className="flex items-center gap-2 text-xs font-mono text-hud-accent">
          {exits.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Compass className="h-3.5 w-3.5" />
              <span>
                {appMsg.poe2.exitDirectionsLabel}: {exits.join(" / ")}
              </span>
            </span>
          )}
          {degreeHints.map((deg) => (
            <span key={deg} className="inline-flex items-center gap-1">
              <Compass className="h-3.5 w-3.5" style={{ transform: `rotate(${deg}deg)` }} />
              {deg}°
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {landmarks.length > 0 && (
          <ul className="space-y-1.5 text-sm text-hud-text/90">
            {landmarks.map((line, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-snug">
                <MapPin className="h-3.5 w-3.5 text-hud-accent shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        {bossTip && (
          <div className="rounded-lg border border-hud-warn/45 bg-hud-warn/10 px-3 py-2 text-xs text-hud-warn space-y-0.5">
            <div className="font-semibold uppercase tracking-wider text-[10px] inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{appMsg.poe2.bossTipLabel}</span>
            </div>
            <p className="text-hud-text leading-snug">{bossTip}</p>
          </div>
        )}

        {subNotes.length > 0 && (
          <ul className="space-y-1 text-xs text-hud-muted pt-1 border-t border-hud-hairline">
            {subNotes.map((note, idx) => (
              <li key={`${note}-${idx}`} className="flex items-start gap-2">
                <span className="text-hud-accent font-bold">·</span>
                <span>{localizeRouteSubNote(note, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        {landmarks.length === 0 && !bossTip && subNotes.length === 0 && (
          <p className="text-xs text-hud-muted py-3 leading-relaxed">{appMsg.poe2.noZoneLandmarksHint}</p>
        )}
      </div>
    </div>
  );
}
