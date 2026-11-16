use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const REGULAR_FILTER_FILE_NAME: &str = "ExileHUD_LeagueStart_Regular.filter";
pub const SEMI_STRICT_FILTER_FILE_NAME: &str = "ExileHUD_LeagueStart_SemiStrict.filter";

const REGULAR_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe1/filters/ExileHUD_LeagueStart_Regular.filter"
);
const SEMI_STRICT_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe1/filters/ExileHUD_LeagueStart_SemiStrict.filter"
);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LootFilterDirectoryStatus {
    pub filter_dir: String,
    pub dir_exists: bool,
    pub installed_preset_ids: Vec<String>,
    pub installed_file_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LootFilterInstallResult {
    pub installed_paths: Vec<String>,
    pub installed_file_names: Vec<String>,
    pub status: LootFilterDirectoryStatus,
}

const BAKED_PRESETS: [(&str, &str, &str); 2] = [
    ("regular", REGULAR_FILTER_FILE_NAME, REGULAR_FILTER_CONTENT),
    (
        "semi_strict",
        SEMI_STRICT_FILTER_FILE_NAME,
        SEMI_STRICT_FILTER_CONTENT,
    ),
];

/// Returns the first existing directory from candidates, or falls back to the first candidate.
pub fn pick_best_poe_filter_dir(candidates: &[PathBuf]) -> Option<PathBuf> {
    if let Some(existing) = candidates.iter().find(|dir| dir.is_dir()) {
        return Some(existing.clone());
    }
    candidates.first().cloned()
}

fn push_unique_dir(candidates: &mut Vec<PathBuf>, seen: &mut HashSet<String>, dir: PathBuf) {
    let key = dir.to_string_lossy().to_ascii_lowercase();
    if seen.insert(key) {
        candidates.push(dir);
    }
}

fn poe_subpath(documents_root: &Path) -> PathBuf {
    documents_root.join("My Games").join("Path of Exile")
}

/// Resolves the Path of Exile item filter directory (`Documents/My Games/Path of Exile`).
pub fn resolve_poe_filter_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(doc_dir) = app.path().document_dir() {
        push_unique_dir(&mut candidates, &mut seen, poe_subpath(&doc_dir));
    }
    if let Some(user_profile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_subpath(&user_profile.join("Documents")),
        );
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_subpath(&user_profile.join("OneDrive").join("Documents")),
        );
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_subpath(&home.join("Documents")),
        );
    }

    pick_best_poe_filter_dir(&candidates)
        .ok_or_else(|| "Could not resolve Path of Exile filter directory.".to_string())
}

/// Inspects which baked ExileHUD starter filters exist and are non-empty inside `filter_dir`.
pub fn inspect_filter_dir_status(filter_dir: &Path) -> LootFilterDirectoryStatus {
    let dir_exists = filter_dir.is_dir();
    let mut installed_preset_ids = Vec::new();
    let mut installed_file_names = Vec::new();

    if dir_exists {
        for (preset_id, file_name, _) in BAKED_PRESETS {
            let candidate = filter_dir.join(file_name);
            let is_non_empty = candidate
                .metadata()
                .map(|meta| meta.is_file() && meta.len() > 0)
                .unwrap_or(false);
            if is_non_empty {
                installed_preset_ids.push(preset_id.to_string());
                installed_file_names.push(file_name.to_string());
            }
        }
    }

    LootFilterDirectoryStatus {
        filter_dir: filter_dir.to_string_lossy().to_string(),
        dir_exists,
        installed_preset_ids,
        installed_file_names,
    }
}

