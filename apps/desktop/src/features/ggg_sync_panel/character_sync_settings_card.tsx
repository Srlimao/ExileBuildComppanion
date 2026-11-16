import type { CharacterSyncStatus } from "@exile-hud/core";
import { localizeConnectionOrSyncMessage, useHudI18n } from "@exile-hud/hud-ui";
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
  const { locale, appMsg } = useHudI18n();
  const localizedSyncMsg = localizeConnectionOrSyncMessage(syncMessage, locale);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">
          {appMsg.desktop.gggSyncTitle}
        </h2>
        <span className={`text-[11px] font-mono ${STATUS_STYLE[syncStatus] ?? "text-hud-muted"}`}>
          {appMsg.desktop.syncStatuses[syncStatus]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] text-hud-muted">{appMsg.desktop.accountLabel}</span>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onChangeAccount(e.target.value)}
            placeholder={appMsg.desktop.accountPlaceholder}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-hud-muted">{appMsg.desktop.activeCharacterLabel}</span>
          <input
            type="text"
            value={characterName}
            onChange={(e) => onChangeCharacter(e.target.value)}
            placeholder={appMsg.desktop.activeCharacterPlaceholder}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-hud-muted truncate">
          {localizedSyncMsg ?? appMsg.desktop.defaultSyncHint}
        </span>
        <button
          type="button"
          onClick={() => void onForceSync()}
          className="rounded-md hover:bg-hud-subtle px-2.5 py-1 text-xs font-medium text-hud-ok inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {appMsg.desktop.forceSync}
        </button>
      </div>
    </section>
  );
}
