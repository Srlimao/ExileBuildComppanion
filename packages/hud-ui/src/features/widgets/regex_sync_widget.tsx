import type { HudSessionSnapshot } from "@exile-hud/core";
import { Check, ClipboardCopy, Send } from "lucide-react";
import { useState } from "react";

interface RegexSyncWidgetProps {
  snapshot: HudSessionSnapshot;
  onPushToPcClipboard: (regex: string) => void;
}

export function RegexSyncWidget({ snapshot, onPushToPcClipboard }: RegexSyncWidgetProps) {
  const [copiedLocal, setCopiedLocal] = useState(false);
  const regex = snapshot.activeVendorRegex || "g-g-r|b-b-g|nne";

  const copyLocal = async () => {
    try {
      await navigator.clipboard.writeText(regex);
      setCopiedLocal(true);
      window.setTimeout(() => setCopiedLocal(false), 1800);
    } catch {
      // Clipboard blocked on non-focus
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">Vendor Regex</h2>
        <span className={`text-xs font-mono ${snapshot.autoClipboardEnabled ? "text-hud-ok" : "text-hud-muted"}`}>
          {snapshot.autoClipboardEnabled ? "Auto-PC Sync" : "Manual"}
        </span>
      </div>

      <div className="rounded-md bg-hud-subtle px-3 py-2.5 font-mono text-sm text-hud-accent break-all select-all">
        {regex}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onPushToPcClipboard(regex)}
          className="px-3 py-1.5 rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" /> Push to PC
        </button>
        <button
          type="button"
          onClick={() => void copyLocal()}
          className="px-2.5 py-1.5 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedLocal ? <Check className="h-3.5 w-3.5 text-hud-ok" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copiedLocal ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
