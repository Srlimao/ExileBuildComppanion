import { Check, Copy, ExternalLink, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
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
    <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Exile Relay — GGG OAuth 2.1 Callback</h1>
            <p className="text-xs text-neutral-400">Read-only Path of Exile character &amp; passive telemetry sync</p>
          </div>
        </div>

        {oauth.error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Authorization Declined ({oauth.error})</span>
            </div>
            {oauth.errorDescription && (
              <p className="text-xs text-red-200/80 leading-relaxed">{oauth.errorDescription}</p>
            )}
          </div>
        ) : oauth.code ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Authorization Code Received</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Token exchange (<code className="font-mono text-emerald-300">authorization_code</code> + PKCE{" "}
              <code className="font-mono text-emerald-300">S256</code>) occurs locally inside your Exile Relay PC
              host. {oauth.state ? "State parameter present." : "No state parameter supplied."}
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-black border border-neutral-800 px-3 py-2">
              <span className="text-xs font-mono text-neutral-300 truncate">
                {oauth.code.length > 8 ? `${oauth.code.slice(0, 4)}••••••••••••${oauth.code.slice(-4)}` : "••••••••••••"}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Authorization Code"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-black/70 p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>OAuth 2.1 Callback Endpoint Active</span>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 gap-x-2 text-neutral-300">
              <dt className="text-neutral-500">Application</dt>
              <dd className="font-medium text-white">Exile Relay</dd>
              <dt className="text-neutral-500">Grant Types</dt>
              <dd className="font-mono text-[11px]">authorization_code (PKCE S256), refresh_token</dd>
              <dt className="text-neutral-500">Requested Scopes</dt>
              <dd className="font-mono text-[11px]">account:profile, account:characters</dd>
              <dt className="text-neutral-500">Redirect URI</dt>
              <dd className="font-mono text-[11px] break-all">https://exile-relay.dunhas.com/oauth/callback</dd>
            </dl>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <a
            href="/"
            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-center text-sm font-semibold py-2.5 px-3 transition-colors"
          >
            Open Exile Relay Pairing
          </a>
          <a
            href="/?demo=1"
            className="flex-1 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-900/70 text-neutral-200 text-center text-sm font-medium py-2.5 px-3 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Try Interactive Demo HUD</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="text-[11px] text-center text-neutral-500 pt-1">
          This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
        </p>
      </div>
    </div>
  );
}
