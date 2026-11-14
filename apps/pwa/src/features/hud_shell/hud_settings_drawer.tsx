import type { DeviceFormFactor, HudContextMode, HudSessionSnapshot } from "@exile-hud/core";
import { ThemeAppearanceControls } from "@exile-hud/hud-ui";
import { Download, LayoutGrid, QrCode, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LATEST_PORTABLE_EXE_URL } from "../desktop_download/github_latest_release_client.js";
import type { ConnectionPhase } from "../pairing_and_connection/edge_websocket_room_client.js";

interface HudSettingsDrawerProps {
  open: boolean;
  snapshot: HudSessionSnapshot;
  activeDisplayMode: HudContextMode;
  editLayoutMode: boolean;
  formFactor: DeviceFormFactor;
  connectionPhase: ConnectionPhase;
  wakeLocked: boolean;
  isDemo: boolean;
  onClose: () => void;
  onToggleEditLayout: () => void;
  onTriggerManualSync: () => void;
  onResetProgress: () => void;
  onOpenPairingModal?: () => void;
}

/** Slide-over Whisper settings drawer housing appearance, actions, pairing, PC download, and reset. */
export function HudSettingsDrawer({
  open,
  snapshot,
  activeDisplayMode,
  editLayoutMode,
  formFactor,
  connectionPhase,
  wakeLocked,
  isDemo,
  onClose,
  onToggleEditLayout,
  onTriggerManualSync,
  onResetProgress,
  onOpenPairingModal,
}: HudSettingsDrawerProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [syncRequested, setSyncRequested] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmingReset(false);
      setSyncRequested(false);
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!confirmingReset) return;
    const timer = window.setTimeout(() => setConfirmingReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmingReset]);

  useEffect(() => {
    if (!syncRequested) return;
    const timer = window.setTimeout(() => setSyncRequested(false), 1500);
    return () => window.clearTimeout(timer);
  }, [syncRequested]);

  if (!open) return null;

  const canEditLayout = activeDisplayMode !== "TREE" && activeDisplayMode !== "STANDBY";
  const isOfflineFallback = snapshot.characterSyncStatus === "OFFLINE_FALLBACK";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-testid="hud-settings-drawer"
        className="relative z-10 h-full w-full max-w-xs sm:max-w-sm bg-hud-surface border-l border-hud-hairline px-5 py-4 overflow-y-auto flex flex-col gap-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-hud-text">Settings</h2>
            <p className="text-[11px] font-mono text-hud-muted mt-0.5">
              {isDemo ? "DEMO" : connectionPhase.toUpperCase()}
              {wakeLocked && <span className="text-hud-ok"> · AWAKE</span>}
            </p>
          </div>
          <button
            type="button"
            data-testid="hud-settings-close"
            aria-label="Close settings"
            onClick={onClose}
            className="p-1.5 -mr-1 rounded-md text-hud-muted hover:text-hud-text hover:bg-hud-subtle transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="border-t border-hud-hairline pt-4">
          <ThemeAppearanceControls />
        </section>

        <section className="border-t border-hud-hairline pt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Actions
          </div>

          <div className="divide-y divide-hud-hairline">
            <button
              type="button"
              data-testid="pwa-sync-gear-btn"
              onClick={() => {
                onTriggerManualSync();
                setSyncRequested(true);
              }}
              className="w-full py-2.5 flex items-center justify-between gap-3 text-left group cursor-pointer"
            >
              <span className="flex items-start gap-2.5 min-w-0">
                <RefreshCw
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isOfflineFallback ? "text-hud-warn" : "text-hud-muted group-hover:text-hud-text"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-hud-text group-hover:text-hud-accent transition-colors">
                    {isOfflineFallback ? "Sync Character Gear (Fallback)" : "Sync Character Gear"}
                  </span>
                  <span className="block text-[11px] text-hud-muted mt-0.5">
                    Fetch equipped items &amp; allocated passives
                  </span>
                </span>
              </span>
              {syncRequested && (
                <span className="text-[11px] font-mono text-hud-ok shrink-0">Requested</span>
              )}
            </button>

            <button
              type="button"
              data-testid="pwa-toggle-layout-btn"
              disabled={!canEditLayout}
              onClick={() => {
                if (!canEditLayout) return;
                onToggleEditLayout();
                onClose();
              }}
              className={`w-full py-2.5 flex items-center justify-between gap-3 text-left group ${
                canEditLayout ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="flex items-start gap-2.5 min-w-0">
                <LayoutGrid
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    editLayoutMode && canEditLayout
                      ? "text-hud-accent"
                      : "text-hud-muted group-hover:text-hud-text"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-hud-text group-hover:text-hud-accent transition-colors">
                    {editLayoutMode && canEditLayout ? "Finish Editing Layout" : "Edit Widget Layout"}
                  </span>
                  <span className="block text-[11px] text-hud-muted mt-0.5">
                    {canEditLayout
                      ? `Reorder & resize widgets for ${formFactor}`
                      : "Switch to FIELD, TOWN, or LAB to edit layout"}
                  </span>
                </span>
              </span>
              {editLayoutMode && canEditLayout && (
                <span className="text-[11px] font-mono text-hud-accent shrink-0">ACTIVE</span>
              )}
            </button>

            {onOpenPairingModal && (
              <button
                type="button"
                data-testid="pwa-pair-pc-btn"
                onClick={() => {
                  onClose();
                  onOpenPairingModal();
                }}
                className="w-full py-2.5 flex items-start gap-2.5 text-left group cursor-pointer"
              >
                <QrCode className="h-4 w-4 mt-0.5 shrink-0 text-hud-accent" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-hud-text group-hover:text-hud-accent transition-colors">
                    {isDemo ? "Pair PC" : "Switch PC Room"}
                  </span>
                  <span className="block text-[11px] text-hud-muted mt-0.5">
                    Connect with 6-character Room ID + PIN
                  </span>
                </span>
              </button>
            )}

            <a
              href={LATEST_PORTABLE_EXE_URL}
              className="w-full py-2.5 flex items-start gap-2.5 text-left group"
            >
              <Download className="h-4 w-4 mt-0.5 shrink-0 text-hud-ok" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-hud-text group-hover:text-hud-ok transition-colors">
                  Download Windows PC App
                </span>
                <span className="block text-[11px] text-hud-muted mt-0.5">
                  Portable .exe · Client.txt &amp; live sync
                </span>
              </span>
            </a>
          </div>
        </section>

        <section className="border-t border-hud-hairline pt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hud-muted">
            Progress
          </div>

          {confirmingReset ? (
            <div className="py-1 space-y-2.5">
              <p className="text-xs text-hud-text">Reset all checks to zero?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="pwa-confirm-reset-progress-btn"
                  onClick={() => {
                    onResetProgress();
                    setConfirmingReset(false);
                  }}
                  className="px-3 py-1.5 rounded-md bg-hud-danger text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  data-testid="pwa-cancel-reset-progress-btn"
                  onClick={() => setConfirmingReset(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="pwa-reset-progress-btn"
              onClick={() => setConfirmingReset(true)}
              className="w-full py-1.5 flex items-start gap-2.5 text-left group cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mt-0.5 shrink-0 text-hud-muted group-hover:text-hud-danger transition-colors" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-hud-text group-hover:text-hud-danger transition-colors">
                  Reset Run Progress
                </span>
                <span className="block text-[11px] text-hud-muted mt-0.5">
                  Clear all checklist and gem checks
                </span>
              </span>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
