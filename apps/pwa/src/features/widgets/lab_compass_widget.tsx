import type { HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { CheckCircle2, Compass, KeyRound, ShieldAlert, Upload } from "lucide-react";
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Lab Compass — {snapshot.lab.difficultyLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="px-2.5 py-1 rounded-lg border border-neutral-700 bg-black text-xs text-neutral-200 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Import PoELab JSON
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => void handleFileUpload(e)} />
          </label>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="px-2.5 py-1 rounded-lg border border-neutral-800 text-xs text-neutral-400 hover:text-white cursor-pointer"
          >
            Paste
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="flex gap-2">
          <input
            type="text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste PoELab daily JSON..."
            className="flex-1 rounded-lg bg-black border border-neutral-800 px-3 py-1.5 text-xs font-mono text-white"
          />
          <button
            type="button"
            onClick={() => {
              if (!pasteText.trim()) return;
              onImportPoelabJson(pasteText);
              setShowPaste(false);
              setPasteText("");
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
          >
            Load
          </button>
        </div>
      )}

      {snapshot.lab.hasDailyLayout ? (
        <div className="space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {snapshot.lab.rooms.map((room) => {
            const active = room.id === snapshot.lab.currentRoomId;
            return (
              <div
                key={room.id}
                className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-sm ${
                  active ? "bg-indigo-950/40 border-indigo-500 text-white" : "bg-black border-neutral-800 text-neutral-300"
                }`}
              >
                <span className="font-semibold">
                  {room.id}. {room.name}
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  {room.hasGoldenDoor && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[#EAB308] inline-flex items-center gap-1">
                      <KeyRound className="h-3 w-3" /> Golden Door
                    </span>
                  )}
                  {room.darkshrines > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Darkshrine x{room.darkshrines}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg bg-black border border-neutral-800 p-3 text-xs text-neutral-400">
          No daily PoELab JSON loaded yet — import from poelab.com to auto-track rooms by <code className="text-neutral-200">areaSeed</code>.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto">
        <div className="rounded-lg bg-black border border-neutral-800 p-2.5 space-y-1">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Izaro Phases
          </div>
          {izaroGuides.slice(0, 4).map((g) => (
            <div key={g.phase} className="text-xs text-neutral-300">
              <span className="font-semibold text-white">{g.phase}:</span> {g.counterplay}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-black border border-neutral-800 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <span>Campaign Trials</span>
            <span className="text-emerald-400 font-mono">
              {trials.filter((t) => snapshot.lab.completedTrialAreaIds.includes(t.areaId)).length}/{trials.length}
            </span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {trials.map((t) => {
              const done = snapshot.lab.completedTrialAreaIds.includes(t.areaId);
              return (
                <div
                  key={t.areaId}
                  className={`text-xs flex items-center justify-between gap-2 ${done ? "text-emerald-300" : "text-neutral-300"}`}
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <CheckCircle2
                      className={`h-3 w-3 shrink-0 ${done ? "text-emerald-400" : "text-neutral-700"}`}
                    />
                    <span className={`truncate ${done ? "line-through text-emerald-400/80" : ""}`}>{t.areaName}</span>
                  </span>
                  <span className="text-neutral-500 shrink-0">A{t.act}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
