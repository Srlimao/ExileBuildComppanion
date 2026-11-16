import type { HudLocale } from "./locale_storage_and_types.js";

export interface DesktopOverlayAndUpdaterMessages {
  overlayCardTitle: string;
  overlayCardDesc: string;
  activeBadge: string;
  hiddenBadge: string;
  hideOverlay: string;
  openOverlay: string;
  clickThroughLocked: string;
  interactiveUnlocked: string;
  pinOnDesktop: string;
  pinOnDesktopHint: string;
  snapDockPosition: string;
  freeFloating: string;
  dockedPrefix: string;
  dockLabels: Record<"top-left" | "top-right" | "bottom-left" | "bottom-right" | "left-edge" | "right-edge", string>;
  backdropOpacity: string;
  toggleOverlayKey: string;
  clickThroughLockKey: string;
  windowedNote: string;
  resetLayouts: string;
  waitingHost: string;
  unlockKeyHint: (key: string) => string;
  lockedLabel: string;
  dragOverlayTitle: string;
  compactLabel: string;
  expandLabel: string;
  dockButton: string;
  editOverlayWidgets: string;
  pinAltTabOn: string;
  pinAltTabOff: string;
  lockClickThroughTitle: (key: string) => string;
  lockBtn: string;
  hideOverlayTitle: (key: string) => string;
  waitingOverlaySnapshot: string;
  installerVariant: string;
  standaloneVariant: string;
  newRelease: string;
  verifyingRestarting: string;
  downloadingTag: (tag: string, pct: number) => string;
  updateRestartTag: (tag: string) => string;
  checkingUpdates: string;
  upToDate: string;
  checkUpdatesBtn: string;
  trayStandby: string;
  trayDegraded: (relayConnected: boolean) => string;
  trayLive: (areaName: string) => string;
}

const PT_BR_OVERLAY_UPDATER: DesktopOverlayAndUpdaterMessages = {
  overlayCardTitle: "Overlay Local no Jogo (PC)",
  overlayCardDesc: "HUD flutuante sobre o Path of Exile — salva localmente no PC, sem envio ao Cloudflare.",
  activeBadge: "ATIVA",
  hiddenBadge: "OCULTA",
  hideOverlay: "Ocultar Overlay",
  openOverlay: "Abrir Overlay",
  clickThroughLocked: "Cliques Bloqueados",
  interactiveUnlocked: "Modo Interativo",
  pinOnDesktop: "Manter sempre visível na Área de Trabalho",
  pinOnDesktopHint: "(desligado = oculta ao dar Alt-Tab)",
  snapDockPosition: "Posição de Encaixe",
  freeFloating: "Flutuante Livre",
  dockedPrefix: "Encaixada:",
  dockLabels: {
    "top-left": "Sup. Esquerdo",
    "top-right": "Sup. Direito",
    "bottom-left": "Inf. Esquerdo",
    "bottom-right": "Inf. Direito",
    "left-edge": "Faixa Esquerda",
    "right-edge": "Faixa Direita",
  },
  backdropOpacity: "Opacidade do Fundo",
  toggleOverlayKey: "Tecla para Mostrar/Ocultar",
  clickThroughLockKey: "Tecla de Bloqueio de Cliques",
  windowedNote: "Requer Path of Exile em Janela Sem Bordas ou Modo Janela.",
  resetLayouts: "Resetar Layouts",
  waitingHost: "Aguardando host do PC...",
  unlockKeyHint: (key) => `${key} desbloqueia`,
  lockedLabel: "Bloqueada",
  dragOverlayTitle: "Arrastar janela da overlay",
  compactLabel: "Compactar",
  expandLabel: "Expandir",
  dockButton: "Encaixar",
  editOverlayWidgets: "Editar widgets da overlay",
  pinAltTabOn: "Fixada mesmo no Alt-Tab",
  pinAltTabOff: "Oculta automaticamente no Alt-Tab",
  lockClickThroughTitle: (key) => `Ativar modo click-through (${key})`,
  lockBtn: "Travar",
  hideOverlayTitle: (key) => `Ocultar overlay (${key})`,
  waitingOverlaySnapshot: "Aguardando telemetria local da Central de Controle do Exile Relay...",
  installerVariant: "Instalador",
  standaloneVariant: "Portátil",
  newRelease: "Nova Versão",
  verifyingRestarting: "Verificando SHA-256 e reiniciando…",
  downloadingTag: (tag, pct) => `Baixando ${tag} (${pct}%)…`,
  updateRestartTag: (tag) => `Atualizar para ${tag} e Reiniciar`,
  checkingUpdates: "Verificando…",
  upToDate: "Atualizado",
  checkUpdatesBtn: "Verificar",
  trayStandby: "Exile Relay — PoE em Espera",
  trayDegraded: (ok) => `Exile Relay — Degradado (${ok ? "Fallback de API" : "Relay Desconectado"})`,
  trayLive: (area) => `Exile Relay — Ao Vivo (${area})`,
};

