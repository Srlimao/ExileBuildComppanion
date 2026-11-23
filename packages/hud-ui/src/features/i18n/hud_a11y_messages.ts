import type { HudLocale } from "./locale_storage_and_types.js";

export interface HudA11yMessages {
  skipToContent: string;
  hudModesNavLabel: string;
  showcaseSectionTitle: string;
  moveWidgetUp: (title: string) => string;
  moveWidgetDown: (title: string) => string;
  cycleWidgetSize: (title: string, colSpan: number, rowSpan: number) => string;
  removeWidget: (title: string) => string;
  closeDialog: string;
  zoomZoneImage: string;
  closeImageZoom: string;
  searchTreeLabel: string;
  clearSearch: string;
  passiveTreePreviewAlt: string;
  sentToPc: string;
  clipboardFailed: string;
  invalidPoelabJson: string;
  enterRoomAndPin: string;
  widgetErrorTitle: string;
  widgetErrorRetry: string;
  appErrorTitle: string;
  appErrorReload: string;
}

const PT_BR_A11Y: HudA11yMessages = {
  skipToContent: "Ir para o conteúdo principal",
  hudModesNavLabel: "Modos de contexto da HUD",
  showcaseSectionTitle: "Recursos e Demonstração",
  moveWidgetUp: (title) => `Mover ${title} para cima`,
  moveWidgetDown: (title) => `Mover ${title} para baixo`,
  cycleWidgetSize: (title, colSpan, rowSpan) => `Alternar tamanho de ${title} (atual ${colSpan}x${rowSpan})`,
  removeWidget: (title) => `Remover widget ${title}`,
  closeDialog: "Fechar janela",
  zoomZoneImage: "Ampliar imagem do layout da zona",
  closeImageZoom: "Fechar visualização ampliada",
  searchTreeLabel: "Buscar nós ou atributos na árvore passiva",
  clearSearch: "Limpar busca",
  passiveTreePreviewAlt: "Prévia da árvore passiva mostrando nós alocados e próximos alvos",
  sentToPc: "Enviado ao PC",
  clipboardFailed: "Área de transferência bloqueada neste navegador — use Enviar p/ PC.",
  invalidPoelabJson: "JSON do PoELab inválido. Cole o conteúdo bruto de um arquivo layout .json válido.",
  enterRoomAndPin: "Informe o Código da Sala e o PIN de 4 dígitos.",
  widgetErrorTitle: "Falha ao renderizar este widget.",
  widgetErrorRetry: "Tentar novamente",
  appErrorTitle: "Algo deu errado ao exibir a HUD.",
  appErrorReload: "Recarregar HUD",
};

const EN_A11Y: HudA11yMessages = {
  skipToContent: "Skip to main content",
  hudModesNavLabel: "HUD context modes",
  showcaseSectionTitle: "Features & Live Demo",
  moveWidgetUp: (title) => `Move ${title} up`,
  moveWidgetDown: (title) => `Move ${title} down`,
  cycleWidgetSize: (title, colSpan, rowSpan) => `Resize ${title} widget (current ${colSpan}x${rowSpan})`,
  removeWidget: (title) => `Remove ${title} widget`,
  closeDialog: "Close dialog",
  zoomZoneImage: "Zoom zone layout image",
  closeImageZoom: "Close enlarged image view",
  searchTreeLabel: "Search passive tree nodes or stats",
  clearSearch: "Clear search",
  passiveTreePreviewAlt: "Passive tree preview showing allocated nodes and upcoming targets",
  sentToPc: "Sent to PC",
  clipboardFailed: "Clipboard access blocked in browser — use Push to PC.",
  invalidPoelabJson: "Invalid PoELab JSON. Paste or upload a valid PoELab daily layout .json file.",
  enterRoomAndPin: "Enter both the Room Code and the 4-digit PIN.",
  widgetErrorTitle: "This widget encountered an error.",
  widgetErrorRetry: "Retry",
  appErrorTitle: "Something went wrong while rendering the HUD.",
  appErrorReload: "Reload HUD",
};

export const HUD_A11Y_MESSAGES: Record<HudLocale, HudA11yMessages> = {
  "pt-BR": PT_BR_A11Y,
  en: EN_A11Y,
};
