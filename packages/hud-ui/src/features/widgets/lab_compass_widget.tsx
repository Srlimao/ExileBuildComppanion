import { parsePoelabDailyJson, type HudSessionSnapshot } from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { localizeIzaroGuide } from "../i18n/telemetry_advisor_localizer.js";

interface LabCompassWidgetProps {
  snapshot: HudSessionSnapshot;
  onImportPoelabJson: (rawJson: string) => void;
}

export function LabCompassWidget({ snapshot, onImportPoelabJson }: LabCompassWidgetProps) {
  const { locale, msg } = useHudI18n();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const izaroGuides = poe1GameAdapter.getIzaroMechanics().map((g) => localizeIzaroGuide(g, locale));
  const trials = poe1GameAdapter.getLabTrials();

  const tryImport = (rawText: string): boolean => {
    try {
      parsePoelabDailyJson(rawText);
      setImportError(null);
      onImportPoelabJson(rawText);
      return true;
    } catch {
      setImportError(msg.a11y.invalidPoelabJson);
      return false;
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    tryImport(await file.text());
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.labCompass} · {snapshot.lab.difficultyLabel}
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <label className="px-2 py-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle inline-flex items-center gap-1 cursor-pointer transition-colors focus-within:outline-2 focus-within:outline-hud-accent">
            <Upload className="h-3.5 w-3.5" />
            <span>{msg.widgets.importJson}</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => void handleFileUpload(e)}
            />
          </label>
          <button
            type="button"
            aria-expanded={showPaste}
            onClick={() => {
              setShowPaste((v) => !v);
              setImportError(null);
            }}
            className="px-2 py-1 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer transition-colors"
          >
            {showPaste ? msg.widgets.hidePaste : msg.widgets.paste}
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            aria-label={msg.widgets.pastePlaceholder}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (importError) setImportError(null);
            }}
            placeholder={msg.widgets.pastePlaceholder}
            className="flex-1 rounded-lg bg-hud-subtle border-b border-hud-hairline focus:border-hud-accent px-2.5 py-1.5 text-xs font-mono text-hud-text"
          />
          <button
            type="button"
            onClick={() => {
              if (!pasteText.trim()) return;
              if (tryImport(pasteText)) {
                setShowPaste(false);
                setPasteText("");
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-hud-accent text-hud-accent-fg text-xs font-semibold cursor-pointer"
          >
            {msg.widgets.load}
          </button>
        </div>
      )}

      {importError && (
        <p role="alert" className="text-xs text-hud-danger border-l-2 border-hud-danger pl-2.5 py-0.5">
          {importError}
        </p>
      )}

      {snapshot.lab.hasDailyLayout ? (
        <div className="space-y-0.5 overflow-y-auto max-h-48 pr-1">
          {snapshot.lab.rooms.map((room) => {
            const active = room.id === snapshot.lab.currentRoomId;
            return (
              <div
                key={room.id}
                className={`px-2 py-1.5 rounded-lg flex items-baseline justify-between gap-2 text-sm ${
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
          {msg.widgets.noDailyLabJson} <code className="font-mono text-hud-text">areaSeed</code>.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pt-2 border-t border-hud-hairline">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-hud-muted uppercase tracking-[0.12em]">
            {msg.widgets.izaroPhases}
          </div>
          {izaroGuides.slice(0, 4).map((g) => (
            <div key={g.phase} className="text-xs text-hud-muted">
              <span className="font-semibold text-hud-text">{g.phase}:</span> {g.counterplay}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-[11px] font-semibold text-hud-muted uppercase tracking-[0.12em]">
            <span>{msg.widgets.campaignTrials}</span>
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