const EN_OVERLAY_UPDATER: DesktopOverlayAndUpdaterMessages = {
  overlayCardTitle: "Local PC Game Overlay",
  overlayCardDesc: "Floating HUD over Path of Exile — saved locally on PC, zero Cloudflare sync.",
  activeBadge: "ACTIVE",
  hiddenBadge: "HIDDEN",
  hideOverlay: "Hide Overlay",
  openOverlay: "Open Overlay",
  clickThroughLocked: "Click-Through Locked",
  interactiveUnlocked: "Interactive Unlocked",
  pinOnDesktop: "Pin Always Visible on Desktop",
  pinOnDesktopHint: "(off = auto-hide on Alt-Tab)",
  snapDockPosition: "Snap Dock Position",
  freeFloating: "Free Floating",
  dockedPrefix: "Docked:",
  dockLabels: {
    "top-left": "Top-Left",
    "top-right": "Top-Right",
    "bottom-left": "Bottom-Left",
    "bottom-right": "Bottom-Right",
    "left-edge": "Left Strip",
    "right-edge": "Right Strip",
  },
  backdropOpacity: "Backdrop Opacity",
  toggleOverlayKey: "Toggle Overlay Key",
  clickThroughLockKey: "Click-Through Lock Key",
  windowedNote: "Requires Path of Exile in Windowed Fullscreen or Windowed mode.",
  resetLayouts: "Reset Layouts",
  waitingHost: "Waiting for PC host...",
  unlockKeyHint: (key) => `${key} unlock`,
  lockedLabel: "Locked",
  dragOverlayTitle: "Drag overlay window",
  compactLabel: "Compact",
  expandLabel: "Expand",
  dockButton: "Dock",
  editOverlayWidgets: "Edit overlay widgets",
  pinAltTabOn: "Pinned across Alt-Tab",
  pinAltTabOff: "Auto-hides on Alt-Tab",
  lockClickThroughTitle: (key) => `Lock click-through (${key})`,
  lockBtn: "Lock",
  hideOverlayTitle: (key) => `Hide overlay (${key})`,
  waitingOverlaySnapshot: "Waiting for local telemetry snapshot from Exile Relay Control Center...",
  installerVariant: "Installer",
  standaloneVariant: "Standalone",
  newRelease: "New Release",
  verifyingRestarting: "Verifying SHA-256 & Restarting…",
  downloadingTag: (tag, pct) => `Downloading ${tag} (${pct}%)…`,
  updateRestartTag: (tag) => `Update to ${tag} & Restart`,
  checkingUpdates: "Checking…",
  upToDate: "Up to date",
  checkUpdatesBtn: "Check",
  trayStandby: "Exile Relay — PoE Standby",
  trayDegraded: (ok) => `Exile Relay — Degraded (${ok ? "API Fallback" : "Relay Disconnected"})`,
  trayLive: (area) => `Exile Relay — Live (${area})`,
};

export const DESKTOP_OVERLAY_AND_UPDATER_MESSAGES: Record<HudLocale, DesktopOverlayAndUpdaterMessages> = {
  "pt-BR": PT_BR_OVERLAY_UPDATER,
  en: EN_OVERLAY_UPDATER,
};
