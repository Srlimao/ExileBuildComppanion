import type { CharacterSyncStatus } from "@exile-hud/core";
import type { HudLocale } from "./locale_storage_and_types.js";

export interface DesktopControlMessages {
  initializing: string;
  toggleOverlayTitle: (hotkey: string) => string;
  tabs: Record<"builds" | "overlay" | "connect" | "game", string>;
  progressCounts: (doneSteps: number, totalSteps: number, doneGems: number, totalGems: number) => string;
  savedOnPc: string;
  confirmReset: string;
  cancel: string;
  resetChecksTitle: string;
  resetChecks: string;
  secondScreenPairing: string;
  relayLive: string;
  offlineLocal: string;
  roomId: string;
  pin: string;
  rotatePinTitle: string;
  copiedUrl: string;
  copyPairLink: string;
  syncRoom: string;
  relayUrlLabel: string;
  useLocal8787: string;
  setBtn: string;
  connectedScreens: (count: number) => string;
  noneYet: string;
  pobCardTitle: string;
  leagueStart: string;
  twink: string;
  stepsCount: (count: number) => string;
  gemsCount: (count: number) => string;
  pobInputLabel: string;
  pobInputPlaceholder: string;
  hideCustomRoute: string;
  customRoute: string;
  readingSets: string;
  inspectSets: string;
  compiling: string;
  compileAndSavePob: string;
  customRoutePlaceholder: string;
  savedLocally: string;
  openSaveFolder: string;
  importSelectionPrefix: string;
  passiveSets: string;
  skillSets: string;
  itemSets: string;
  all: string;
  none: string;
  noneInPob: string;
  gggSyncTitle: string;
  syncStatuses: Record<CharacterSyncStatus, string>;
  accountLabel: string;
  accountPlaceholder: string;
  leagueLabel: string;
  allLeaguesOption: (count: number) => string;
  enterAccountFirst: string;
  fetchingRoster: string;
  fetchCharactersBtn: string;
  noCharactersFound: string;
  manualEntryToggle: string;
  dropdownSelectToggle: string;
  classMismatchHint: (charClass: string, pobClass: string) => string;
  activeCharacterLabel: string;
  activeCharacterPlaceholder: string;
  defaultSyncHint: string;
  forceSync: string;
  clientTxtTitle: string;
  hooked: string;
  pathNotVerified: string;
  findBtn: string;
  autoCopyRegex: string;
  passiveTreeHotkey: string;
  openState: string;
  closedState: string;
  offOption: string;
  simulatorTitle: string;
  poeRunning: string;
  poeStopped: string;
  simOutage: (on: boolean) => string;
  simSteps: ReadonlyArray<string>;
  simToggleTree: (hotkey: string) => string;
  treeOpenState: string;
}

