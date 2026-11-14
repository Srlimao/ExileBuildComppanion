import type { HudSessionSnapshot } from "@exile-hud/core";
import { Compass, Map as MapIcon, ZoomIn } from "lucide-react";
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
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Zone Layout Seeds</h2>
        </div>
        <div className="flex items-center gap-2">
          {directions.map((deg) => (
            <span
              key={deg}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-xs font-mono text-indigo-200"
            >
              <Compass className="h-3.5 w-3.5" style={{ transform: `rotate(${deg}deg)` }} />
              {deg}°
            </span>
          ))}
          {variants.length > 1 && (
            <span className="text-xs font-mono text-neutral-400">
              {selectedIdx + 1}/{variants.length}
            </span>
          )}
        </div>
      </div>

      {activeSrc ? (
        <div className="relative flex-1 min-h-[160px] rounded-lg bg-black border border-neutral-800 overflow-hidden flex items-center justify-center">
          <img
            src={activeSrc}
            alt={`${snapshot.currentAreaName} layout seed ${selectedIdx + 1}`}
            className="max-h-64 w-full object-contain cursor-pointer"
            onClick={() => setZoomed(true)}
          />
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-[120px] rounded-lg bg-black border border-neutral-800 flex items-center justify-center text-sm text-neutral-500 p-4 text-center">
          Linear / Town zone — follow quest & exit direction markers below.
        </div>
      )}

      {variants.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {variants.map((path, idx) => (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border shrink-0 cursor-pointer ${
                idx === selectedIdx
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              Seed {idx + 1}
            </button>
          ))}
        </div>
      )}

      {subNotes.length > 0 && (
        <ul className="space-y-1 text-sm text-neutral-300">
          {subNotes.map((note, idx) => (
            <li key={`${note}-${idx}`} className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">•</span>
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
