use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::baked_loot_filter_presets::{
    baked_presets_for_game, poe_filter_subpath, BakedFilterPreset,
};
use crate::poe_process_heartbeat::PoeGameKind;

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

/// Resolves the item filter directory (`Documents/My Games/Path of Exile[ 2]`).
pub fn resolve_poe_filter_dir(app: &AppHandle, game: PoeGameKind) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(doc_dir) = app.path().document_dir() {
        push_unique_dir(&mut candidates, &mut seen, poe_filter_subpath(&doc_dir, game));
    }
    if let Some(user_profile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_filter_subpath(&user_profile.join("Documents"), game),
        );
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_filter_subpath(&user_profile.join("OneDrive").join("Documents"), game),
        );
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        push_unique_dir(
            &mut candidates,
            &mut seen,
            poe_filter_subpath(&home.join("Documents"), game),
        );
    }

    pick_best_poe_filter_dir(&candidates)
        .ok_or_else(|| "Could not resolve Path of Exile filter directory.".to_string())
}

/// Inspects which baked ExileHUD starter filters exist and are non-empty inside `filter_dir`.
pub fn inspect_filter_dir_status(filter_dir: &Path, game: PoeGameKind) -> LootFilterDirectoryStatus {
    let dir_exists = filter_dir.is_dir();
    let mut installed_preset_ids = Vec::new();
    let mut installed_file_names = Vec::new();

    if dir_exists {
        for preset in baked_presets_for_game(game) {
            let candidate = filter_dir.join(preset.file_name);
            let is_non_empty = candidate
                .metadata()
                .map(|meta| meta.is_file() && meta.len() > 0)
                .unwrap_or(false);
            if is_non_empty {
                installed_preset_ids.push(preset.id.to_string());
                installed_file_names.push(preset.file_name.to_string());
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
    game: PoeGameKind,
) -> Result<LootFilterInstallResult, String> {
    let presets = baked_presets_for_game(game);
    let selected_presets: Vec<BakedFilterPreset> = match selection {
        "regular" => vec![presets[0]],
        "semi_strict" => vec![presets[1]],
        "both" => vec![presets[0], presets[1]],
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

    for preset in selected_presets {
        let target_path = filter_dir.join(preset.file_name);
        let tmp_path = filter_dir.join(format!("{}.tmp", preset.file_name));
        fs::write(&tmp_path, preset.content)
            .map_err(|e| format!("Failed writing temp filter file {}: {e}", preset.file_name))?;
        fs::rename(&tmp_path, &target_path)
            .map_err(|e| format!("Failed installing filter file {}: {e}", preset.file_name))?;
        installed_paths.push(target_path.to_string_lossy().to_string());
        installed_file_names.push(preset.file_name.to_string());
    }

    Ok(LootFilterInstallResult {
        installed_paths,
        installed_file_names,
        status: inspect_filter_dir_status(filter_dir, game),
    })
}

#[tauri::command]
pub fn get_loot_filter_status(
    app: AppHandle,
    game_id: Option<String>,
) -> Result<LootFilterDirectoryStatus, String> {
    let game = PoeGameKind::parse(game_id.as_deref());
    let dir = resolve_poe_filter_dir(&app, game)?;
    Ok(inspect_filter_dir_status(&dir, game))
}

#[tauri::command]
pub fn install_league_starter_filter(
    app: AppHandle,
    preset_id: String,
    game_id: Option<String>,
) -> Result<LootFilterInstallResult, String> {
    let game = PoeGameKind::parse(game_id.as_deref());
    let dir = resolve_poe_filter_dir(&app, game)?;
    install_filter_selection_to_dir(&dir, preset_id.trim(), game)
}

#[tauri::command]
pub fn open_loot_filter_folder(
    app: AppHandle,
    game_id: Option<String>,
) -> Result<String, String> {
    let game = PoeGameKind::parse(game_id.as_deref());
    let dir = resolve_poe_filter_dir(&app, game)?;
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
    use crate::baked_loot_filter_presets::{
        POE2_REGULAR_FILTER_FILE_NAME, POE2_SEMI_STRICT_FILTER_FILE_NAME,
        REGULAR_FILTER_FILE_NAME, SEMI_STRICT_FILTER_FILE_NAME,
    };
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
    fn installs_poe1_and_poe2_filters_into_separate_game_folders() {
        let temp = tempdir().expect("tempdir");
        let poe1_dir = poe_filter_subpath(temp.path(), PoeGameKind::Poe1);
        let poe2_dir = poe_filter_subpath(temp.path(), PoeGameKind::Poe2);
        assert!(poe1_dir.ends_with("Path of Exile"));
        assert!(poe2_dir.ends_with("Path of Exile 2"));

        let initial = inspect_filter_dir_status(&poe1_dir, PoeGameKind::Poe1);
        assert!(!initial.dir_exists);
        assert!(initial.installed_preset_ids.is_empty());

        let reg_res = install_filter_selection_to_dir(&poe1_dir, "regular", PoeGameKind::Poe1).unwrap();
        assert_eq!(reg_res.installed_file_names, vec![REGULAR_FILTER_FILE_NAME]);
        assert_eq!(reg_res.status.installed_preset_ids, vec!["regular"]);

        let both_res = install_filter_selection_to_dir(&poe1_dir, "both", PoeGameKind::Poe1).unwrap();
        assert_eq!(
            both_res.installed_file_names,
            vec![REGULAR_FILTER_FILE_NAME, SEMI_STRICT_FILTER_FILE_NAME]
        );

        let poe2_res = install_filter_selection_to_dir(&poe2_dir, "both", PoeGameKind::Poe2).unwrap();
        assert_eq!(
            poe2_res.installed_file_names,
            vec![POE2_REGULAR_FILTER_FILE_NAME, POE2_SEMI_STRICT_FILTER_FILE_NAME]
        );
        let written_poe2 = fs::read_to_string(poe2_dir.join(POE2_REGULAR_FILTER_FILE_NAME)).unwrap();
        assert!(written_poe2.contains("Baked PoE 2 Base Filter"));
    }

    #[test]
    fn rejects_unknown_preset_selection() {
        let temp = tempdir().expect("tempdir");
        let err = install_filter_selection_to_dir(temp.path(), "uber_plus", PoeGameKind::Poe1).unwrap_err();
        assert!(err.contains("Unknown loot filter preset selection"));
    }
}
