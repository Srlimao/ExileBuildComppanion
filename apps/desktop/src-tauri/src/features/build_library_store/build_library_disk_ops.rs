use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::build_library_store::build_library_types::{
    build_relative_path, entry_summary_from_record, library_builds_dir_name,
    library_state_file_name, normalize_game_id, normalize_relative_build_path,
    normalize_relative_folder, relative_path_to_abs, sanitize_segment, BuildLibraryEntrySummary,
    BuildLibraryStateFile, BuildProgressPatch, SavedBuildFileRecord,
};

pub(crate) fn ensure_builds_root_for_game(
    app_data_dir: &Path,
    game_id: Option<&str>,
) -> Result<PathBuf, String> {
    let root = app_data_dir.join(library_builds_dir_name(game_id));
    fs::create_dir_all(&root).map_err(|e| format!("Failed creating builds directory: {e}"))?;
    Ok(root)
}

pub(crate) fn ensure_builds_root(app_data_dir: &Path) -> Result<PathBuf, String> {
    ensure_builds_root_for_game(app_data_dir, Some("poe1"))
}

pub(crate) fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating directory: {e}"))?;
    }
    let serialized = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed serializing build JSON: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &serialized).map_err(|e| format!("Failed writing temp JSON: {e}"))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed finalizing JSON file: {e}"))?;
    Ok(())
}

pub(crate) fn load_library_state_for_game(
    app_data_dir: &Path,
    game_id: Option<&str>,
) -> BuildLibraryStateFile {
    let path = app_data_dir.join(library_state_file_name(game_id));
    let Ok(raw) = fs::read_to_string(path) else {
        return BuildLibraryStateFile::default();
    };
    serde_json::from_str::<BuildLibraryStateFile>(&raw).unwrap_or_default()
}

pub(crate) fn save_library_state_for_game(
    app_data_dir: &Path,
    game_id: Option<&str>,
    state: &BuildLibraryStateFile,
) -> Result<(), String> {
    let path = app_data_dir.join(library_state_file_name(game_id));
    write_json_atomic(&path, state)
}

pub(crate) fn load_library_state(app_data_dir: &Path) -> BuildLibraryStateFile {
    load_library_state_for_game(app_data_dir, Some("poe1"))
}

pub(crate) fn save_library_state(
    app_data_dir: &Path,
    state: &BuildLibraryStateFile,
) -> Result<(), String> {
    save_library_state_for_game(app_data_dir, Some("poe1"), state)
}

pub fn load_build_file_for_game(
    app_data_dir: &Path,
    relative_path: &str,
    game_id: Option<&str>,
) -> Result<SavedBuildFileRecord, String> {
    let root = ensure_builds_root_for_game(app_data_dir, game_id)?;
    let norm = normalize_relative_build_path(relative_path)?;
    let abs = relative_path_to_abs(&root, &norm);
    if !abs.is_file() {
        return Err(format!("Build file not found: {norm}"));
    }
    let raw = fs::read_to_string(&abs).map_err(|e| format!("Failed reading build file: {e}"))?;
    serde_json::from_str::<SavedBuildFileRecord>(&raw)
        .map_err(|e| format!("Invalid build JSON ({norm}): {e}"))
}

pub fn load_build_file(
    app_data_dir: &Path,
    relative_path: &str,
) -> Result<SavedBuildFileRecord, String> {
    load_build_file_for_game(app_data_dir, relative_path, Some("poe1"))
}

fn find_non_colliding_name(
    builds_root: &Path,
    folder: &str,
    base_name: &str,
) -> Result<String, String> {
    let first_rel = build_relative_path(folder, base_name)?;
    if !relative_path_to_abs(builds_root, &first_rel).exists() {
        return Ok(base_name.to_string());
    }
    for idx in 2..=999 {
        let suffix = format!(" ({idx})");
        let max_stem_chars = 80usize.saturating_sub(suffix.len());
        let truncated: String = base_name.chars().take(max_stem_chars).collect();
        let candidate = format!("{}{}", truncated.trim_end(), suffix);
        let rel = build_relative_path(folder, &candidate)?;
        if !relative_path_to_abs(builds_root, &rel).exists() {
            return Ok(candidate);
        }
    }
    Err("Too many builds with the same name in this folder".to_string())
}

fn write_record_handling_case_rename(
    old_abs: &Path,
    target_abs: &Path,
    same_case_insensitive: bool,
    exact_same: bool,
    record: &SavedBuildFileRecord,
) -> Result<(), String> {
    if !same_case_insensitive && target_abs.exists() {
        return Err("A build with that name already exists in this folder".to_string());
    }
    if let Some(parent) = target_abs.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating folder: {e}"))?;
    }
    let serialized = serde_json::to_string_pretty(record)
        .map_err(|e| format!("Failed serializing build record: {e}"))?;
    let tmp_path = target_abs.with_extension("json.tmp");
    fs::write(&tmp_path, &serialized).map_err(|e| format!("Failed writing temp build: {e}"))?;

    if same_case_insensitive && !exact_same && old_abs.exists() {
        let bak_path = old_abs.with_extension("json.bak");
        fs::rename(old_abs, &bak_path).map_err(|e| format!("Failed preparing rename: {e}"))?;
        if let Err(err) = fs::rename(&tmp_path, target_abs) {
            let _ = fs::rename(&bak_path, old_abs);
            return Err(format!("Failed finalizing build rename: {err}"));
        }
        let _ = fs::remove_file(&bak_path);
    } else {
        fs::rename(&tmp_path, target_abs).map_err(|e| format!("Failed saving build file: {e}"))?;
        if !same_case_insensitive && old_abs.exists() {
            let _ = fs::remove_file(old_abs);
        }
    }
    Ok(())
}

