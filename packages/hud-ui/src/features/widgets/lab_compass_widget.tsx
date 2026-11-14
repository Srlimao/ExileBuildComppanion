import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";

interface LabCompassWidgetProps {
  snapshot: HudSessionSnapshot;
  onImportPoelabJson: (rawJson: string) => void;
}

export function LabCompassWidget({ snapshot, onImportPoelabJson }: LabCompassWidgetProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const izaroGuides = poe1GameAdapter.getIzaroMechanics();
  const trials = poe1GameAdapter.getLabTrials();

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportPoelabJson(await file.text());
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          Lab Compass · {snapshot.lab.difficultyLabel}
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <label className="text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer transition-colors">
            <Upload className="h-3.5 w-3.5" />
            <span>Import JSON</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => void handleFileUpload(e)} />
          </label>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="text-hud-muted hover:text-hud-text cursor-pointer transition-colors"
          >
            {showPaste ? "Hide Paste" : "Paste"}
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste PoELab daily JSON..."
            className="flex-1 rounded-md bg-hud-subtle border-b border-hud-hairline focus:border-hud-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-hud-text"
          />
          <button
            type="button"
            onClick={() => {
              if (!pasteText.trim()) return;
              onImportPoelabJson(pasteText);
              setShowPaste(false);
              setPasteText("");
            }}
            className="px-3 py-1.5 rounded-md bg-hud-accent text-hud-accent-fg text-xs font-semibold cursor-pointer"
          >
            Load
          </button>
        </div>
      )}

      {snapshot.lab.hasDailyLayout ? (
        <div className="space-y-0.5 overflow-y-auto max-h-48 pr-1">
          {snapshot.lab.rooms.map((room) => {
            const active = room.id === snapshot.lab.currentRoomId;
            return (
              <div
                key={room.id}
                className={`px-2 py-1.5 -mx-2 rounded-md flex items-baseline justify-between gap-2 text-sm ${
                  active ? "bg-hud-subtle text-hud-text font-semibold" : "text-hud-text/80"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: active ? "var(--hud-accent)" : "var(--hud-dim)" }}
                  />
                  <span className="truncate">
                    {room.id}. {room.name}
                  </span>
                </span>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  {room.hasGoldenDoor && <span className="text-hud-quest font-medium">Golden Door</span>}
                  {room.darkshrines > 0 && (
                    <span className="text-hud-accent font-mono">Darkshrine ×{room.darkshrines}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-hud-muted leading-relaxed">
          No daily PoELab JSON loaded yet — import from poelab.com to auto-track rooms by{" "}
          <code className="font-mono text-hud-text">areaSeed</code>.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pt-2 border-t border-hud-hairline">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-hud-muted uppercase tracking-[0.12em]">
            Izaro Phases
          </div>
          {izaroGuides.slice(0, 4).map((g) => (
            <div key={g.phase} className="text-xs text-hud-muted">
              <span className="font-semibold text-hud-text">{g.phase}:</span> {g.counterplay}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-[11px] font-semibold text-hud-muted uppercase tracking-[0.12em]">
            <span>Campaign Trials</span>
            <span className="text-hud-ok font-mono">
              {trials.filter((t) => snapshot.lab.completedTrialAreaIds.includes(t.areaId)).length}/{trials.length}
            </span>
          </div>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {trials.map((t) => {
              const done = snapshot.lab.completedTrialAreaIds.includes(t.areaId);
              return (
                <div
                  key={t.areaId}
                  className={`text-xs flex items-baseline justify-between gap-2 ${
                    done ? "text-hud-dim line-through" : "text-hud-text/85"
                  }`}
                >
                  <span className="truncate">{t.areaName}</span>
                  <span className="text-hud-muted font-mono shrink-0">A{t.act}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
