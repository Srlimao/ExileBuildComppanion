import { useHudI18n } from "@exile-hud/hud-ui";
import { ChevronDown, ChevronRight, Cpu, GitBranch, Skull, Terminal } from "lucide-react";
import { useState } from "react";

interface CampaignSimulatorDrawerProps {
  poeRunning: boolean;
  inGameTreeOpen: boolean;
  passiveTreeHotkey: string;
  simulatedOutage: boolean;
  onSimulateLogLines: (lines: string[]) => void;
  onToggleSimPoeRunning: () => void;
  onToggleSimInGameTree: () => void;
  onToggleSimulatedOutage: () => void;
}

/** Collapsed-by-default developer replay simulator drawer for testing log events and outages. */
export function CampaignSimulatorDrawer({
  poeRunning,
  inGameTreeOpen,
  passiveTreeHotkey,
  simulatedOutage,
  onSimulateLogLines,
  onToggleSimPoeRunning,
  onToggleSimInGameTree,
  onToggleSimulatedOutage,
}: CampaignSimulatorDrawerProps) {
  const { appMsg } = useHudI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-hud-hairline overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3.5 py-2.5 bg-hud-surface hover:bg-hud-subtle/60 flex items-center justify-between text-xs text-hud-muted hover:text-hud-text cursor-pointer transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-hud-accent" />
          <span>{appMsg.desktop.devSimulatorDrawerTitle}</span>
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <div className="p-3 border-t border-hud-hairline bg-hud-bg grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={onToggleSimPoeRunning}
            className={`rounded-lg bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer ${
              poeRunning ? "text-hud-ok font-semibold" : "text-hud-muted hover:text-hud-text"
            }`}
          >
            <Cpu className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {poeRunning ? appMsg.desktop.poeRunning : appMsg.desktop.poeStopped}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleSimulatedOutage}
            className={`rounded-lg bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center gap-1.5 cursor-pointer truncate ${
              simulatedOutage ? "text-hud-warn font-semibold" : "text-hud-muted hover:text-hud-text"
            }`}
          >
            <span className="truncate">{appMsg.desktop.simOutage(simulatedOutage)}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:01:02 [INFO Client 1] Generating level 1 area "1_1_1" with seed 1001',
              ])
            }
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer truncate"
          >
            {appMsg.desktop.simSteps[0]}
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:02:10 [INFO Client 1] Generating level 1 area "1_1_town" with seed 2002',
                "2026/11/13 18:02:11 [INFO Client 1] You have entered Lioneye's Watch.",
              ])
            }
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer truncate"
          >
            {appMsg.desktop.simSteps[1]}
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:03:05 [INFO Client 1] Generating level 2 area "1_1_2" with seed 3003',
              ])
            }
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer truncate"
          >
            {appMsg.desktop.simSteps[2]}
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:05:30 [INFO Client 1] Generating level 6 area "1_1_6" with seed 4004',
              ])
            }
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-text cursor-pointer truncate"
          >
            {appMsg.desktop.simSteps[3]}
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
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-danger inline-flex items-center gap-1 cursor-pointer truncate"
          >
            <Skull className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{appMsg.desktop.simSteps[4]}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulateLogLines([
                '2026/11/13 18:10:00 [INFO Client 1] Generating level 33 area "1_Labyrinth_1_1" with seed 8888',
              ])
            }
            className="rounded-lg bg-hud-subtle hover:opacity-80 px-2.5 py-1.5 text-left text-hud-warn cursor-pointer truncate"
          >
            {appMsg.desktop.simSteps[5]}
          </button>

          <button
            type="button"
            onClick={onToggleSimInGameTree}
            className={`col-span-2 rounded-lg bg-hud-subtle px-2.5 py-1.5 text-left inline-flex items-center justify-between cursor-pointer ${
              inGameTreeOpen ? "text-hud-ok font-semibold" : "text-hud-accent"
            }`}
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{appMsg.desktop.simToggleTree(passiveTreeHotkey)}</span>
            </span>
            <span className="font-mono text-[10px] shrink-0">
              {inGameTreeOpen ? appMsg.desktop.treeOpenState : appMsg.desktop.closedState}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
