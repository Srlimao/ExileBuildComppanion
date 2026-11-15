import type { CharacterSyncStatus } from "@exile-hud/core";
import { RefreshCw } from "lucide-react";

interface CharacterSyncSettingsCardProps {
  accountName: string;
  characterName: string;
  syncStatus: CharacterSyncStatus;
  syncMessage: string | null;
  onChangeAccount: (nextAccount: string) => void;
  onChangeCharacter: (nextChar: string) => void;
  onForceSync: () => Promise<void>;
}

const STATUS_STYLE: Record<CharacterSyncStatus, string> = {
  ONLINE_PUBLIC: "text-hud-ok",
  OFFLINE_FALLBACK: "text-hud-warn",
  UNCONFIGURED: "text-hud-muted",
};

export function CharacterSyncSettingsCard({
  accountName,
  characterName,
  syncStatus,
  syncMessage,
  onChangeAccount,
  onChangeCharacter,
  onForceSync,
}: CharacterSyncSettingsCardProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          GGG Character Telemetry
        </h2>
        <span className={`text-[11px] font-mono ${STATUS_STYLE[syncStatus] ?? "text-hud-muted"}`}>
          {syncStatus}
        </span>
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

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-hud-muted truncate">
          {syncMessage ?? "Public profile · CORS-free Rust poller · 45s cooldown"}
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
