import { ClipboardCopy, Cpu, GitBranch, Skull } from "lucide-react";
import { useEffect, useState } from "react";

interface ClientLogAndSimulatorCardProps {
  clientLogPath: string;
  clientLogFound: boolean;
  autoClipboard: boolean;
  poeRunning: boolean;
  inGameTreeOpen: boolean;
  passiveTreeHotkey: string;
  simulatedOutage: boolean;
  activeVendorRegex: string;
  onSetLogPath: (nextPath: string) => Promise<void>;
  onAutoDetectPath: () => Promise<void>;
  onToggleAutoClipboard: () => void;
  onChangePassiveTreeHotkey: (nextKey: string) => void;
  onCopyRegexNow: () => Promise<void>;
  onSimulateLogLines: (lines: string[]) => void;
  onToggleSimPoeRunning: () => void;
  onToggleSimInGameTree: () => void;
  onToggleSimulatedOutage: () => void;
}

export function ClientLogAndSimulatorCard({
  clientLogPath,
  clientLogFound,
  autoClipboard,
  poeRunning,
  inGameTreeOpen,
  passiveTreeHotkey,
  simulatedOutage,
  activeVendorRegex,
  onSetLogPath,
  onAutoDetectPath,
  onToggleAutoClipboard,
  onChangePassiveTreeHotkey,
  onCopyRegexNow,
  onSimulateLogLines,
  onToggleSimPoeRunning,
  onToggleSimInGameTree,
  onToggleSimulatedOutage,
}: ClientLogAndSimulatorCardProps) {
  const [draftPath, setDraftPath] = useState(clientLogPath);

  useEffect(() => {
    setDraftPath(clientLogPath);
  }, [clientLogPath]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Client.txt &amp; Clipboard
          </h2>
          <span className={`text-[11px] font-medium ${clientLogFound ? "text-hud-ok" : "text-hud-warn"}`}>
            {clientLogFound ? "Hooked" : "Path not verified"}
          </span>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            className="flex-1 rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
          />
          <button
            type="button"
            onClick={() => void onSetLogPath(draftPath)}
            className="rounded-md hover:bg-hud-subtle px-2.5 py-1.5 text-xs text-hud-text cursor-pointer"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => void onAutoDetectPath()}
            className="rounded-md hover:bg-hud-subtle px-2 py-1.5 text-xs text-hud-accent font-medium cursor-pointer"
          >
            Find
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-hud-text cursor-pointer">
            <input
              type="checkbox"
              checked={autoClipboard}
              onChange={onToggleAutoClipboard}
              style={{ accentColor: "var(--hud-accent)" }}
            />
            Auto-copy vendor regex on Town entry
          </label>
          <button
            type="button"
            onClick={() => void onCopyRegexNow()}
            className="rounded-md hover:bg-hud-subtle px-2 py-1 text-[11px] font-mono text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
          >
            <ClipboardCopy className="h-3 w-3" />
            {activeVendorRegex || "Copy"}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-hud-hairline text-xs">
          <div className="flex items-center gap-1.5 text-hud-text">
            <GitBranch className="h-3.5 w-3.5 text-hud-accent" />
            <span>Passive Tree Hotkey (PoE Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono ${inGameTreeOpen ? "text-hud-ok" : "text-hud-muted"}`}>
              {inGameTreeOpen ? "OPEN" : "CLOSED"}
            </span>
            <select
              value={passiveTreeHotkey}
              onChange={(e) => onChangePassiveTreeHotkey(e.target.value)}
              className="rounded-md bg-hud-surface border border-hud-hairline px-2 py-0.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
            >
              {["P", "T", "K", "Tab", "F1", "F2", "F3", "F4", "Off"].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-hud-hairline pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          Campaign &amp; Outage Replay Simulator
        </h2>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={onToggleSimPoeRunning}
            className={`rounded-md bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer ${
              poeRunning ? "text-hud-ok font-semibold" : "text-hud-muted hover:text-hud-text"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            PoE {poeRunning ? "Running" : "Stopped"}
          </button>

          <button
            type="button"
            onClick={onToggleSimulatedOutage}
            className={`rounded-md bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer ${
              simulatedOutage ? "text-hud-warn font-semibold" : "text-hud-muted hover:text-hud-text"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-danger inline-flex items-center gap-1 cursor-pointer"
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
            className="rounded-md bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-warn cursor-pointer"
          >
            6. Enter Labyrinth
          </button>

          <button
            type="button"
            onClick={onToggleSimInGameTree}
            className={`col-span-2 rounded-md bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center justify-between cursor-pointer ${
              inGameTreeOpen ? "text-hud-ok font-semibold" : "text-hud-accent"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              7. Toggle In-Game Passive Tree ({passiveTreeHotkey})
            </span>
            <span className="font-mono text-[10px]">{inGameTreeOpen ? "TREE OPEN" : "CLOSED"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