/// Atomically installs the selected baked starter filter preset(s) into `filter_dir`.
pub fn install_filter_selection_to_dir(
    filter_dir: &Path,
    selection: &str,
) -> Result<LootFilterInstallResult, String> {
    let selected_presets: Vec<(&str, &str, &str)> = match selection {
        "regular" => vec![BAKED_PRESETS[0]],
        "semi_strict" => vec![BAKED_PRESETS[1]],
        "both" => vec![BAKED_PRESETS[0], BAKED_PRESETS[1]],
        other => {
            return Err(format!(
                "Unknown loot filter preset selection \"{other}\". Expected regular, semi_strict, or both."
            ));
        }
    };

    fs::create_dir_all(filter_dir)
        .map_err(|e| format!("Failed creating Path of Exile filter folder: {e}"))?;

    let mut installed_paths = Vec::new();
    let mut installed_file_names = Vec::new();

    for (_, file_name, content) in selected_presets {
        let target_path = filter_dir.join(file_name);
        let tmp_path = filter_dir.join(format!("{file_name}.tmp"));
        fs::write(&tmp_path, content)
            .map_err(|e| format!("Failed writing temp filter file {file_name}: {e}"))?;
        fs::rename(&tmp_path, &target_path)
            .map_err(|e| format!("Failed installing filter file {file_name}: {e}"))?;
        installed_paths.push(target_path.to_string_lossy().to_string());
        installed_file_names.push(file_name.to_string());
    }

    Ok(LootFilterInstallResult {
        installed_paths,
        installed_file_names,
        status: inspect_filter_dir_status(filter_dir),
    })
}

#[tauri::command]
pub fn get_loot_filter_status(app: AppHandle) -> Result<LootFilterDirectoryStatus, String> {
    let dir = resolve_poe_filter_dir(&app)?;
    Ok(inspect_filter_dir_status(&dir))
}

#[tauri::command]
pub fn install_league_starter_filter(
    app: AppHandle,
    preset_id: String,
) -> Result<LootFilterInstallResult, String> {
    let dir = resolve_poe_filter_dir(&app)?;
    install_filter_selection_to_dir(&dir, preset_id.trim())
}

#[tauri::command]
pub fn open_loot_filter_folder(app: AppHandle) -> Result<String, String> {
    let dir = resolve_poe_filter_dir(&app)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed creating Path of Exile filter folder: {e}"))?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed opening Explorer: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn picks_existing_poe_filter_directory_or_falls_back_to_first_candidate() {
        let temp = tempdir().expect("tempdir");
        let missing = temp.path().join("missing_docs");
        let existing = temp.path().join("onedrive_docs");
        fs::create_dir_all(&existing).unwrap();

        let picked_existing =
            pick_best_poe_filter_dir(&[missing.clone(), existing.clone()]).unwrap();
        assert_eq!(picked_existing, existing);

        let fallback = temp.path().join("fallback_docs");
        let picked_fallback =
            pick_best_poe_filter_dir(&[missing.clone(), fallback]).unwrap();
        assert_eq!(picked_fallback, missing);
        assert_eq!(pick_best_poe_filter_dir(&[]), None);
    }

    #[test]
    fn installs_regular_semi_strict_and_both_filters_and_reports_status() {
        let temp = tempdir().expect("tempdir");
        let filter_dir = temp.path().join("My Games").join("Path of Exile");

        let initial = inspect_filter_dir_status(&filter_dir);
        assert!(!initial.dir_exists);
        assert!(initial.installed_preset_ids.is_empty());

        let reg_res = install_filter_selection_to_dir(&filter_dir, "regular").unwrap();
        assert_eq!(reg_res.installed_file_names, vec![REGULAR_FILTER_FILE_NAME]);
        assert_eq!(reg_res.status.installed_preset_ids, vec!["regular"]);
        let written_reg = fs::read_to_string(filter_dir.join(REGULAR_FILTER_FILE_NAME)).unwrap();
        assert!(written_reg.contains("Exile Companion HUD"));
        assert!(written_reg.contains("1-REGULAR"));

        let semi_res = install_filter_selection_to_dir(&filter_dir, "semi_strict").unwrap();
        assert_eq!(
            semi_res.installed_file_names,
            vec![SEMI_STRICT_FILTER_FILE_NAME]
        );
        assert_eq!(
            semi_res.status.installed_preset_ids,
            vec!["regular", "semi_strict"]
        );

        let both_res = install_filter_selection_to_dir(&filter_dir, "both").unwrap();
        assert_eq!(
            both_res.installed_file_names,
            vec![REGULAR_FILTER_FILE_NAME, SEMI_STRICT_FILTER_FILE_NAME]
        );
        assert!(both_res.status.dir_exists);
        assert_eq!(
            both_res.status.installed_preset_ids,
            vec!["regular", "semi_strict"]
        );
    }

    #[test]
    fn rejects_unknown_preset_selection() {
        let temp = tempdir().expect("tempdir");
        let err = install_filter_selection_to_dir(temp.path(), "uber_plus").unwrap_err();
        assert!(err.contains("Unknown loot filter preset selection"));
    }
}
