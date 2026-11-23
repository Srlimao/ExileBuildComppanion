import { ExileRelayBrandIcon, ThemeSelectorPopover, useHudI18n } from "@exile-hud/hud-ui";
import { Check, Copy, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Renders GGG OAuth 2.1 callback handling and endpoint metadata on /oauth/callback. */
export function GggOauthCallbackView() {
  const { appMsg } = useHudI18n();
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
    <div className="min-h-screen bg-hud-bg text-hud-text flex items-center justify-center px-5 py-8 safe-top safe-bottom safe-x transition-colors">
      <main id="hud-main-content" className="w-full max-w-lg space-y-6">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-hud-hairline">
          <div className="flex items-center gap-3">
            <ExileRelayBrandIcon className="h-8 w-8 shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-hud-text">{appMsg.pwa.oauthTitle}</h1>
              <p className="text-xs text-hud-muted">{appMsg.pwa.oauthSubtitle}</p>
            </div>
          </div>
          <ThemeSelectorPopover />
        </div>

        {oauth.error ? (
          <div role="alert" className="border-l-2 border-hud-danger pl-3.5 py-1 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-hud-danger">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{appMsg.pwa.oauthDeclined(oauth.error)}</span>
            </div>
            {oauth.errorDescription && (
              <p className="text-xs text-hud-muted leading-relaxed">{oauth.errorDescription}</p>
            )}
          </div>
        ) : oauth.code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-hud-ok">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{appMsg.pwa.oauthCodeReceived}</span>
            </div>
            <p className="text-xs text-hud-muted leading-relaxed">
              {appMsg.pwa.oauthPkceDescPrefix}
              <code className="font-mono text-hud-ok">authorization_code</code> + PKCE{" "}
              <code className="font-mono text-hud-ok">S256</code>
              {appMsg.pwa.oauthPkceDescMid}{" "}
              {oauth.state ? appMsg.pwa.oauthStatePresent : appMsg.pwa.oauthStateMissing}
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-hud-subtle px-3 py-2">
              <span className="text-xs font-mono text-hud-text truncate">
                {oauth.code.length > 8 ? `${oauth.code.slice(0, 4)}••••••••••••${oauth.code.slice(-4)}` : "••••••••••••"}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-live="polite"
                className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-hud-text hover:bg-hud-subtle cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-hud-ok" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? appMsg.pwa.oauthCopied : appMsg.pwa.oauthCopyCode}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-hud-ok">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{appMsg.pwa.oauthActiveEndpoint}</span>
            </div>
            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 gap-x-2 text-hud-text">
              <dt className="text-hud-muted">{appMsg.pwa.oauthApp}</dt>
              <dd className="font-medium">Exile Relay</dd>
              <dt className="text-hud-muted">{appMsg.pwa.oauthGrantTypes}</dt>
              <dd className="font-mono text-[11px]">authorization_code (PKCE S256), refresh_token</dd>
              <dt className="text-hud-muted">{appMsg.pwa.oauthScopes}</dt>
              <dd className="font-mono text-[11px]">account:profile, account:characters</dd>
              <dt className="text-hud-muted">{appMsg.pwa.oauthRedirectUri}</dt>
              <dd className="font-mono text-[11px] break-all">https://exile-relay.dunhas.com/oauth/callback</dd>
            </dl>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-hud-hairline">
          <a
            href="/"
            className="flex-1 rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 text-center text-sm font-semibold py-2.5 px-3 transition-opacity"
          >
            {appMsg.pwa.oauthOpenPairing}
          </a>
          <a
            href="/?demo=1"
            className="flex-1 rounded-lg hover:bg-hud-subtle text-hud-text text-center text-sm font-medium py-2.5 px-3 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{appMsg.pwa.oauthTryDemo}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="text-[11px] text-center text-hud-dim">{appMsg.legalDisclaimer}</p>
      </main>
    </div>
  );
}
