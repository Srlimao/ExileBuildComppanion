import type { PobBuildPreview, PobSetSelection } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BuildLibraryEditorMetadataFields } from "./build_library_editor_metadata_fields.js";
import { BuildLibraryEditorPobTab } from "./build_library_editor_pob_tab.js";
import type { BuildEditorMode } from "./build_library_types.js";

export interface BuildEditorSubmitPayload {
  mode: Exclude<BuildEditorMode, { kind: "closed" }>;
  name: string;
  folderPath: string;
  rawInput: string;
  cachedXml: string | null;
  selection: PobSetSelection | null;
  leagueStart: boolean;
  customRouteText: string;
  characterName: string;
  selectedLeague: string;
  notes: string;
  activateAfterSave: boolean;
}

interface BuildLibraryEditorPanelProps {
  mode: Exclude<BuildEditorMode, { kind: "closed" }>;
  allFolders: readonly string[];
  activeBuildPath: string | null;
  busy: boolean;
  error: string | null;
  onInspectBuild: (
    rawPobInput: string,
    cachedXml?: string | null,
    previousSelection?: PobSetSelection | null,
  ) => Promise<{ decodedXml: string; preview: PobBuildPreview; selection: PobSetSelection }>;
  onSave: (payload: BuildEditorSubmitPayload) => Promise<void>;
  onCancel: () => void;
}

type EditorTab = "pob" | "meta";

