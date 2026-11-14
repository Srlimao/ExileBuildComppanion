import type { CharacterSyncStatus } from "@exile-hud/core";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

interface CharacterSyncSettingsCardProps {
  accountName: string;
  characterName: string;
  syncStatus: CharacterSyncStatus;
  hasStoredSession: boolean;
  syncMessage: string | null;
  onChangeAccount: (nextAccount: string) => void;
  onChangeCharacter: (nextChar: string) => void;
  onSavePoesessid: (val: string) => Promise<void>;
  onClearPoesessid: () => Promise<void>;
  onForceSync: () => Promise<void>;
}

const STATUS_STYLE: Record<CharacterSyncStatus, string> = {
  ONLINE_PUBLIC: "text-hud-ok",
  ONLINE_POESESSID: "text-hud-ok",
  OFFLINE_FALLBACK: "text-hud-warn",
  UNCONFIGURED: "text-hud-muted",
};

export function CharacterSyncSettingsCard({
  accountName,
  characterName,
  syncStatus,
  hasStoredSession,
  syncMessage,
  onChangeAccount,
  onChangeCharacter,
  onSavePoesessid,
  onClearPoesessid,
  onForceSync,
}: CharacterSyncSettingsCardProps) {
  const [draftSession, setDraftSession] = useState("");

  const handleSaveSecret = async () => {
    if (!draftSession.trim()) return;
    await onSavePoesessid(draftSession.trim());
    setDraftSession("");
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          GGG Character Telemetry
        </h2>
        <span className={`text-[11px] font-mono ${STATUS_STYLE[syncStatus]}`}>{syncStatus}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] text-hud-muted">Account (#1234 supported)</span>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onChangeAccount(e.target.value)}
            placeholder="Name#1234"
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-hud-muted">Active Character</span>
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacter(e.target.value)}
            placeholder="Auto-detected or name"
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-hud-text font-medium">
            <KeyRound className="h-3.5 w-3.5 text-hud-muted" />
            Optional Private Profile Keychain
          </span>
          <span className={hasStoredSession ? "text-hud-ok" : "text-hud-muted"}>
            {hasStoredSession ? "Stored in DPAPI Keychain" : "Public mode only"}
          </span>
        </div>

        <div className="flex gap-1.5">
          <input
            type="password"
            value={draftSession}
            onChange={(e) => setDraftSession(e.target.value)}
            placeholder={hasStoredSession ? "Stored locally (paste to replace)" : "Paste POESESSID (stays on PC)"}
            className="flex-1 rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent"
          />
          <button
            type="button"
            onClick={() => void handleSaveSecret()}
            className="rounded-md hover:bg-hud-subtle px-2.5 py-1.5 text-xs text-hud-text cursor-pointer"
          >
            Save
          </button>
          {hasStoredSession && (
            <button
              type="button"
              onClick={() => void onClearPoesessid()}
              title="Clear POESESSID from Windows Credential Manager"
              className="rounded-md hover:bg-hud-subtle px-2 py-1 text-hud-danger cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-hud-muted truncate">
          {syncMessage ?? "CORS-free Rust poller · 45s cooldown + circuit breaker"}
        </span>
        <button
          type="button"
          onClick={() => void onForceSync()}
          className="rounded-md hover:bg-hud-subtle px-2.5 py-1 text-xs font-medium text-hud-ok inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Force Sync
        </button>
      </div>
    </section>
  );
}
