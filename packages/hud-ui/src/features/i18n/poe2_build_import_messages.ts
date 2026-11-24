import type { HudLocale } from "./locale_storage_and_types.js";

export interface Poe2BuildImportMessages {
  importBuildFileBtn: string;
  fromBuildPlannerBtn: string;
  refreshPlannerBtn: string;
  openPlannerFolderTooltip: (dir: string) => string;
  plannerEmptyHint: string;
  plannerWebFallbackHint: string;
  pobOrBuildPlaceholder: string;
  sourceBadgeBuildJson: string;
  buildNoteHeading: string;
  importWarningsTitle: string;
  fileTooLargeError: string;
}

const PT_BR_POE2_BUILD_IMPORT: Poe2BuildImportMessages = {
  importBuildFileBtn: "Importar .build",
  fromBuildPlannerBtn: "Da pasta BuildPlanner\\",
  refreshPlannerBtn: "Atualizar lista",
  openPlannerFolderTooltip: (dir) =>
    dir ? `Abrir pasta BuildPlanner no Explorer (${dir})` : "Abrir pasta BuildPlanner no Explorer",
  plannerEmptyHint: "Nenhum arquivo .build encontrado na pasta BuildPlanner do PoE 2.",
  plannerWebFallbackHint:
    "O escaneamento automático de BuildPlanner\\ só roda no app Windows; use 'Importar .build' ou cole o JSON.",
  pobOrBuildPlaceholder: "Cole código PoB 2, link pobb.in, JSON .build ou URL .build...",
  sourceBadgeBuildJson: "PoE 2 .build",
  buildNoteHeading: "Nota da Build",
  importWarningsTitle: "Avisos de importação .build",
  fileTooLargeError: "O arquivo .build excede o limite de 2 MB.",
};

const EN_POE2_BUILD_IMPORT: Poe2BuildImportMessages = {
  importBuildFileBtn: "Import .build",
  fromBuildPlannerBtn: "From BuildPlanner\\",
  refreshPlannerBtn: "Refresh list",
  openPlannerFolderTooltip: (dir) =>
    dir ? `Open BuildPlanner folder in Explorer (${dir})` : "Open BuildPlanner folder in Explorer",
  plannerEmptyHint: "No .build files found in your PoE 2 BuildPlanner folder.",
  plannerWebFallbackHint:
    "BuildPlanner\\ folder scan is available in the Windows app; use 'Import .build' or paste JSON.",
  pobOrBuildPlaceholder: "Paste PoB 2 code, pobb.in link, .build JSON, or .build URL...",
  sourceBadgeBuildJson: "PoE 2 .build",
  buildNoteHeading: "Build Note",
  importWarningsTitle: ".build import warnings",
  fileTooLargeError: "The selected .build file exceeds the 2 MB limit.",
};

export const POE2_BUILD_IMPORT_MESSAGES: Record<HudLocale, Poe2BuildImportMessages> = {
  "pt-BR": PT_BR_POE2_BUILD_IMPORT,
  en: EN_POE2_BUILD_IMPORT,
};