/** Streamlined 2-tab PoB build editor tailored for the compact tray companion layout. */
export function BuildLibraryEditorPanel({
  mode,
  allFolders,
  activeBuildPath,
  busy,
  error,
  onInspectBuild,
  onSave,
  onCancel,
}: BuildLibraryEditorPanelProps) {
  const { appMsg } = useHudI18n();
  const initialRecord = mode.kind === "edit" ? mode.record : null;

  const [editorTab, setEditorTab] = useState<EditorTab>("pob");
  const [name, setName] = useState(initialRecord?.name ?? "");
  const [nameTouched, setNameTouched] = useState(mode.kind === "edit");
  const [folderPath, setFolderPath] = useState(mode.targetFolder);
  const [rawInput, setRawInput] = useState(initialRecord?.rawInput ?? "");
  const [leagueStart, setLeagueStart] = useState(initialRecord?.leagueStart ?? true);
  const [customRouteText, setCustomRouteText] = useState(initialRecord?.customRouteText ?? "");
  const [showCustomRoute, setShowCustomRoute] = useState(Boolean(initialRecord?.customRouteText));
  const [characterName, setCharacterName] = useState(initialRecord?.characterName ?? "");
  const [selectedLeague, setSelectedLeague] = useState(initialRecord?.selectedLeague ?? "");
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [preview, setPreview] = useState<PobBuildPreview | null>(null);
  const [selection, setSelection] = useState<PobSetSelection | null>(initialRecord?.selection ?? null);
  const [cachedXml, setCachedXml] = useState<{ input: string; xml: string } | null>(
    initialRecord?.cachedXml ? { input: initialRecord.rawInput, xml: initialRecord.cachedXml } : null,
  );
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const runInspect = useCallback(
    async (inputToRead: string, xmlHint?: string | null) => {
      if (!inputToRead.trim() && !xmlHint?.trim()) return;
      setInspecting(true);
      setInspectError(null);
      try {
        const res = await onInspectBuild(inputToRead, xmlHint ?? null, selection);
        setPreview(res.preview);
        setSelection(res.selection);
        setCachedXml({ input: inputToRead, xml: res.decodedXml });
        if (!nameTouched && res.preview.buildName.trim()) {
          setName(res.preview.buildName.trim());
        }
      } catch (err) {
        setInspectError(err instanceof Error ? err.message : String(err));
      } finally {
        setInspecting(false);
      }
    },
    [nameTouched, onInspectBuild, selection],
  );

  useEffect(() => {
    if (mode.kind === "edit" && (initialRecord?.rawInput || initialRecord?.cachedXml)) {
      void runInspect(initialRecord.rawInput, initialRecord.cachedXml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const trimmed = rawInput.trim();
    if (!trimmed || trimmed === cachedXml?.input.trim()) return;
    const looksComplete =
      /^https?:\/\/pobb\.in\/[A-Za-z0-9_-]+/i.test(trimmed) ||
      trimmed.startsWith("<") ||
      trimmed.length > 24;
    if (!looksComplete) return;
    const timer = window.setTimeout(() => void runInspect(rawInput, null), 450);
    return () => window.clearTimeout(timer);
  }, [cachedXml?.input, rawInput, runInspect]);

  const isEditingActive = mode.kind === "edit" && mode.targetPath === activeBuildPath;
  const canSubmit = !busy && Boolean(rawInput.trim() || cachedXml?.xml) && Boolean(name.trim());
  const primaryLabel = busy
    ? appMsg.desktop.savingBuildBtn
    : isEditingActive
      ? appMsg.desktop.saveAndApplyBtn
      : appMsg.desktop.saveAndOpenBtn;

  const submit = (activateAfterSave: boolean) => {
    void onSave({
      mode,
      name: name.trim() || preview?.buildName || "Untitled Build",
      folderPath,
      rawInput: rawInput.trim(),
      cachedXml: cachedXml?.input === rawInput ? cachedXml.xml : null,
      selection,
      leagueStart,
      customRouteText,
      characterName: characterName.trim(),
      selectedLeague: selectedLeague.trim(),
      notes: notes.trim(),
      activateAfterSave,
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-hud-hairline">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {appMsg.desktop.backToBuilds}
        </button>

        <span className="text-xs font-semibold text-hud-text truncate">
          {mode.kind === "create"
            ? appMsg.desktop.newBuildEditorTitle
            : appMsg.desktop.editBuildEditorTitle}
        </span>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => submit(true)}
          className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-45 px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Sparkles className="h-3 w-3" />
          {primaryLabel}
        </button>
      </div>

      <div className="grid grid-cols-2 p-0.5 rounded-lg bg-hud-subtle text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setEditorTab("pob")}
          className={`py-1 rounded-md cursor-pointer transition-colors ${
            editorTab === "pob"
              ? "bg-hud-surface text-hud-text font-semibold shadow-sm"
              : "text-hud-muted hover:text-hud-text"
          }`}
        >
          {appMsg.desktop.editorTabPob}
        </button>
        <button
          type="button"
          onClick={() => setEditorTab("meta")}
          className={`py-1 rounded-md cursor-pointer transition-colors ${
            editorTab === "meta"
              ? "bg-hud-surface text-hud-text font-semibold shadow-sm"
              : "text-hud-muted hover:text-hud-text"
          }`}
        >
          {appMsg.desktop.editorTabMeta}
        </button>
      </div>

      {editorTab === "pob" ? (
        <BuildLibraryEditorPobTab
          name={name}
          folderPath={folderPath}
          allFolders={allFolders}
          rawInput={rawInput}
          leagueStart={leagueStart}
          preview={preview}
          selection={selection}
          inspecting={inspecting}
          onChangeName={(nextName) => {
            setNameTouched(true);
            setName(nextName);
          }}
          onChangeFolderPath={setFolderPath}
          onChangeRawInput={setRawInput}
          onChangeLeagueStart={setLeagueStart}
          onInspect={() => void runInspect(rawInput, null)}
          onChangeSelection={setSelection}
        />
      ) : (
        <BuildLibraryEditorMetadataFields
          characterName={characterName}
          selectedLeague={selectedLeague}
          notes={notes}
          customRouteText={customRouteText}
          showCustomRoute={showCustomRoute}
          onToggleCustomRoute={() => setShowCustomRoute((v) => !v)}
          onChangeCharacterName={setCharacterName}
          onChangeSelectedLeague={setSelectedLeague}
          onChangeNotes={setNotes}
          onChangeCustomRoute={setCustomRouteText}
        />
      )}

      {(error || inspectError) && (
        <p className="border-l-2 border-hud-danger pl-2.5 py-0.5 text-[11px] text-hud-danger">
          {error || inspectError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-hud-hairline">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2.5 py-1.5 text-xs text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
        >
          {appMsg.desktop.cancel}
        </button>
        {!isEditingActive && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit(false)}
            className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 disabled:opacity-45 px-3 py-1.5 text-xs font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {appMsg.desktop.saveOnlyBtn}
          </button>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => submit(true)}
          className="rounded-lg bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-45 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {primaryLabel}
        </button>
      </div>
    </section>
  );
}
