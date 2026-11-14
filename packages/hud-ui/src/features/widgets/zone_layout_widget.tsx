import type { HudSessionSnapshot } from "@exile-hud/core";
import { Compass, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";

export function ZoneLayoutWidget({ snapshot }: { snapshot: HudSessionSnapshot }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setSelectedIdx(0);
  }, [snapshot.currentAreaId]);

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
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Zone Layout</h2>
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
        <div className="relative flex-1 min-h-[150px] rounded-md bg-hud-subtle overflow-hidden flex items-center justify-center">
          <img
            src={activeSrc}
            alt={`${snapshot.currentAreaName} layout seed ${selectedIdx + 1}`}
            className="max-h-64 w-full object-contain cursor-pointer"
            onClick={() => setZoomed(true)}
          />
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="absolute bottom-2 right-2 p-1.5 rounded-md bg-hud-surface/85 text-hud-muted hover:text-hud-text cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-hud-muted py-4">
          Linear / Town zone — follow quest &amp; exit direction markers below.
        </p>
      )}

      {variants.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {variants.map((path, idx) => (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`pb-0.5 text-xs font-mono border-b-2 shrink-0 cursor-pointer transition-colors ${
                idx === selectedIdx
                  ? "border-hud-accent text-hud-text font-semibold"
                  : "border-transparent text-hud-muted hover:text-hud-text"
              }`}
            >
              Seed {idx + 1}
            </button>
          ))}
        </div>
      )}

      {subNotes.length > 0 && (
        <ul className="space-y-1 text-xs text-hud-text/85">
          {subNotes.map((note, idx) => (
            <li key={`${note}-${idx}`} className="flex items-start gap-2">
              <span className="text-hud-accent font-bold">·</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {zoomed && activeSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomed(false)}
        >
          <img src={activeSrc} alt={snapshot.currentAreaName} className="max-w-full max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
}
