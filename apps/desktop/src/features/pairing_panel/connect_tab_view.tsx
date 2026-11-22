import type { CharacterSyncStatus, ViewerPresenceEntry } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { useState } from "react";
import { CharacterSyncSettingsCard } from "../ggg_sync_panel/character_sync_settings_card.js";
import { QrRoomPairingCard } from "./qr_room_pairing_card.js";

type ConnectSubTab = "qr" | "ggg";

interface ConnectTabViewProps {
  roomId: string;
  pin: string;
  relayUrl: string;
  relayConnected: boolean;
  relayError: string | null;
  viewers: ViewerPresenceEntry[];
  onChangeRelayUrl: (nextUrl: string) => void;
  onRotatePin: () => void;
  onReconnectRelay: () => void;
  accountName: string;
  selectedLeague: string;
  characterName: string;
  pobCharacterClass: string | null;
  syncStatus: CharacterSyncStatus;
  syncMessage: string | null;
  onChangeAccount: (nextAccount: string) => void;
  onChangeLeague: (nextLeague: string) => void;
  onChangeCharacter: (nextChar: string) => void;
  onSelectCharacter: (nextChar: string, nextAccount?: string) => void;
  onForceSync: () => Promise<void>;
}

const SYNC_DOT_COLOR: Record<CharacterSyncStatus, string> = {
  ONLINE_PUBLIC: "bg-hud-ok",
  OFFLINE_FALLBACK: "bg-hud-warn",
  UNCONFIGURED: "bg-hud-muted",
};

/** Connect tab splitting Second-Screen QR Pairing and GGG Character Sync into a clean 2-segment toggle. */
export function ConnectTabView(props: ConnectTabViewProps) {
  const { appMsg } = useHudI18n();
  const [subTab, setSubTab] = useState<ConnectSubTab>("qr");

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 p-0.5 rounded-xl bg-hud-subtle border border-hud-hairline text-xs font-medium">
        <button
          type="button"
          onClick={() => setSubTab("qr")}
          className={`py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subTab === "qr"
              ? "bg-hud-surface text-hud-text font-semibold shadow-sm"
              : "text-hud-muted hover:text-hud-text"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              props.relayConnected ? "bg-hud-ok" : "bg-hud-warn"
            }`}
          />
          <span>{appMsg.desktop.connectSubSecondScreen}</span>
          {props.viewers.length > 0 && (
            <span className="text-[10px] font-mono text-hud-muted">({props.viewers.length})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab("ggg")}
          className={`py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subTab === "ggg"
              ? "bg-hud-surface text-hud-text font-semibold shadow-sm"
              : "text-hud-muted hover:text-hud-text"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              SYNC_DOT_COLOR[props.syncStatus] ?? "bg-hud-muted"
            }`}
          />
          <span>{appMsg.desktop.connectSubCharacter}</span>
        </button>
      </div>

      {subTab === "qr" ? (
        <QrRoomPairingCard
          roomId={props.roomId}
          pin={props.pin}
          relayUrl={props.relayUrl}
          relayConnected={props.relayConnected}
          relayError={props.relayError}
          viewers={props.viewers}
          onChangeRelayUrl={props.onChangeRelayUrl}
          onRotatePin={props.onRotatePin}
          onReconnectRelay={props.onReconnectRelay}
        />
      ) : (
        <CharacterSyncSettingsCard
          accountName={props.accountName}
          selectedLeague={props.selectedLeague}
          characterName={props.characterName}
          pobCharacterClass={props.pobCharacterClass}
          syncStatus={props.syncStatus}
          syncMessage={props.syncMessage}
          onChangeAccount={props.onChangeAccount}
          onChangeLeague={props.onChangeLeague}
          onChangeCharacter={props.onChangeCharacter}
          onSelectCharacter={props.onSelectCharacter}
          onForceSync={props.onForceSync}
        />
      )}
    </div>
  );
}