const PT_BR_CONTROL: DesktopControlMessages = {
  initializing: "Inicializando...",
  toggleOverlayTitle: (hotkey) => `Alternar overlay local no PC (${hotkey})`,
  tabs: { builds: "Builds", overlay: "Overlay", connect: "Conectar", game: "Jogo" },
  progressCounts: (ds, ts, dg, tg) => `${ds}/${ts} passos · ${dg}/${tg} gemas`,
  savedOnPc: "· Salvo no PC",
  confirmReset: "Confirmar Reset",
  cancel: "Cancelar",
  resetChecksTitle: "Zerar todos os passos do checklist e gemas marcadas",
  resetChecks: "Zerar Marcações",
  secondScreenPairing: "Pareamento de Segunda Tela",
  relayLive: "Relay Conectado",
  offlineLocal: "Offline / Local",
  roomId: "Código da Sala",
  pin: "PIN",
  rotatePinTitle: "Gerar novo PIN de 4 dígitos",
  copiedUrl: "Link Copiado",
  copyPairLink: "Copiar Link de Pareamento",
  syncRoom: "Sincronizar Sala",
  relayUrlLabel: "URL do Cloudflare Relay",
  useLocal8787: "Usar local :8787",
  setBtn: "Definir",
  connectedScreens: (count) => `Telas conectadas: ${count}`,
  noneYet: "Nenhuma ainda",
  pobCardTitle: "PoB e Rota de Campanha",
  leagueStart: "Início de Liga",
  twink: "Twink",
  stepsCount: (n) => `${n} passos`,
  gemsCount: (n) => `${n} gemas`,
  pobInputLabel: "URL do pobb.in, Código de Exportação do PoB ou XML",
  pobInputPlaceholder: "https://pobb.in/... ou código do PoB",
  hideCustomRoute: "Ocultar rota .txt personalizada",
  customRoute: "Rota personalizada",
  readingSets: "Lendo...",
  inspectSets: "Inspecionar Sets",
  compiling: "Compilando...",
  compileAndSavePob: "Compilar e Salvar PoB",
  customRoutePlaceholder: "Substituição opcional de fragmentos de rota exile-leveling...",
  savedLocally: "Salvo localmente:",
  openSaveFolder: "Abrir Pasta Salva",
  importSelectionPrefix: "Seleção de Importação",
  passiveSets: "Sets de Passivas",
  skillSets: "Sets de Skills",
  itemSets: "Sets de Itens",
  all: "Todos",
  none: "Nenhum",
  noneInPob: "Nenhum presente neste PoB.",
  gggSyncTitle: "Telemetria de Personagem GGG",
  syncStatuses: { ONLINE_PUBLIC: "ONLINE_PÚBLICO", OFFLINE_FALLBACK: "FALLBACK_OFFLINE", UNCONFIGURED: "NÃO_CONFIGURADO" },
  accountLabel: "Conta (suporta Nome#1234)",
  accountPlaceholder: "Nome#1234",
  leagueLabel: "Liga",
  allLeaguesOption: (count) => `Todas as Ligas (${count})`,
  enterAccountFirst: "Informe a conta acima",
  fetchingRoster: "Buscando...",
  fetchCharactersBtn: "Carregar personagens da conta",
  noCharactersFound: "Nenhum personagem encontrado",
  manualEntryToggle: "Digitar nome",
  dropdownSelectToggle: "Usar lista",
  classMismatchHint: (charClass, pobClass) =>
    `Personagem é ${charClass}, mas o PoB atual é ${pobClass}.`,
  activeCharacterLabel: "Personagem Ativo",
  activeCharacterPlaceholder: "Auto-detectado ou digite",
  defaultSyncHint: "Perfil público · Leitor Rust sem CORS · intervalo 45s",
  forceSync: "Forçar Sync",
  clientTxtTitle: "Client.txt e Área de Transferência",
  hooked: "Conectado",
  pathNotVerified: "Caminho não verificado",
  findBtn: "Buscar",
  autoCopyRegex: "Copiar Regex de Vendor ao entrar na Cidade",
  passiveTreeHotkey: "Tecla da Árvore Passiva (PoE Ativo)",
  openState: "ABERTA",
  closedState: "FECHADA",
  offOption: "Desligada",
  simulatorTitle: "Simulador de Campanha e Falha de API",
  poeRunning: "PoE Rodando",
  poeStopped: "PoE Parado",
  simOutage: (on) => `Simular Erro 429 da API: ${on ? "LIGADO" : "DESLIGADO"}`,
  simSteps: ["1. Twilight Strand", "2. Lioneye's Watch (Cidade)", "3. The Coast", "4. Pular Dweller -> Ledge", "5. Morte no Brutus -> Cidade", "6. Entrar no Labyrinth"],
  simToggleTree: (hotkey) => `7. Alternar Árvore Passiva no Jogo (${hotkey})`,
  treeOpenState: "ÁRVORE ABERTA",
};

