import type { PobBuildPreview, PobSetSelection } from "@exile-hud/core";
import { useHudI18n } from "@exile-hud/hud-ui";
import { ArrowLeft, RefreshCw, Route, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PobSetSelectorSection } from "../pob_profile_panel/pob_set_selector_section.js";
import { BuildLibraryEditorMetadataFields } from "./build_library_editor_metadata_fields.js";
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
      <div className="flex items-center justify-between gap-2 border-b border-hud-hairline pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {appMsg.desktop.backToBuilds}
        </button>
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-hud-accent">
          {mode.kind === "create"
            ? appMsg.desktop.newBuildEditorTitle
            : appMsg.desktop.editBuildEditorTitle}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.buildNameLabel}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder={appMsg.desktop.buildNamePlaceholder}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2.5 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          />
        </label>
        <label className="space-y-1 min-w-0">
          <span className="text-[11px] text-hud-muted block">{appMsg.desktop.folderLabel}</span>
          <select
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline px-2 py-1.5 text-xs text-hud-text focus:outline-none focus:border-hud-accent"
          >
            <option value="">{appMsg.desktop.moveTargetRoot}</option>
            {allFolders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-hud-muted">{appMsg.desktop.pobInputLabel}</span>
        <div className="inline-flex items-center gap-3 text-[11px]">
          {[
            { label: appMsg.desktop.leagueStart, val: true },
            { label: appMsg.desktop.twink, val: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setLeagueStart(opt.val)}
              className={`pb-0.5 border-b-2 cursor-pointer transition-colors ${
                leagueStart === opt.val
                  ? "border-hud-accent text-hud-text font-semibold"
                  : "border-transparent text-hud-muted hover:text-hud-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        rows={3}
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={appMsg.desktop.pobInputPlaceholder}
        className="w-full rounded-md bg-hud-subtle border-b border-hud-hairline p-2.5 text-xs font-mono text-hud-text focus:outline-none focus:border-hud-accent resize-none"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowCustomRoute((v) => !v)}
          className="text-[11px] text-hud-muted hover:text-hud-text inline-flex items-center gap-1 cursor-pointer"
        >
          <Route className="h-3.5 w-3.5" />
          {showCustomRoute ? appMsg.desktop.hideCustomRoute : appMsg.desktop.customRoute}
        </button>
        <button
          type="button"
          disabled={inspecting || !rawInput.trim()}
          onClick={() => void runInspect(rawInput, null)}
          className="rounded-md hover:bg-hud-subtle disabled:opacity-45 px-2.5 py-1 text-[11px] text-hud-text inline-flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${inspecting ? "animate-spin" : ""}`} />
          {inspecting ? appMsg.desktop.readingSets : appMsg.desktop.inspectSets}
        </button>
      </div>

      {preview && selection && (
        <PobSetSelectorSection preview={preview} selection={selection} onChange={setSelection} />
      )}

      <BuildLibraryEditorMetadataFields
        characterName={characterName}
        selectedLeague={selectedLeague}
        notes={notes}
        customRouteText={customRouteText}
        showCustomRoute={showCustomRoute}
        onChangeCharacterName={setCharacterName}
        onChangeSelectedLeague={setSelectedLeague}
        onChangeNotes={setNotes}
        onChangeCustomRoute={setCustomRouteText}
      />

      {(error || inspectError) && (
        <p className="border-l-2 border-hud-danger pl-2.5 py-0.5 text-[11px] text-hud-danger">
          {error || inspectError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-hud-hairline">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1.5 text-xs text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
        >
          {appMsg.desktop.cancel}
        </button>
        {!isEditingActive && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit(false)}
            className="rounded-md bg-hud-subtle hover:bg-hud-hairline/50 disabled:opacity-45 px-3 py-1.5 text-xs font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {appMsg.desktop.saveOnlyBtn}
          </button>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => submit(true)}
          className="rounded-md bg-hud-accent text-hud-accent-fg hover:opacity-90 disabled:opacity-45 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy
            ? appMsg.desktop.savingBuildBtn
            : isEditingActive
              ? appMsg.desktop.saveAndApplyBtn
              : appMsg.desktop.saveAndOpenBtn}
        </button>
      </div>
    </section>
  );
}
