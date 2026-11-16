import type { HudContextMode } from "@exile-hud/core";
import type { HudLocale } from "./locale_storage_and_types.js";

export interface PwaSurfaceMessages {
  legalDisclaimer: string;
  homeTooltip: string;
  actSummary: (act: number, level: number, charClass: string) => string;
  fallbackLeveling: string;
  pinModeTitle: (modeLabel: string, pinned: boolean) => string;
  pinnedModeAria: string;
  finishLayoutTitle: (ff: string) => string;
  done: string;
  demoTag: string;
  awakeTag: string;
  openSettings: string;
  settingsTitle: string;
  closeSettings: string;
  actionsSection: string;
  syncGearFallback: string;
  syncGear: string;
  syncGearDesc: string;
  requested: string;
  finishEditingLayout: string;
  editWidgetLayout: string;
  editLayoutDesc: (ff: string) => string;
  editLayoutDisabledDesc: string;
  activeTag: string;
  pairPc: string;
  switchPcRoom: string;
  pairPcDesc: string;
  downloadWinApp: string;
  downloadWinAppDesc: string;
  progressSection: string;
  confirmResetQuestion: string;
  confirmResetBtn: string;
  cancel: string;
  resetRunProgress: string;
  resetRunProgressDesc: string;
  connectionPhases: Record<"idle" | "connecting" | "connected" | "reconnecting" | "error", string>;
  pairingBadge: string;
  landingSubtitle: string;
  highlights: ReadonlyArray<{ title: string; detail: string }>;
  launchDemo: string;
  openDemoTitle: string;
  showcaseAlt: string;
  connectSecondScreen: string;
  connectSecondScreenDesc: string;
  mobileQuickPair: string;
  secondScreenSync: string;
  recentRoom: string;
  clearRecentRoom: string;
  roomCode: string;
  roomCodePlaceholder: string;
  fourDigitPin: string;
  connectingPc: string;
  connectPc: string;
  step1Prefix: string;
  step1Suffix: string;
  step2: string;
  step3: string;
  pcHostCardTitle: string;
  latestTag: string;
  pcHostCardDescPrefix: string;
  pcHostCardDescMid: string;
  pcHostCardDescSuffix: string;
  downloadPortable: string;
  windowsInstaller: string;
  releaseNotes: string;
  oauthTitle: string;
  oauthSubtitle: string;
  oauthDeclined: (err: string) => string;
  oauthCodeReceived: string;
  oauthPkceDescPrefix: string;
  oauthPkceDescMid: string;
  oauthStatePresent: string;
  oauthStateMissing: string;
  oauthCopied: string;
  oauthCopyCode: string;
  oauthActiveEndpoint: string;
  oauthApp: string;
  oauthGrantTypes: string;
  oauthScopes: string;
  oauthRedirectUri: string;
  oauthOpenPairing: string;
  oauthTryDemo: string;
}

