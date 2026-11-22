import { useHudI18n } from "@exile-hud/hud-ui";
import { ClipboardCopy, GitBranch } from "lucide-react";
import { useEffect, useState } from "react";

interface ClientLogSettingsCardProps {
  clientLogPath: string;
  clientLogFound: boolean;
  autoClipboard: boolean;
  inGameTreeOpen: boolean;
  passiveTreeHotkey: string;
  activeVendorRegex: string;
  onSetLogPath: (nextPath: string) => Promise<void>;
  onAutoDetectPath: () => Promise<void>;
  onToggleAutoClipboard: () => void;
  onChangePassiveTreeHotkey: (nextKey: string) => void;
  onCopyRegexNow: () => Promise<void>;
}

const TREE_HOTKEYS = ["P", "T", "K", "Tab", "F1", "F2", "F3", "F4", "Off"] as const;

/** Client.txt log watcher path, auto-clipboard regex, and passive-tree hotkey settings card. */
export function ClientLogSettingsCard({
  clientLogPath,
  clientLogFound,
  autoClipboard,
  inGameTreeOpen,
  passiveTreeHotkey,
  activeVendorRegex,
  onSetLogPath,
  onAutoDetectPath,
  onToggleAutoClipboard,
  onChangePassiveTreeHotkey,
  onCopyRegexNow,
}: ClientLogSettingsCardProps) {
  const { msg, appMsg } = useHudI18n();
  const [draftPath, setDraftPath] = useState(clientLogPath);

  useEffect(() => {
    setDraftPath(clientLogPath);
  }, [clientLogPath]);

  return (
    <section className="rounded-xl bg-hud-surface border border-hud-hairline p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-hud-text">{appMsg.desktop.clientTxtTitle}</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono ${
            clientLogFound ? "text-hud-ok" : "text-hud-warn"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${clientLogFound ? "bg-hud-ok" : "bg-hud-warn"}`}
          />
          {clientLogFound ? appMsg.desktop.hooked : appMsg.desktop.pathNotVerified}
        </span>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={draftPath}
          onChange={(e) => setDraftPath(e.target.value)}
          className="flex-1 min-w-0 rounded-lg bg-hud-subtle border border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
        />
        <button
          type="button"
          onClick={() => void onSetLogPath(draftPath)}
          className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-2.5 py-1.5 text-xs text-hud-text cursor-pointer shrink-0"
        >
          {appMsg.desktop.setBtn}
        </button>
        <button
          type="button"
          onClick={() => void onAutoDetectPath()}
          className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-2.5 py-1.5 text-xs text-hud-accent font-medium cursor-pointer shrink-0"
        >
          {appMsg.desktop.findBtn}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline">
        <label className="inline-flex items-center gap-2 text-xs text-hud-text cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={autoClipboard}
            onChange={onToggleAutoClipboard}
            style={{ accentColor: "var(--hud-accent)" }}
          />
          <span className="truncate">{appMsg.desktop.autoCopyRegex}</span>
        </label>
        <button
          type="button"
          onClick={() => void onCopyRegexNow()}
          title={activeVendorRegex || msg.widgets.copy}
          className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 px-2 py-1 text-[11px] font-mono text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer shrink-0 max-w-[120px]"
        >
          <ClipboardCopy className="h-3 w-3 shrink-0" />
          <span className="truncate">{activeVendorRegex || msg.widgets.copy}</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-hud-hairline text-xs">
        <div className="flex items-center gap-1.5 text-hud-text min-w-0">
          <GitBranch className="h-3.5 w-3.5 text-hud-accent shrink-0" />
          <span className="truncate">{appMsg.desktop.passiveTreeHotkey}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-mono ${inGameTreeOpen ? "text-hud-ok" : "text-hud-muted"}`}
          >
            {inGameTreeOpen ? appMsg.desktop.openState : appMsg.desktop.closedState}
          </span>
          <select
            value={passiveTreeHotkey}
            onChange={(e) => onChangePassiveTreeHotkey(e.target.value)}
            className="rounded-lg bg-hud-subtle border border-hud-hairline px-2 py-1 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent cursor-pointer"
          >
            {TREE_HOTKEYS.map((k) => (
              <option key={k} value={k} className="bg-hud-surface text-hud-text">
                {k === "Off" ? appMsg.desktop.offOption : k}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
