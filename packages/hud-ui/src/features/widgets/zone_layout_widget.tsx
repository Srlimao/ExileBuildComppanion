import type { HudSessionSnapshot } from "@exile-hud/core";
import { Compass, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccessibleDialog } from "../hud_shell/use_accessible_dialog.js";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizeRouteSubNote } from "../i18n/route_subnote_localizer.js";
import { Poe2ZoneLandmarksPanel } from "./poe2_zone_landmarks_panel.js";

export function ZoneLayoutWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const { locale, msg } = useHudI18n();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const zoomDialogRef = useAccessibleDialog({ open: zoomed, onClose: () => setZoomed(false) });

  useEffect(() => {
    setSelectedIdx(0);
  }, [snapshot.currentAreaId]);

  if (snapshot.gameId === "poe2") {
    return <Poe2ZoneLandmarksPanel snapshot={snapshot} />;
  }

  const variants = snapshot.zoneLayoutPaths;
  const activeSrc = variants[selectedIdx] ?? variants[0] ?? null;

  const zoneCheckpoints = snapshot.checkpoints.filter(
    (cp) => cp.areaId === snapshot.currentAreaId && (cp.subNotes.length > 0 || cp.directions.length > 0),
  );
  const directions = Array.from(new Set(zoneCheckpoints.flatMap((c) => c.directions)));
  const subNotes = zoneCheckpoints.flatMap((c) => c.subNotes);

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.zoneLayout}
        </h2>
        <div className="flex items-center gap-2.5 text-xs font-mono text-hud-muted">
          {directions.map((deg) => (
            <span key={deg} className="inline-flex items-center gap-1 text-hud-accent">
              <Compass className="h-3.5 w-3.5" style={{ transform: `rotate(${deg}deg)` }} />
              {deg}°
            </span>
          ))}
          {variants.length > 1 && (
            <span className="tabular-nums">
              {selectedIdx + 1}/{variants.length}
            </span>
          )}
        </div>
      </div>

      {activeSrc ? (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={msg.a11y.zoomZoneImage}
          title={msg.a11y.zoomZoneImage}
          className="group relative flex-1 min-h-[150px] w-full rounded-lg bg-hud-subtle overflow-hidden flex items-center justify-center cursor-pointer"
        >
          <img
            src={activeSrc}
            alt={msg.widgets.layoutAlt(snapshot.currentAreaName, selectedIdx + 1)}
            decoding="async"
            className="max-h-64 w-full object-contain"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 p-2 rounded-lg bg-hud-surface/85 text-hud-muted group-hover:text-hud-text"
          >
            <ZoomIn className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <p className="text-xs text-hud-muted py-4">{msg.widgets.linearZoneHint}</p>
      )}

      {variants.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {variants.map((path, idx) => (
            <button
              key={path}
              type="button"
              aria-pressed={idx === selectedIdx}
              onClick={() => setSelectedIdx(idx)}
              className={`py-1.5 text-xs font-mono border-b-2 shrink-0 cursor-pointer transition-colors ${
                idx === selectedIdx
                  ? "border-hud-accent text-hud-text font-semibold"
                  : "border-transparent text-hud-muted hover:text-hud-text"
              }`}
            >
              {msg.widgets.seedLabel(idx + 1)}
            </button>
          ))}
        </div>
      )}

      {subNotes.length > 0 && (
        <ul className="space-y-1 text-xs text-hud-text/85">
          {subNotes.map((note, idx) => (
            <li key={`${note}-${idx}`} className="flex items-start gap-2">
              <span className="text-hud-accent font-bold">·</span>
              <span>{localizeRouteSubNote(note, locale)}</span>
            </li>
          ))}
        </ul>
      )}

      {zoomed && activeSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => setZoomed(false)}
            aria-hidden="true"
          />
          <div
            ref={zoomDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={snapshot.currentAreaName}
            className="relative z-10 max-w-full max-h-[90vh] flex items-center justify-center focus:outline-none"
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label={msg.a11y.closeImageZoom}
              title={msg.a11y.closeImageZoom}
              className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 p-2.5 rounded-lg bg-hud-surface/90 border border-hud-hairline text-hud-text hover:bg-hud-subtle cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={activeSrc}
              alt={msg.widgets.layoutAlt(snapshot.currentAreaName, selectedIdx + 1)}
              decoding="async"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
