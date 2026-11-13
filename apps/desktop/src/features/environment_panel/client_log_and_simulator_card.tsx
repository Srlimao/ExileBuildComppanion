import { ClipboardCopy, Cpu, FileSearch, FlaskConical, Skull } from "lucide-react";
import { useState } from "react";

interface ClientLogAndSimulatorCardProps {
  clientLogPath: string;
  clientLogFound: boolean;
  autoClipboard: boolean;
  poeRunning: boolean;
  simulatedOutage: boolean;
  activeVendorRegex: string;
  onSetLogPath: (nextPath: string) => Promise<void>;
  onAutoDetectPath: () => Promise<void>;
  onToggleAutoClipboard: () => void;
  onCopyRegexNow: () => Promise<void>;
  onSimulateLogLines: (lines: string[]) => void;
  onToggleSimPoeRunning: () => void;
  onToggleSimulatedOutage: () => void;
}

export function ClientLogAndSimulatorCard({
  clientLogPath,
  clientLogFound,
  autoClipboard,
  poeRunning,
  simulatedOutage,
  activeVendorRegex,
  onSetLogPath,
  onAutoDetectPath,
  onToggleAutoClipboard,
  onCopyRegexNow,
  onSimulateLogLines,
  onToggleSimPoeRunning,
  onToggleSimulatedOutage,
}: ClientLogAndSimulatorCardProps) {
  const [draftPath, setDraftPath] = useState(clientLogPath);

  return (
    <div className="space-y-3">
      <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Client.txt & Clipboard</h2>
          </div>
          <span
            className={`text-[11px] font-medium ${clientLogFound ? "text-emerald-400" : "text-amber-400"}`}
          >
            {clientLogFound ? "Hooked" : "Path not verified"}
          </span>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            className="flex-1 rounded-lg bg-black border border-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => void onSetLogPath(draftPath)}
            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 cursor-pointer"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => void onAutoDetectPath()}
            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs text-indigo-300 cursor-pointer"
          >
            Find
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/70">
          <label className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoClipboard}
              onChange={onToggleAutoClipboard}
              className="accent-indigo-500"
            />
            Auto-copy vendor regex on Town entry
          </label>
          <button
            type="button"
            onClick={() => void onCopyRegexNow()}
            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-[11px] font-mono text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <ClipboardCopy className="h-3 w-3" />
            {activeVendorRegex || "Copy"}
          </button>
        </div>
      </section>

      <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Campaign & Outage Replay Simulator</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={onToggleSimPoeRunning}
            className={`rounded-lg border px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer ${
              poeRunning
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-neutral-700 bg-black text-neutral-300"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            PoE {poeRunning ? "Running" : "Stopped"}
          </button>

          <button
            type="button"
            onClick={onToggleSimulatedOutage}
            className={`rounded-lg border px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer ${
              simulatedOutage
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-neutral-700 bg-black text-neutral-300"
            }`}
          >
            Sim 429 API Outage: {simulatedOutage ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:01:02 [INFO Client 1] Generating level 1 area "1_1_1" with seed 1001',
              ])
            }
            className="rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-left text-neutral-200 cursor-pointer"
          >
            1. Twilight Strand
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:02:10 [INFO Client 1] Generating level 1 area "1_1_town" with seed 2002',
                "2026/11/13 18:02:11 [INFO Client 1] You have entered Lioneye's Watch.",
              ])
            }
            className="rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-left text-neutral-200 cursor-pointer"
          >
            2. Lioneye&apos;s Watch (Town)
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:03:05 [INFO Client 1] Generating level 2 area "1_1_2" with seed 3003',
              ])
            }
            className="rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-left text-neutral-200 cursor-pointer"
          >
            3. The Coast
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:05:30 [INFO Client 1] Generating level 6 area "1_1_6" with seed 4004',
              ])
            }
            className="rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-left text-neutral-200 cursor-pointer"
          >
            4. Skip Dweller -&gt; Ledge
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:08:11 [INFO Client 1] Generating level 10 area "1_1_11_2" with seed 5005',
                "2026/11/13 18:08:25 [INFO Client 1] : ExileRunner has been slain.",
                '2026/11/13 18:08:30 [INFO Client 1] Generating level 1 area "1_1_town" with seed 2002',
              ])
            }
            className="rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1.5 text-left text-red-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <Skull className="h-3.5 w-3.5" />
            5. Death at Brutus -&gt; Town
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:10:00 [INFO Client 1] Generating level 33 area "1_Labyrinth_1_1" with seed 8888',
              ])
            }
            className="rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1.5 text-left text-amber-200 cursor-pointer"
          >
            6. Enter Labyrinth
          </button>
        </div>
      </section>
    </div>
  );
}
