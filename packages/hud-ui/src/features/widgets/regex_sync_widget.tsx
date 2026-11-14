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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">Vendor Regex</h2>
        <span
          className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${
            snapshot.autoClipboardEnabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-neutral-700 bg-neutral-900 text-neutral-400"
          }`}
        >
          {snapshot.autoClipboardEnabled ? "Auto-PC Sync On" : "Manual"}
        </span>
      </div>

      <div className="rounded-lg bg-black border border-neutral-800 p-3 font-mono text-sm text-indigo-300 break-all">
        {regex}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPushToPcClipboard(regex)}
          className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" /> Push to PC
        </button>
        <button
          type="button"
          onClick={() => void copyLocal()}
          className="px-3 py-2 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-black text-neutral-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {copiedLocal ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copiedLocal ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
