import type { HudLocale } from "./locale_storage_and_types.js";

export interface DesktopBuildLibraryMessages {
  buildLibraryTitle: string;
  activeBuildPillLabel: string;
  editActiveBuild: string;
  newBuildBtn: string;
  newFolderBtn: string;
  openBuildsFolderBtn: string;
  backToBuilds: string;
  buildsRootCrumb: string;
  goUpFolderTitle: string;
  searchBuildsPlaceholder: string;
  sortLabel: string;
  sortOptions: Record<"updated" | "name" | "class" | "level", string>;
  newFolderPlaceholder: string;
  createBtn: string;
  folderBuildsCount: (count: number) => string;
  renameBtn: string;
  deleteFolderNonEmptyWarn: (count: number) => string;
  emptyFolderMsg: string;
  emptySearchMsg: string;
  activeBadge: string;
  twinkBadge: string;
  leagueStartBadge: string;
  openBuildBtn: string;
  editBuildBtn: string;
  duplicateBuildBtn: string;
  moveBuildBtn: string;
  deleteBuildBtn: string;
  moveTargetRoot: string;
  moveHereBtn: string;
  stepsShort: (done: number, total: number, act: number) => string;
  newBuildEditorTitle: string;
  editBuildEditorTitle: string;
  buildNameLabel: string;
  buildNamePlaceholder: string;
  folderLabel: string;
  linkedCharLabel: string;
  linkedCharPlaceholder: string;
  linkedLeagueLabel: string;
  linkedLeaguePlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  saveAndApplyBtn: string;
  saveAndOpenBtn: string;
  saveOnlyBtn: string;
  savingBuildBtn: string;
  buildsFolderFooter: string;
  defaultStarterBuildName: string;
  copySuffix: string;
}

const PT_BR_LIBRARY: DesktopBuildLibraryMessages = {
  buildLibraryTitle: "Biblioteca de Builds",
  activeBuildPillLabel: "Build Ativa",
  editActiveBuild: "Editar Ativa",
  newBuildBtn: "Nova Build",
  newFolderBtn: "Nova Pasta",
  openBuildsFolderBtn: "Abrir Pasta",
  backToBuilds: "Voltar para Builds",
  buildsRootCrumb: "Builds",
  goUpFolderTitle: "Subir um nível",
  searchBuildsPlaceholder: "Buscar por nome, classe, personagem ou notas...",
  sortLabel: "Ordenar",
  sortOptions: { updated: "Recentes", name: "Nome", class: "Classe", level: "Nível" },
  newFolderPlaceholder: "Nome da pasta...",
  createBtn: "Criar",
  folderBuildsCount: (count) => (count === 1 ? "1 build" : `${count} builds`),
  renameBtn: "Renomear",
  deleteFolderNonEmptyWarn: (count) =>
    count > 0 ? `Apagar pasta + ${count} build(s)?` : "Confirmar exclusão?",
  emptyFolderMsg: "Nenhuma build ou subpasta nesta pasta ainda.",
  emptySearchMsg: "Nenhuma build encontrada para esta busca.",
  activeBadge: "ATIVA",
  twinkBadge: "TWINK",
  leagueStartBadge: "Início de Liga",
  openBuildBtn: "Abrir",
  editBuildBtn: "Editar",
  duplicateBuildBtn: "Duplicar",
  moveBuildBtn: "Mover",
  deleteBuildBtn: "Excluir",
  moveTargetRoot: "Builds (Raiz)",
  moveHereBtn: "Mover",
  stepsShort: (done, total, act) => `${done}/${total} passos · Ato ${act}`,
  newBuildEditorTitle: "Nova Build",
  editBuildEditorTitle: "Editar Build",
  buildNameLabel: "Nome da Build",
  buildNamePlaceholder: "Ex: RF Elementalist 3.26",
  folderLabel: "Pasta",
  linkedCharLabel: "Personagem Vinculado",
  linkedCharPlaceholder: "Opcional (salvo por build)",
  linkedLeagueLabel: "Liga",
  linkedLeaguePlaceholder: "Ex: Mercenaries",
  notesLabel: "Notas",
  notesPlaceholder: "Anotações rápidas da run, swaps de gemas ou alertas...",
  saveAndApplyBtn: "Salvar e Aplicar",
  saveAndOpenBtn: "Salvar e Abrir",
  saveOnlyBtn: "Apenas Salvar",
  savingBuildBtn: "Salvando...",
  buildsFolderFooter: "Salvo em:",
  defaultStarterBuildName: "Starter RF Elementalist",
  copySuffix: "Cópia",
};

const EN_LIBRARY: DesktopBuildLibraryMessages = {
  buildLibraryTitle: "Build Library",
  activeBuildPillLabel: "Active Build",
  editActiveBuild: "Edit Active",
  newBuildBtn: "New Build",
  newFolderBtn: "New Folder",
  openBuildsFolderBtn: "Open Folder",
  backToBuilds: "Back to Builds",
  buildsRootCrumb: "Builds",
  goUpFolderTitle: "Up one folder",
  searchBuildsPlaceholder: "Search by name, class, character, or notes...",
  sortLabel: "Sort",
  sortOptions: { updated: "Recent", name: "Name", class: "Class", level: "Level" },
  newFolderPlaceholder: "Folder name...",
  createBtn: "Create",
  folderBuildsCount: (count) => (count === 1 ? "1 build" : `${count} builds`),
  renameBtn: "Rename",
  deleteFolderNonEmptyWarn: (count) =>
    count > 0 ? `Delete folder + ${count} build(s)?` : "Confirm delete?",
  emptyFolderMsg: "No builds or subfolders in this folder yet.",
  emptySearchMsg: "No builds match this search.",
  activeBadge: "ACTIVE",
  twinkBadge: "TWINK",
  leagueStartBadge: "League Start",
  openBuildBtn: "Open",
  editBuildBtn: "Edit",
  duplicateBuildBtn: "Duplicate",
  moveBuildBtn: "Move",
  deleteBuildBtn: "Delete",
  moveTargetRoot: "Builds (Root)",
  moveHereBtn: "Move",
  stepsShort: (done, total, act) => `${done}/${total} steps · Act ${act}`,
  newBuildEditorTitle: "New Build",
  editBuildEditorTitle: "Edit Build",
  buildNameLabel: "Build Name",
  buildNamePlaceholder: "e.g. RF Elementalist 3.26",
  folderLabel: "Folder",
  linkedCharLabel: "Linked Character",
  linkedCharPlaceholder: "Optional (saved per build)",
  linkedLeagueLabel: "League",
  linkedLeaguePlaceholder: "e.g. Mercenaries",
  notesLabel: "Notes",
  notesPlaceholder: "Run reminders, gem swaps, or leveling notes...",
  saveAndApplyBtn: "Save & Apply",
  saveAndOpenBtn: "Save & Open",
  saveOnlyBtn: "Save Only",
  savingBuildBtn: "Saving...",
  buildsFolderFooter: "Saved in:",
  defaultStarterBuildName: "Starter RF Elementalist",
  copySuffix: "Copy",
};

export const DESKTOP_BUILD_LIBRARY_MESSAGES: Record<HudLocale, DesktopBuildLibraryMessages> = {
  "pt-BR": PT_BR_LIBRARY,
  en: EN_LIBRARY,
};