const PT_BR_PWA: PwaSurfaceMessages = {
  legalDisclaimer: "Exile Relay — Este produto não é afiliado nem endossado pela Grinding Gear Games de nenhuma forma.",
  homeTooltip: "Exile Relay — Pareamento e Início",
  actSummary: (act, lv, cls) => `Ato ${act} · Nv ${lv} ${cls}`,
  fallbackLeveling: "Nivelamento Fallback",
  pinModeTitle: (mode, pinned) =>
    pinned ? `${mode} fixado — troca automática pausada (clique para desafixar)` : `Ver ${mode}`,
  pinnedModeAria: "Modo fixado",
  finishLayoutTitle: (ff) => `Concluir edição do layout ${ff}`,
  done: "Concluir",
  demoTag: "DEMO",
  awakeTag: "TELA ATIVA",
  openSettings: "Abrir configurações",
  settingsTitle: "Configurações",
  closeSettings: "Fechar configurações",
  actionsSection: "Ações",
  syncGearFallback: "Sincronizar Gear do Personagem (Fallback)",
  syncGear: "Sincronizar Gear do Personagem",
  syncGearDesc: "Buscar itens equipados e passivas alocadas",
  requested: "Solicitado",
  finishEditingLayout: "Concluir Edição de Layout",
  editWidgetLayout: "Editar Layout dos Widgets",
  editLayoutDesc: (ff) => `Reordenar e redimensionar widgets para ${ff}`,
  editLayoutDisabledDesc: "Mude para CAMPO, CIDADE ou LAB para editar o layout",
  activeTag: "ATIVO",
  pairPc: "Parear PC",
  switchPcRoom: "Trocar Sala do PC",
  pairPcDesc: "Conectar com Código da Sala de 6 caracteres + PIN",
  downloadWinApp: "Baixar App Windows PC",
  downloadWinAppDesc: "Portable .exe · Client.txt e sync ao vivo",
  progressSection: "Progresso",
  confirmResetQuestion: "Zerar todas as marcações?",
  confirmResetBtn: "Confirmar Reset",
  cancel: "Cancelar",
  resetRunProgress: "Resetar Progresso da Run",
  resetRunProgressDesc: "Limpar todas as etapas e gemas marcadas",
  connectionPhases: {
    idle: "INATIVO",
    connecting: "CONECTANDO",
    connected: "CONECTADO",
    reconnecting: "RECONECTANDO",
    error: "ERRO",
  },
  pairingBadge: "Companheiro PoE 1",
  landingSubtitle: "Companheiro interativo para celular, tablet e overlay no jogo conectado ao vivo à sua sessão de Path of Exile.",
  highlights: [
    { title: "Guia de Campanha", detail: "Bússola de zona, passos de quest e Trials" },
    { title: "Árvore e Gear ao Vivo", detail: "Passivas do PoB, Regex e bancada de craft" },
    { title: "Interface Editável", detail: "Arraste widgets, temas e overlay F7 no PC" },
  ],
  launchDemo: "Abrir HUD Demo Interativa",
  openDemoTitle: "Abrir Demo Interativa",
  showcaseAlt: "Prévia dos modos CAMPO, CIDADE e ÁRVORE do Exile Relay",
  connectSecondScreen: "Conectar Segunda Tela",
  connectSecondScreenDesc: "Digite o Código da Sala e o PIN de 4 dígitos da Central de Controle do PC.",
  mobileQuickPair: "Pareamento Rápido",
  secondScreenSync: "Segunda Tela",
  recentRoom: "Sala Recente:",
  clearRecentRoom: "Limpar sala recente",
  roomCode: "Código da Sala",
  roomCodePlaceholder: "ex: EXILE9",
  fourDigitPin: "PIN de 4 Dígitos",
  connectingPc: "Conectando ao PC Host...",
  connectPc: "Conectar ao PC Host",
  step1Prefix: "Execute o",
  step1Suffix: "e carregue sua build do PoB",
  step2: "Escaneie o QR code ou digite o Código da Sala + PIN",
  step3: "A tela permanece ligada automaticamente enquanto você joga",
  pcHostCardTitle: "Exile Relay PC Host (Windows x64)",
  latestTag: "Mais recente",
  pcHostCardDescPrefix: "App leve na Bandeja do Sistema — detecta o",
  pcHostCardDescMid: "do Path of Exile, decodifica o PoB offline e controla sua overlay",
  pcHostCardDescSuffix: "no PC e a HUD no celular.",
  downloadPortable: "Baixar ExileRelay.exe (Portátil)",
  windowsInstaller: "Instalador Windows (Setup.exe)",
  releaseNotes: "Notas da Versão",
  oauthTitle: "Exile Relay — Callback GGG OAuth 2.1",
  oauthSubtitle: "Sincronização somente leitura de personagem e passivas do Path of Exile",
  oauthDeclined: (err) => `Autorização Recusada (${err})`,
  oauthCodeReceived: "Código de Autorização Recebido",
  oauthPkceDescPrefix: "A troca de token (",
  oauthPkceDescMid: ") ocorre localmente dentro do host Exile Relay no seu PC.",
  oauthStatePresent: "Parâmetro state presente.",
  oauthStateMissing: "Nenhum parâmetro state informado.",
  oauthCopied: "Copiado",
  oauthCopyCode: "Copiar Código de Autorização",
  oauthActiveEndpoint: "Endpoint de Callback OAuth 2.1 Ativo",
  oauthApp: "Aplicação",
  oauthGrantTypes: "Tipos de Concessão",
  oauthScopes: "Escopos Solicitados",
  oauthRedirectUri: "URI de Redirecionamento",
  oauthOpenPairing: "Abrir Pareamento Exile Relay",
  oauthTryDemo: "Testar HUD Demo",
};

