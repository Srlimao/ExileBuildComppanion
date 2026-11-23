import type { HudSessionSnapshot } from "@exile-hud/core";
import { Check, ClipboardCopy, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

interface RegexSyncWidgetProps {
  snapshot: HudSessionSnapshot;
  onPushToPcClipboard: (regex: string) => void;
}

export function RegexSyncWidget({ snapshot, onPushToPcClipboard }: RegexSyncWidgetProps) {
  const { msg } = useHudI18n();
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [pushedToPc, setPushedToPc] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const regex = snapshot.activeVendorRegex || "g-g-r|b-b-g|nne";

  useEffect(() => {
    if (!pushedToPc) return;
    const timer = window.setTimeout(() => setPushedToPc(false), 1800);
    return () => window.clearTimeout(timer);
  }, [pushedToPc]);

  useEffect(() => {
    if (!copiedLocal) return;
    const timer = window.setTimeout(() => setCopiedLocal(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedLocal]);

  const copyLocal = async () => {
    try {
      await navigator.clipboard.writeText(regex);
      setClipboardError(null);
      setCopiedLocal(true);
    } catch {
      setClipboardError(msg.a11y.clipboardFailed);
    }
  };

  const pushToPc = () => {
    onPushToPcClipboard(regex);
    setPushedToPc(true);
  };

  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {msg.widgets.vendorRegex}
        </h2>
        <span className={`text-xs font-mono ${snapshot.autoClipboardEnabled ? "text-hud-ok" : "text-hud-muted"}`}>
          {snapshot.autoClipboardEnabled ? msg.widgets.autoPcSync : msg.widgets.manual}
        </span>
      </div>

      <div className="rounded-lg bg-hud-subtle px-3 py-2.5 font-mono text-sm text-hud-accent break-all select-all">
        {regex}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={pushToPc}
            className="px-3 py-1.5 rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            {pushedToPc ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            <span>{pushedToPc ? msg.a11y.sentToPc : msg.widgets.pushToPc}</span>
          </button>
          <button
            type="button"
            onClick={() => void copyLocal()}
            className="px-2.5 py-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedLocal ? <Check className="h-3.5 w-3.5 text-hud-ok" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            <span>{copiedLocal ? msg.widgets.copied : msg.widgets.copy}</span>
          </button>
        </div>

        <div role="status" aria-live="polite">
          {clipboardError && <p className="text-[11px] text-hud-warn">{clipboardError}</p>}
        </div>
      </div>
    </div>
  );
}
