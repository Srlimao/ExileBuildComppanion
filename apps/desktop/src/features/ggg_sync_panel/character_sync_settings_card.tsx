import type { CharacterSyncStatus } from "@exile-hud/core";
import { KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
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
  ONLINE_PUBLIC: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  ONLINE_POESESSID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  OFFLINE_FALLBACK: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  UNCONFIGURED: "border-neutral-700 bg-neutral-900 text-neutral-300",
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
    <section className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">GGG Character Telemetry</h2>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono ${STATUS_STYLE[syncStatus]}`}>
          {syncStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] text-neutral-400">Account (#1234 supported)</span>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onChangeAccount(e.target.value)}
            placeholder="Name#1234"
            className="w-full rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-neutral-400">Active Character</span>
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacter(e.target.value)}
            placeholder="Auto-detected or name"
            className="w-full rounded-lg bg-black border border-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </label>
      </div>

      <div className="rounded-lg bg-black border border-neutral-800 p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-neutral-300 font-medium">
            <KeyRound className="h-3.5 w-3.5 text-neutral-400" />
            Optional Private Profile Keychain
          </span>
          <span className={hasStoredSession ? "text-emerald-400" : "text-neutral-500"}>
            {hasStoredSession ? "Stored in DPAPI Keychain" : "Public mode only"}
          </span>
        </div>

        <div className="flex gap-1.5">
          <input
            type="password"
            value={draftSession}
            onChange={(e) => setDraftSession(e.target.value)}
            placeholder={hasStoredSession ? "Stored locally (paste to replace)" : "Paste POESESSID (stays on PC)"}
            className="flex-1 rounded-lg bg-neutral-950 border border-neutral-800 px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => void handleSaveSecret()}
            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 cursor-pointer"
          >
            Save
          </button>
          {hasStoredSession && (
            <button
              type="button"
              onClick={() => void onClearPoesessid()}
              title="Clear POESESSID from Windows Credential Manager"
              className="rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2 py-1 text-red-300 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400 truncate">
          {syncMessage ?? "CORS-free Rust poller · 45s cooldown + circuit breaker"}
        </span>
        <button
          type="button"
          onClick={() => void onForceSync()}
          className="rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-emerald-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Force Sync
        </button>
      </div>
    </section>
  );
}