const EN_CONTROL: DesktopControlMessages = {
  initializing: "Initializing...",
  toggleOverlayTitle: (hotkey) => `Toggle local PC overlay (${hotkey})`,
  tabs: { builds: "Builds", overlay: "Overlay", connect: "Connect", game: "Game" },
  progressCounts: (ds, ts, dg, tg) => `${ds}/${ts} steps · ${dg}/${tg} gems`,
  savedOnPc: "· Saved on PC",
  confirmReset: "Confirm Reset",
  cancel: "Cancel",
  resetChecksTitle: "Reset all checklist steps and gem checks back to zero",
  resetChecks: "Reset Checks",
  secondScreenPairing: "Second-Screen Pairing",
  relayLive: "Relay Live",
  offlineLocal: "Offline / Local",
  roomId: "Room ID",
  pin: "PIN",
  rotatePinTitle: "Rotate 4-digit PIN",
  copiedUrl: "Copied URL",
  copyPairLink: "Copy Pair Link",
  syncRoom: "Sync Room",
  relayUrlLabel: "Cloudflare Relay URL",
  useLocal8787: "Use local :8787",
  setBtn: "Set",
  connectedScreens: (count) => `Connected screens: ${count}`,
  noneYet: "None yet",
  pobCardTitle: "PoB & Campaign Route",
  leagueStart: "League Start",
  twink: "Twink",
  stepsCount: (n) => `${n} steps`,
  gemsCount: (n) => `${n} gems`,
  pobInputLabel: "pobb.in URL, PoB Export Code, or XML",
  pobInputPlaceholder: "https://pobb.in/... or raw PoB code",
  hideCustomRoute: "Hide custom .txt route",
  customRoute: "Custom route",
  readingSets: "Reading...",
  inspectSets: "Inspect Sets",
  compiling: "Compiling...",
  compileAndSavePob: "Compile & Save PoB",
  customRoutePlaceholder: "Optional exile-leveling route fragment override...",
  savedLocally: "Saved locally:",
  openSaveFolder: "Open Save Folder",
  importSelectionPrefix: "Import Selection",
  passiveSets: "Passive Sets",
  skillSets: "Skill Sets",
  itemSets: "Item Sets",
  all: "All",
  none: "None",
  noneInPob: "None present in this PoB.",
  gggSyncTitle: "GGG Character Telemetry",
  syncStatuses: { ONLINE_PUBLIC: "ONLINE_PUBLIC", OFFLINE_FALLBACK: "OFFLINE_FALLBACK", UNCONFIGURED: "UNCONFIGURED" },
  accountLabel: "Account (#1234 supported)",
  accountPlaceholder: "Name#1234",
  leagueLabel: "League",
  allLeaguesOption: (count) => `All Leagues (${count})`,
  enterAccountFirst: "Enter account above",
  fetchingRoster: "Fetching...",
  fetchCharactersBtn: "Fetch account characters",
  noCharactersFound: "No characters found",
  manualEntryToggle: "Type manually",
  dropdownSelectToggle: "Use dropdown",
  classMismatchHint: (charClass, pobClass) =>
    `Selected character is ${charClass}, while loaded PoB is ${pobClass}.`,
  activeCharacterLabel: "Active Character",
  activeCharacterPlaceholder: "Auto-detected or name",
  defaultSyncHint: "Public profile · CORS-free Rust poller · 45s cooldown",
  forceSync: "Force Sync",
  clientTxtTitle: "Client.txt & Clipboard",
  hooked: "Hooked",
  pathNotVerified: "Path not verified",
  findBtn: "Find",
  autoCopyRegex: "Auto-copy vendor regex on Town entry",
  passiveTreeHotkey: "Passive Tree Hotkey (PoE Active)",
  openState: "OPEN",
  closedState: "CLOSED",
  offOption: "Off",
  simulatorTitle: "Campaign & Outage Replay Simulator",
  poeRunning: "PoE Running",
  poeStopped: "PoE Stopped",
  simOutage: (on) => `Sim 429 API Outage: ${on ? "ON" : "OFF"}`,
  simSteps: ["1. Twilight Strand", "2. Lioneye's Watch (Town)", "3. The Coast", "4. Skip Dweller -> Ledge", "5. Death at Brutus -> Town", "6. Enter Labyrinth"],
  simToggleTree: (hotkey) => `7. Toggle In-Game Passive Tree (${hotkey})`,
  treeOpenState: "TREE OPEN",
};

export const DESKTOP_CONTROL_MESSAGES: Record<HudLocale, DesktopControlMessages> = {
  "pt-BR": PT_BR_CONTROL,
  en: EN_CONTROL,
};