pub fn save_build_file_for_game(
    app_data_dir: &Path,
    folder_path: &str,
    mut record: SavedBuildFileRecord,
    overwrite_path: Option<&str>,
    set_active: bool,
    game_id: Option<&str>,
) -> Result<BuildLibraryEntrySummary, String> {
    let norm_game = normalize_game_id(game_id.or(Some(&record.game_id)));
    let root = ensure_builds_root_for_game(app_data_dir, Some(norm_game))?;
    let clean_folder = normalize_relative_folder(folder_path)?;
    if !clean_folder.is_empty() {
        fs::create_dir_all(relative_path_to_abs(&root, &clean_folder))
            .map_err(|e| format!("Failed creating target folder: {e}"))?;
    }
    let initial_name = sanitize_segment(&record.name)?;
    let clean_name = match overwrite_path {
        Some(_) => initial_name,
        None => find_non_colliding_name(&root, &clean_folder, &initial_name)?,
    };
    record.schema_version = 1;
    record.game_id = norm_game.to_string();
    record.name = clean_name.clone();

    let target_rel = build_relative_path(&clean_folder, &clean_name)?;
    let target_abs = relative_path_to_abs(&root, &target_rel);

    let mut state = load_library_state_for_game(app_data_dir, Some(norm_game));
    let mut state_dirty = false;

    if let Some(old_raw) = overwrite_path {
        let old_norm = normalize_relative_build_path(old_raw)?;
        let old_abs = relative_path_to_abs(&root, &old_norm);
        let same_ci = old_norm.eq_ignore_ascii_case(&target_rel);
        let exact_same = old_norm == target_rel;
        write_record_handling_case_rename(&old_abs, &target_abs, same_ci, exact_same, &record)?;
        if state
            .active_build_path
            .as_deref()
            .is_some_and(|a| a.eq_ignore_ascii_case(&old_norm))
            && state.active_build_path.as_deref() != Some(&target_rel)
        {
            state.active_build_path = Some(target_rel.clone());
            state.active_build_path_by_game.insert(norm_game.to_string(), target_rel.clone());
            state_dirty = true;
        }
    } else {
        write_json_atomic(&target_abs, &record)?;
    }

    if set_active && state.active_build_path.as_deref() != Some(&target_rel) {
        state.active_build_path = Some(target_rel.clone());
        state.active_build_path_by_game.insert(norm_game.to_string(), target_rel.clone());
        state_dirty = true;
    }
    if state_dirty {
        save_library_state_for_game(app_data_dir, Some(norm_game), &state)?;
    }

    Ok(entry_summary_from_record(target_rel, &record))
}

pub fn save_build_file(
    app_data_dir: &Path,
    folder_path: &str,
    record: SavedBuildFileRecord,
    overwrite_path: Option<&str>,
    set_active: bool,
) -> Result<BuildLibraryEntrySummary, String> {
    save_build_file_for_game(app_data_dir, folder_path, record, overwrite_path, set_active, Some("poe1"))
}

pub fn update_build_progress_for_game(
    app_data_dir: &Path,
    relative_path: &str,
    patch: BuildProgressPatch,
    game_id: Option<&str>,
) -> Result<(), String> {
    let root = ensure_builds_root_for_game(app_data_dir, game_id)?;
    let norm = normalize_relative_build_path(relative_path)?;
    let abs = relative_path_to_abs(&root, &norm);
    let mut record = load_build_file_for_game(app_data_dir, &norm, game_id)?;

    if let Some(progress) = patch.progress {
        record.progress = progress;
    }
    if let Some(summary) = patch.summary {
        record.summary = summary;
    }
    if let Some(run_elapsed_ms) = patch.run_elapsed_ms {
        record.run_elapsed_ms = run_elapsed_ms;
    }
    if let Some(act_splits_ms) = patch.act_splits_ms {
        record.act_splits_ms = act_splits_ms;
    }
    if let Some(character_name) = patch.character_name {
        record.character_name = character_name;
    }
    if let Some(selected_league) = patch.selected_league {
        record.selected_league = selected_league;
    }
    record.updated_at_ms = patch.updated_at_ms;
    write_json_atomic(&abs, &record)
}

pub fn update_build_progress(
    app_data_dir: &Path,
    relative_path: &str,
    patch: BuildProgressPatch,
) -> Result<(), String> {
    update_build_progress_for_game(app_data_dir, relative_path, patch, Some("poe1"))
}

pub fn set_active_build_path_for_game(
    app_data_dir: &Path,
    relative_path: Option<&str>,
    game_id: Option<&str>,
) -> Result<(), String> {
    let norm_game = normalize_game_id(game_id);
    let root = ensure_builds_root_for_game(app_data_dir, Some(norm_game))?;
    let norm = match relative_path {
        Some(raw) if !raw.trim().is_empty() => {
            let p = normalize_relative_build_path(raw)?;
            if !relative_path_to_abs(&root, &p).is_file() {
                return Err(format!("Build file not found: {p}"));
            }
            Some(p)
        }
        _ => None,
    };
    let mut state = load_library_state_for_game(app_data_dir, Some(norm_game));
    state.active_build_path = norm.clone();
    if let Some(p) = norm {
        state.active_build_path_by_game.insert(norm_game.to_string(), p);
    } else {
        state.active_build_path_by_game.remove(norm_game);
    }
    save_library_state_for_game(app_data_dir, Some(norm_game), &state)
}

pub fn set_active_build_path(
    app_data_dir: &Path,
    relative_path: Option<&str>,
) -> Result<(), String> {
    set_active_build_path_for_game(app_data_dir, relative_path, Some("poe1"))
}
