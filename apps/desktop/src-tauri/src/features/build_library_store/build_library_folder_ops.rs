use std::fs;
use std::path::Path;

use crate::build_library_store::build_library_disk_ops::{
    ensure_builds_root_for_game, load_build_file_for_game, load_library_state_for_game,
    save_build_file_for_game, save_library_state_for_game,
};
use crate::build_library_store::build_library_migration_and_listing::{
    collect_folders_and_builds, pick_next_active_build_path,
};
use crate::build_library_store::build_library_types::{
    folder_of_relative_build_path, is_path_inside_folder, normalize_game_id,
    normalize_relative_build_path, normalize_relative_folder, relative_path_to_abs,
    remap_active_path_after_folder_move, sanitize_segment, BuildLibraryEntrySummary,
};
use crate::local_campaign_progress_disk_store::SavedCampaignProgressRecord;

pub fn rename_or_move_build_for_game(
    app_data_dir: &Path,
    from_path: &str,
    target_folder: &str,
    new_name: &str,
    now_ms: u64,
    game_id: Option<&str>,
) -> Result<BuildLibraryEntrySummary, String> {
    let mut record = load_build_file_for_game(app_data_dir, from_path, game_id)?;
    record.name = new_name.to_string();
    record.updated_at_ms = now_ms;
    save_build_file_for_game(app_data_dir, target_folder, record, Some(from_path), false, game_id)
}

pub fn rename_or_move_build(
    app_data_dir: &Path,
    from_path: &str,
    target_folder: &str,
    new_name: &str,
    now_ms: u64,
) -> Result<BuildLibraryEntrySummary, String> {
    rename_or_move_build_for_game(app_data_dir, from_path, target_folder, new_name, now_ms, Some("poe1"))
}

pub fn duplicate_build_for_game(
    app_data_dir: &Path,
    source_path: &str,
    target_folder: &str,
    new_name: &str,
    copy_progress: bool,
    new_id: String,
    now_ms: u64,
    game_id: Option<&str>,
) -> Result<BuildLibraryEntrySummary, String> {
    let mut record = load_build_file_for_game(app_data_dir, source_path, game_id)?;
    record.id = new_id;
    record.name = new_name.to_string();
    record.created_at_ms = now_ms;
    record.updated_at_ms = now_ms;
    if !copy_progress {
        record.progress = SavedCampaignProgressRecord::default();
        record.run_elapsed_ms = 0;
        record.act_splits_ms.clear();
        record.character_name.clear();
        record.summary.completed_checkpoints = 0;
        record.summary.completed_gems = 0;
        record.summary.current_act = 1;
        record.summary.current_area_name.clear();
    }
    save_build_file_for_game(app_data_dir, target_folder, record, None, false, game_id)
}

pub fn duplicate_build(
    app_data_dir: &Path,
    source_path: &str,
    target_folder: &str,
    new_name: &str,
    copy_progress: bool,
    new_id: String,
    now_ms: u64,
) -> Result<BuildLibraryEntrySummary, String> {
    duplicate_build_for_game(
        app_data_dir,
        source_path,
        target_folder,
        new_name,
        copy_progress,
        new_id,
        now_ms,
        Some("poe1"),
    )
}

pub fn delete_build_for_game(
    app_data_dir: &Path,
    relative_path: &str,
    game_id: Option<&str>,
) -> Result<Option<String>, String> {
    let norm_game = normalize_game_id(game_id);
    let root = ensure_builds_root_for_game(app_data_dir, Some(norm_game))?;
    let norm = normalize_relative_build_path(relative_path)?;
    let abs = relative_path_to_abs(&root, &norm);
    if !abs.is_file() {
        return Err(format!("Build file not found: {norm}"));
    }
    fs::remove_file(&abs).map_err(|e| format!("Failed deleting build file: {e}"))?;

    let mut state = load_library_state_for_game(app_data_dir, Some(norm_game));
    if state
        .active_build_path
        .as_deref()
        .is_some_and(|a| a.eq_ignore_ascii_case(&norm))
    {
        let mut folders = Vec::new();
        let mut builds = Vec::new();
        collect_folders_and_builds(&root, "", &mut folders, &mut builds);
        state.active_build_path = pick_next_active_build_path(&builds);
        if let Some(ref p) = state.active_build_path {
            state.active_build_path_by_game.insert(norm_game.to_string(), p.clone());
        } else {
            state.active_build_path_by_game.remove(norm_game);
        }
        save_library_state_for_game(app_data_dir, Some(norm_game), &state)?;
    }
    Ok(state.active_build_path)
}

pub fn delete_build(app_data_dir: &Path, relative_path: &str) -> Result<Option<String>, String> {
    delete_build_for_game(app_data_dir, relative_path, Some("poe1"))
}

pub fn create_folder_for_game(
    app_data_dir: &Path,
    parent_folder: &str,
    folder_name: &str,
    game_id: Option<&str>,
) -> Result<String, String> {
    let root = ensure_builds_root_for_game(app_data_dir, game_id)?;
    let parent = normalize_relative_folder(parent_folder)?;
    let clean_name = sanitize_segment(folder_name)?;
    let rel = if parent.is_empty() {
        clean_name
    } else {
        format!("{parent}/{clean_name}")
    };
    let abs = relative_path_to_abs(&root, &rel);
    if abs.exists() {
        return Err("Folder already exists".to_string());
    }
    fs::create_dir_all(&abs).map_err(|e| format!("Failed creating folder: {e}"))?;
    Ok(rel)
}

