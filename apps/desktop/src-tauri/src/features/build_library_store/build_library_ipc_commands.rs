use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::build_library_store::build_library_disk_ops::{
    ensure_builds_root_for_game, load_build_file_for_game, save_build_file_for_game,
    set_active_build_path_for_game, update_build_progress_for_game,
};
use crate::build_library_store::build_library_folder_ops::{
    create_folder_for_game, delete_build_for_game, delete_folder_for_game,
    duplicate_build_for_game, rename_folder_for_game, rename_or_move_build_for_game,
};
use crate::build_library_store::build_library_migration_and_listing::list_build_library_for_game;
use crate::build_library_store::build_library_types::{
    BuildLibraryEntrySummary, BuildLibraryListing, BuildProgressPatch, SavedBuildFileRecord,
};

fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))
}

#[tauri::command]
pub fn list_build_library(
    app: AppHandle,
    game_id: Option<String>,
) -> Result<BuildLibraryListing, String> {
    let dir = resolve_app_data_dir(&app)?;
    list_build_library_for_game(&dir, game_id.as_deref())
}

#[tauri::command]
pub fn load_build_file(
    app: AppHandle,
    relative_path: String,
    game_id: Option<String>,
) -> Result<SavedBuildFileRecord, String> {
    let dir = resolve_app_data_dir(&app)?;
    load_build_file_for_game(&dir, &relative_path, game_id.as_deref())
}

#[tauri::command]
pub fn save_build_file(
    app: AppHandle,
    folder_path: String,
    record: SavedBuildFileRecord,
    overwrite_path: Option<String>,
    set_active: bool,
    game_id: Option<String>,
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    save_build_file_for_game(
        &dir,
        &folder_path,
        record,
        overwrite_path.as_deref(),
        set_active,
        game_id.as_deref(),
    )
}

#[tauri::command]
pub fn update_build_progress(
    app: AppHandle,
    relative_path: String,
    patch: BuildProgressPatch,
    game_id: Option<String>,
) -> Result<(), String> {
    let dir = resolve_app_data_dir(&app)?;
    update_build_progress_for_game(&dir, &relative_path, patch, game_id.as_deref())
}

#[tauri::command]
pub fn rename_or_move_build(
    app: AppHandle,
    from_path: String,
    target_folder: String,
    new_name: String,
    now_ms: u64,
    game_id: Option<String>,
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    rename_or_move_build_for_game(
        &dir,
        &from_path,
        &target_folder,
        &new_name,
        now_ms,
        game_id.as_deref(),
    )
}

#[tauri::command]
pub fn duplicate_build(
    app: AppHandle,
    source_path: String,
    target_folder: String,
    new_name: String,
    copy_progress: bool,
    new_id: String,
    now_ms: u64,
    game_id: Option<String>,
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    duplicate_build_for_game(
        &dir,
        &source_path,
        &target_folder,
        &new_name,
        copy_progress,
        new_id,
        now_ms,
        game_id.as_deref(),
    )
}

#[tauri::command]
pub fn delete_build(
    app: AppHandle,
    relative_path: String,
    game_id: Option<String>,
) -> Result<Option<String>, String> {
    let dir = resolve_app_data_dir(&app)?;
    delete_build_for_game(&dir, &relative_path, game_id.as_deref())
}

#[tauri::command]
pub fn create_build_folder(
    app: AppHandle,
    parent_folder: String,
    folder_name: String,
    game_id: Option<String>,
) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    create_folder_for_game(&dir, &parent_folder, &folder_name, game_id.as_deref())
}

#[tauri::command]
pub fn rename_build_folder(
    app: AppHandle,
    old_folder: String,
    new_name: String,
    game_id: Option<String>,
) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    rename_folder_for_game(&dir, &old_folder, &new_name, game_id.as_deref())
}

#[tauri::command]
pub fn delete_build_folder(
    app: AppHandle,
    folder_path: String,
    recursive: bool,
    game_id: Option<String>,
) -> Result<Option<String>, String> {
    let dir = resolve_app_data_dir(&app)?;
    delete_folder_for_game(&dir, &folder_path, recursive, game_id.as_deref())
}

#[tauri::command]
pub fn set_active_build_path(
    app: AppHandle,
    relative_path: Option<String>,
    game_id: Option<String>,
) -> Result<(), String> {
    let dir = resolve_app_data_dir(&app)?;
    set_active_build_path_for_game(&dir, relative_path.as_deref(), game_id.as_deref())
}

#[tauri::command]
pub fn open_builds_library_folder(
    app: AppHandle,
    game_id: Option<String>,
) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    let root = ensure_builds_root_for_game(&dir, game_id.as_deref())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&root)
        .spawn()
        .map_err(|e| format!("Failed opening Explorer: {e}"))?;
    Ok(root.to_string_lossy().to_string())
}
