import { useHudI18n } from "@exile-hud/hud-ui";
import { FileCode2, FolderOpen, FolderSearch, RefreshCw } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";
import {
  openPoe2BuildPlannerFolder,
  readPoe2BuildPlannerFile,
  scanPoe2BuildPlannerDir,
  type Poe2BuildPlannerScanResult,
} from "./poe2_build_planner_ipc_client.js";

const MAX_BUILD_UPLOAD_BYTES = 2 * 1024 * 1024;

interface Poe2BuildPlannerImportPopoverProps {
  onLoadBuildJson: (rawJson: string, fallbackName?: string) => void;
}

/** Compact PoE 2 `.build` file picker and `BuildPlanner\` folder quick-importer inside the Build Editor. */
export function Poe2BuildPlannerImportPopover({ onLoadBuildJson }: Poe2BuildPlannerImportPopoverProps) {
  const { appMsg } = useHudI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Poe2BuildPlannerScanResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BUILD_UPLOAD_BYTES) {
      setLocalError(appMsg.poe2Build.fileTooLargeError);
      return;
    }
    setLocalError(null);
    const text = await file.text();
    const fallbackName = file.name.replace(/\.(?:build|json)$/i, "").trim();
    onLoadBuildJson(text, fallbackName || undefined);
  };

  const refreshScan = async () => {
    setScanning(true);
    setLocalError(null);
    try {
      const res = await scanPoe2BuildPlannerDir();
      setScanResult(res);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const togglePlanner = () => {
    const nextOpen = !plannerOpen;
    setPlannerOpen(nextOpen);
    if (nextOpen && !scanResult) {
      void refreshScan();
    }
  };

  const handlePickPlannerFile = async (fileName: string, buildName: string) => {
    setLocalError(null);
    try {
      const rawJson = await readPoe2BuildPlannerFile(fileName);
      setPlannerOpen(false);
      onLoadBuildJson(rawJson, buildName || fileName.replace(/\.build$/i, ""));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const inDesktop = isTauriRuntime();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".build,.json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 border border-hud-hairline px-2.5 py-1 text-[11px] font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5 text-hud-accent" />
            {appMsg.poe2Build.importBuildFileBtn}
          </button>

          <button
            type="button"
            aria-expanded={plannerOpen}
            onClick={togglePlanner}
            className="rounded-lg bg-hud-subtle hover:bg-hud-hairline/50 border border-hud-hairline px-2.5 py-1 text-[11px] font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FolderSearch className="h-3.5 w-3.5 text-hud-accent" />
            {appMsg.poe2Build.fromBuildPlannerBtn}
          </button>
        </div>

        {inDesktop && (
          <button
            type="button"
            onClick={() => void openPoe2BuildPlannerFolder()}
            title={appMsg.poe2Build.openPlannerFolderTooltip(scanResult?.plannerDir ?? "")}
            aria-label={appMsg.poe2Build.openPlannerFolderTooltip(scanResult?.plannerDir ?? "")}
            className="p-1.5 rounded-lg text-hud-muted hover:text-hud-text hover:bg-hud-subtle cursor-pointer"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {localError && <p className="text-[11px] text-hud-danger">{localError}</p>}

      {plannerOpen && (
        <div className="rounded-xl bg-hud-surface border border-hud-hairline p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-hud-muted">
            <span className="truncate font-mono">{scanResult?.plannerDir || "BuildPlanner\\"}</span>
            {inDesktop && (
              <button
                type="button"
                disabled={scanning}
                onClick={() => void refreshScan()}
                className="inline-flex items-center gap-1 text-hud-text hover:text-hud-accent cursor-pointer shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
                {appMsg.poe2Build.refreshPlannerBtn}
              </button>
            )}
          </div>

          {!inDesktop ? (
            <p className="text-[11px] text-hud-muted leading-snug">{appMsg.poe2Build.plannerWebFallbackHint}</p>
          ) : (scanResult?.files.length ?? 0) === 0 ? (
            <p className="text-[11px] text-hud-muted leading-snug">{appMsg.poe2Build.plannerEmptyHint}</p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              {scanResult!.files.map((f) => (
                <button
                  key={f.fileName}
                  type="button"
                  onClick={() => void handlePickPlannerFile(f.fileName, f.buildName)}
                  className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-hud-subtle flex items-baseline justify-between gap-2 text-xs cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-hud-text truncate">{f.buildName}</div>
                    <div className="text-[11px] text-hud-muted truncate">
                      {f.ascendancy ? `${f.ascendancy} · ` : ""}
                      {f.fileName}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-hud-dim shrink-0">
                    {Math.max(1, Math.round(f.byteSize / 1024))} KB
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