pub fn create_folder(
    app_data_dir: &Path,
    parent_folder: &str,
    folder_name: &str,
) -> Result<String, String> {
    create_folder_for_game(app_data_dir, parent_folder, folder_name, Some("poe1"))
}

pub fn rename_folder_for_game(
    app_data_dir: &Path,
    old_folder: &str,
    new_name: &str,
    game_id: Option<&str>,
) -> Result<String, String> {
    let norm_game = normalize_game_id(game_id);
    let root = ensure_builds_root_for_game(app_data_dir, Some(norm_game))?;
    let old_norm = normalize_relative_folder(old_folder)?;
    if old_norm.is_empty() {
        return Err("Cannot rename root folder".to_string());
    }
    let clean_new = sanitize_segment(new_name)?;
    let parent = folder_of_relative_build_path(&old_norm);
    let new_norm = if parent.is_empty() {
        clean_new
    } else {
        format!("{parent}/{clean_new}")
    };
    if old_norm == new_norm {
        return Ok(new_norm);
    }

    let old_abs = relative_path_to_abs(&root, &old_norm);
    if !old_abs.is_dir() {
        return Err(format!("Folder not found: {old_norm}"));
    }
    let new_abs = relative_path_to_abs(&root, &new_norm);

    if old_norm.eq_ignore_ascii_case(&new_norm) {
        let tmp_abs = old_abs.with_file_name(format!(".__renaming_{}", std::process::id()));
        fs::rename(&old_abs, &tmp_abs).map_err(|e| format!("Failed preparing folder rename: {e}"))?;
        if let Err(err) = fs::rename(&tmp_abs, &new_abs) {
            let _ = fs::rename(&tmp_abs, &old_abs);
            return Err(format!("Failed finalizing folder rename: {err}"));
        }
    } else {
        if new_abs.exists() {
            return Err("A folder with that name already exists".to_string());
        }
        fs::rename(&old_abs, &new_abs).map_err(|e| format!("Failed renaming folder: {e}"))?;
    }

    let mut state = load_library_state_for_game(app_data_dir, Some(norm_game));
    let remapped = remap_active_path_after_folder_move(
        state.active_build_path.as_deref(),
        &old_norm,
        &new_norm,
    );
    if remapped != state.active_build_path {
        state.active_build_path = remapped.clone();
        if let Some(p) = remapped {
            state.active_build_path_by_game.insert(norm_game.to_string(), p);
        }
        save_library_state_for_game(app_data_dir, Some(norm_game), &state)?;
    }

    Ok(new_norm)
}

pub fn rename_folder(
    app_data_dir: &Path,
    old_folder: &str,
    new_name: &str,
) -> Result<String, String> {
    rename_folder_for_game(app_data_dir, old_folder, new_name, Some("poe1"))
}

pub fn delete_folder_for_game(
    app_data_dir: &Path,
    folder_path: &str,
    recursive: bool,
    game_id: Option<&str>,
) -> Result<Option<String>, String> {
    let norm_game = normalize_game_id(game_id);
    let root = ensure_builds_root_for_game(app_data_dir, Some(norm_game))?;
    let norm = normalize_relative_folder(folder_path)?;
    if norm.is_empty() {
        return Err("Cannot delete root folder".to_string());
    }
    let abs = relative_path_to_abs(&root, &norm);
    if !abs.is_dir() {
        return Err(format!("Folder not found: {norm}"));
    }

    let has_entries = fs::read_dir(&abs)
        .map_err(|e| format!("Failed inspecting folder: {e}"))?
        .next()
        .is_some();
    if has_entries && !recursive {
        return Err("Folder is not empty".to_string());
    }

    if recursive {
        fs::remove_dir_all(&abs).map_err(|e| format!("Failed deleting folder contents: {e}"))?;
    } else {
        fs::remove_dir(&abs).map_err(|e| format!("Failed deleting empty folder: {e}"))?;
    }

    let mut state = load_library_state_for_game(app_data_dir, Some(norm_game));
    if state
        .active_build_path
        .as_deref()
        .is_some_and(|a| is_path_inside_folder(a, &norm))
    {
        let mut folders = Vec::new();
        let mut builds = Vec::new();
        collect_folders_and_builds(&root, "", &mut folders, &mut builds);
        state.active_build_path = pick_next_active_build_path(&builds);
        if let Some(ref p) = state.active_build_path {
            state.active_build_path_by_game.insert(norm_game.to_string(), p.clone());
        } else {
            state.active_build_path_by_game.remove(norm_game);
        }
        save_library_state_for_game(app_data_dir, Some(norm_game), &state)?;
    }
    Ok(state.active_build_path)
}

pub fn delete_folder(
    app_data_dir: &Path,
    folder_path: &str,
    recursive: bool,
) -> Result<Option<String>, String> {
    delete_folder_for_game(app_data_dir, folder_path, recursive, Some("poe1"))
}