const EN_PWA: PwaSurfaceMessages = {
  legalDisclaimer: "Exile Relay — This product isn't affiliated with or endorsed by Grinding Gear Games in any way.",
  homeTooltip: "Exile Relay — Pairing & Home",
  actSummary: (act, lv, cls) => `Act ${act} · Lv ${lv} ${cls}`,
  fallbackLeveling: "Fallback Leveling",
  pinModeTitle: (mode, pinned) => (pinned ? `${mode} pinned — auto-switch paused (click to unpin)` : `View ${mode}`),
  pinnedModeAria: "Pinned mode",
  finishLayoutTitle: (ff) => `Finish editing ${ff} layout`,
  done: "Done",
  demoTag: "DEMO",
  awakeTag: "AWAKE",
  openSettings: "Open settings",
  settingsTitle: "Settings",
  closeSettings: "Close settings",
  actionsSection: "Actions",
  syncGearFallback: "Sync Character Gear (Fallback)",
  syncGear: "Sync Character Gear",
  syncGearDesc: "Fetch equipped items & allocated passives",
  requested: "Requested",
  finishEditingLayout: "Finish Editing Layout",
  editWidgetLayout: "Edit Widget Layout",
  editLayoutDesc: (ff) => `Reorder & resize widgets for ${ff}`,
  editLayoutDisabledDesc: "Switch to FIELD, TOWN, or LAB to edit layout",
  activeTag: "ACTIVE",
  pairPc: "Pair PC",
  switchPcRoom: "Switch PC Room",
  pairPcDesc: "Connect with 6-character Room ID + PIN",
  downloadWinApp: "Download Windows PC App",
  downloadWinAppDesc: "Portable .exe · Client.txt & live sync",
  progressSection: "Progress",
  confirmResetQuestion: "Reset all checks to zero?",
  confirmResetBtn: "Confirm Reset",
  cancel: "Cancel",
  resetRunProgress: "Reset Run Progress",
  resetRunProgressDesc: "Clear all checklist and gem checks",
  connectionPhases: { idle: "IDLE", connecting: "CONNECTING", connected: "CONNECTED", reconnecting: "RECONNECTING", error: "ERROR" },
  pairingBadge: "PoE 1 Companion",
  landingSubtitle: "Interactive phone, tablet & in-game overlay companion connected live to your Path of Exile session.",
  highlights: [
    { title: "Campaign Guidance", detail: "Live zone compass, quest steps & trials" },
    { title: "Live Tree & Gear Diff", detail: "PoB passive path, regex & crafting bench" },
    { title: "Fully Modifiable UI", detail: "Drag widgets, themes & F7 PC overlay" },
  ],
  launchDemo: "Launch Interactive Demo HUD",
  openDemoTitle: "Open Interactive Demo",
  showcaseAlt: "Exile Relay FIELD, TOWN and TREE telemetry showcase",
  connectSecondScreen: "Connect Second Screen",
  connectSecondScreenDesc: "Enter the Room Code & 4-digit PIN from your PC Control Center.",
  mobileQuickPair: "Mobile Quick-Pair",
  secondScreenSync: "Second-Screen Sync",
  recentRoom: "Recent Room:",
  clearRecentRoom: "Clear recent room",
  roomCode: "Room Code",
  roomCodePlaceholder: "e.g. EXILE9",
  fourDigitPin: "4-Digit PIN",
  connectingPc: "Connecting to PC Host...",
  connectPc: "Connect to PC Host",
  step1Prefix: "Run",
  step1Suffix: "& load your PoB build",
  step2: "Scan the QR code or enter Room Code + PIN",
  step3: "Screen stays awake automatically while you play",
  pcHostCardTitle: "Exile Relay PC Host (Windows x64)",
  latestTag: "Latest",
  pcHostCardDescPrefix: "Lightweight System Tray app — auto-detects Path of Exile",
  pcHostCardDescMid: ", decodes PoB offline, and drives both your",
  pcHostCardDescSuffix: "PC overlay and phone HUD.",
  downloadPortable: "Download ExileRelay.exe (Portable)",
  windowsInstaller: "Windows Installer (Setup.exe)",
  releaseNotes: "Release Notes",
  oauthTitle: "Exile Relay — GGG OAuth 2.1 Callback",
  oauthSubtitle: "Read-only Path of Exile character & passive telemetry sync",
  oauthDeclined: (err) => `Authorization Declined (${err})`,
  oauthCodeReceived: "Authorization Code Received",
  oauthPkceDescPrefix: "Token exchange (",
  oauthPkceDescMid: ") occurs locally inside your Exile Relay PC host.",
  oauthStatePresent: "State parameter present.",
  oauthStateMissing: "No state parameter supplied.",
  oauthCopied: "Copied",
  oauthCopyCode: "Copy Authorization Code",
  oauthActiveEndpoint: "OAuth 2.1 Callback Endpoint Active",
  oauthApp: "Application",
  oauthGrantTypes: "Grant Types",
  oauthScopes: "Requested Scopes",
  oauthRedirectUri: "Redirect URI",
  oauthOpenPairing: "Open Exile Relay Pairing",
  oauthTryDemo: "Try Demo HUD",
};

export const PWA_SURFACE_MESSAGES: Record<HudLocale, PwaSurfaceMessages> = {
  "pt-BR": PT_BR_PWA,
  en: EN_PWA,
};

export function localizeHudModeLabel(mode: HudContextMode | "AUTO", locale: HudLocale): string {
  const labels: Record<HudContextMode | "AUTO", string> =
    locale === "pt-BR"
      ? { FIELD: "CAMPO", TOWN: "CIDADE", LAB: "LAB", TREE: "ÁRVORE", STANDBY: "ESPERA", AUTO: "AUTO" }
      : { FIELD: "FIELD", TOWN: "TOWN", LAB: "LAB", TREE: "TREE", STANDBY: "STANDBY", AUTO: "AUTO" };
  return labels[mode] ?? mode;
}
