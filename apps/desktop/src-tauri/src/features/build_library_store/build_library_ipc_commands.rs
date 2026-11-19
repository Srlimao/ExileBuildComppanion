use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::build_library_store::build_library_disk_ops::{
    ensure_builds_root, load_build_file as load_build_op, save_build_file as save_build_op,
    set_active_build_path as set_active_op, update_build_progress as update_progress_op,
};
use crate::build_library_store::build_library_migration_and_listing::list_build_library as list_library_op;
use crate::build_library_store::build_library_folder_ops::{
    create_folder as create_folder_op, delete_build as delete_build_op,
    delete_folder as delete_folder_op, duplicate_build as duplicate_build_op,
    rename_folder as rename_folder_op, rename_or_move_build as rename_or_move_build_op,
};
use crate::build_library_store::build_library_types::{
    BuildLibraryEntrySummary, BuildLibraryListing, BuildProgressPatch, SavedBuildFileRecord,
};

fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))
}

#[tauri::command]
pub fn list_build_library(app: AppHandle) -> Result<BuildLibraryListing, String> {
    let dir = resolve_app_data_dir(&app)?;
    list_library_op(&dir)
}

#[tauri::command]
pub fn load_build_file(
    app: AppHandle,
    relative_path: String,
) -> Result<SavedBuildFileRecord, String> {
    let dir = resolve_app_data_dir(&app)?;
    load_build_op(&dir, &relative_path)
}

#[tauri::command]
pub fn save_build_file(
    app: AppHandle,
    folder_path: String,
    record: SavedBuildFileRecord,
    overwrite_path: Option<String>,
    set_active: bool,
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    save_build_op(&dir, &folder_path, record, overwrite_path.as_deref(), set_active)
}

#[tauri::command]
pub fn update_build_progress(
    app: AppHandle,
    relative_path: String,
    patch: BuildProgressPatch,
) -> Result<(), String> {
    let dir = resolve_app_data_dir(&app)?;
    update_progress_op(&dir, &relative_path, patch)
}

#[tauri::command]
pub fn rename_or_move_build(
    app: AppHandle,
    from_path: String,
    target_folder: String,
    new_name: String,
    now_ms: u64,
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    rename_or_move_build_op(&dir, &from_path, &target_folder, &new_name, now_ms)
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
) -> Result<BuildLibraryEntrySummary, String> {
    let dir = resolve_app_data_dir(&app)?;
    duplicate_build_op(
        &dir,
        &source_path,
        &target_folder,
        &new_name,
        copy_progress,
        new_id,
        now_ms,
    )
}

#[tauri::command]
pub fn delete_build(app: AppHandle, relative_path: String) -> Result<Option<String>, String> {
    let dir = resolve_app_data_dir(&app)?;
    delete_build_op(&dir, &relative_path)
}

#[tauri::command]
pub fn create_build_folder(
    app: AppHandle,
    parent_folder: String,
    folder_name: String,
) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    create_folder_op(&dir, &parent_folder, &folder_name)
}

#[tauri::command]
pub fn rename_build_folder(
    app: AppHandle,
    old_folder: String,
    new_name: String,
) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    rename_folder_op(&dir, &old_folder, &new_name)
}

#[tauri::command]
pub fn delete_build_folder(
    app: AppHandle,
    folder_path: String,
    recursive: bool,
) -> Result<Option<String>, String> {
    let dir = resolve_app_data_dir(&app)?;
    delete_folder_op(&dir, &folder_path, recursive)
}

#[tauri::command]
pub fn set_active_build_path(
    app: AppHandle,
    relative_path: Option<String>,
) -> Result<(), String> {
    let dir = resolve_app_data_dir(&app)?;
    set_active_op(&dir, relative_path.as_deref())
}

#[tauri::command]
pub fn open_builds_library_folder(app: AppHandle) -> Result<String, String> {
    let dir = resolve_app_data_dir(&app)?;
    let root = ensure_builds_root(&dir)?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&root)
        .spawn()
        .map_err(|e| format!("Failed opening Explorer: {e}"))?;
    Ok(root.to_string_lossy().to_string())
}
