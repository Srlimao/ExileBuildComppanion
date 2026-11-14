import { ExileRelayBrandIcon, ThemeSelectorPopover } from "@exile-hud/hud-ui";
import { Check, Copy, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Renders GGG OAuth 2.1 callback handling and endpoint metadata on /oauth/callback. */
export function GggOauthCallbackView() {
  const [copied, setCopied] = useState(false);

  const oauth = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return {
      code: q.get("code") ?? "",
      state: q.get("state") ?? "",
      error: q.get("error") ?? "",
      errorDescription: q.get("error_description") ?? "",
    };
  }, []);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleCopyCode = () => {
    if (!oauth.code) return;
    void navigator.clipboard?.writeText(oauth.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-hud-bg text-hud-text flex items-center justify-center px-5 py-8 transition-colors">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-hud-hairline">
          <div className="flex items-center gap-3">
            <ExileRelayBrandIcon className="h-8 w-8 shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-hud-text">
                Exile Relay — GGG OAuth 2.1 Callback
              </h1>
              <p className="text-xs text-hud-muted">Read-only Path of Exile character &amp; passive telemetry sync</p>
            </div>
          </div>
          <ThemeSelectorPopover />
        </div>

        {oauth.error ? (
          <div className="border-l-2 border-hud-danger pl-3.5 py-1 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-hud-danger">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Authorization Declined ({oauth.error})</span>
            </div>
            {oauth.errorDescription && (
              <p className="text-xs text-hud-muted leading-relaxed">{oauth.errorDescription}</p>
            )}
          </div>
        ) : oauth.code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-hud-ok">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Authorization Code Received</span>
            </div>
            <p className="text-xs text-hud-muted leading-relaxed">
              Token exchange (<code className="font-mono text-hud-ok">authorization_code</code> + PKCE{" "}
              <code className="font-mono text-hud-ok">S256</code>) occurs locally inside your Exile Relay PC
              host. {oauth.state ? "State parameter present." : "No state parameter supplied."}
            </p>
            <div className="flex items-center justify-between gap-2 rounded-md bg-hud-subtle px-3 py-2">
              <span className="text-xs font-mono text-hud-text truncate">
                {oauth.code.length > 8 ? `${oauth.code.slice(0, 4)}••••••••••••${oauth.code.slice(-4)}` : "••••••••••••"}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-hud-text hover:bg-hud-subtle cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-hud-ok" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Authorization Code"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-hud-ok">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>OAuth 2.1 Callback Endpoint Active</span>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 gap-x-2 text-hud-text">
              <dt className="text-hud-muted">Application</dt>
              <dd className="font-medium">Exile Relay</dd>
              <dt className="text-hud-muted">Grant Types</dt>
              <dd className="font-mono text-[11px]">authorization_code (PKCE S256), refresh_token</dd>
              <dt className="text-hud-muted">Requested Scopes</dt>
              <dd className="font-mono text-[11px]">account:profile, account:characters</dd>
              <dt className="text-hud-muted">Redirect URI</dt>
              <dd className="font-mono text-[11px] break-all">https://exile-relay.dunhas.com/oauth/callback</dd>
            </dl>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-hud-hairline">
          <a
            href="/"
            className="flex-1 rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 text-center text-sm font-semibold py-2 px-3 transition-opacity"
          >
            Open Exile Relay Pairing
          </a>
          <a
            href="/?demo=1"
            className="flex-1 rounded-md hover:bg-hud-subtle text-hud-text text-center text-sm font-medium py-2 px-3 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Try Demo HUD</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="text-[11px] text-center text-hud-dim">
          This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
        </p>
      </div>
    </div>
  );
}
