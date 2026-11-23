import type { HudLocale } from "@exile-hud/hud-ui";

export interface PwaRefreshMessages {
  pullToRefresh: string;
  releaseToRefresh: string;
  refreshing: string;
  reloadApp: string;
  reloadAppDesc: string;
}

export const PWA_REFRESH_MESSAGES: Record<HudLocale, PwaRefreshMessages> = {
  "pt-BR": {
    pullToRefresh: "Puxe para atualizar",
    releaseToRefresh: "Solte para atualizar",
    refreshing: "Atualizando...",
    reloadApp: "Recarregar App",
    reloadAppDesc: "Forçar atualização do PWA e reconectar",
  },
  en: {
    pullToRefresh: "Pull to refresh",
    releaseToRefresh: "Release to refresh",
    refreshing: "Refreshing...",
    reloadApp: "Reload App",
    reloadAppDesc: "Force PWA update check and reload",
  },
};
