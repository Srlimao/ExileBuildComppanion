use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

#[path = "features/system_tray/tray_icon_and_menu_controller.rs"]
mod tray_icon_and_menu_controller;

#[path = "features/client_log_watcher/client_txt_path_detector.rs"]
mod client_txt_path_detector;

#[path = "features/client_log_watcher/client_txt_byte_offset_tailer.rs"]
pub(crate) mod client_txt_byte_offset_tailer;

#[path = "features/process_monitor/poe_process_heartbeat.rs"]
pub(crate) mod poe_process_heartbeat;

#[path = "features/ggg_api_client/os_keychain_poesessid_store.rs"]
mod os_keychain_poesessid_store;

#[path = "features/ggg_api_client/character_window_http_poller.rs"]
mod character_window_http_poller;

#[path = "features/clipboard_bridge/windows_clipboard_writer.rs"]
mod windows_clipboard_writer;

#[path = "features/pob_profile_store/local_pob_profile_disk_store.rs"]
mod local_pob_profile_disk_store;

#[path = "features/campaign_progress_store/local_campaign_progress_disk_store.rs"]
mod local_campaign_progress_disk_store;

#[path = "features/passive_tree_hotkey/foreground_poe_hotkey_poller.rs"]
pub(crate) mod foreground_poe_hotkey_poller;

mod background_telemetry_watchers;

use local_campaign_progress_disk_store::{
    load_campaign_progress_from_path, resolve_campaign_progress_file_path,
    save_campaign_progress_to_path, SavedCampaignProgressRecord,
};
use local_pob_profile_disk_store::{
    load_saved_pob_profile_from_path, resolve_profile_file_path, save_pob_profile_to_path,
    SavedPobProfileRecord,
};

use character_window_http_poller::{
    execute_character_window_fetch, now_epoch_ms, CharacterPollResponse, CircuitBreakerState,
};
use client_txt_byte_offset_tailer::{read_recent_bootstrap_lines, ByteOffsetTailer};
use client_txt_path_detector::{detect_client_txt_path, ClientLogDetectionResult};

#[derive(Default)]
pub struct HostSharedState {
    pub tailer: Arc<Mutex<ByteOffsetTailer>>,
    pub circuit_breaker: Arc<Mutex<CircuitBreakerState>>,
    pub manual_log_override: Arc<Mutex<bool>>,
    pub tree_hotkey_tracker: Arc<Mutex<foreground_poe_hotkey_poller::PassiveTreeHotkeyTracker>>,
}

#[tauri::command]
fn detect_client_log_path() -> ClientLogDetectionResult {
    detect_client_txt_path()
}

#[tauri::command]
fn set_client_log_path(
    path: String,
    manual: Option<bool>,
    state: State<'_, HostSharedState>,
) -> Result<bool, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        if let Ok(mut manual_flag) = state.manual_log_override.lock() {
            *manual_flag = false;
        }
        if let Ok(mut tailer) = state.tailer.lock() {
            tailer.set_path(None, true);
        }
        return Ok(false);
    }
    if let Ok(mut manual_flag) = state.manual_log_override.lock() {
        *manual_flag = manual.unwrap_or(false);
    }
    let candidate = PathBuf::from(trimmed);
    let exists = Path::new(&candidate).is_file();
    if let Ok(mut tailer) = state.tailer.lock() {
        tailer.set_path(Some(candidate), true);
    }
    Ok(exists)
}

#[tauri::command]
fn read_bootstrap_log_lines(state: State<'_, HostSharedState>) -> Vec<String> {
    let current_path = state
        .tailer
        .lock()
        .ok()
        .and_then(|guard| guard.current_path().cloned());
    let Some(path) = current_path else {
        return Vec::new();
    };
    let active_pid = poe_process_heartbeat::find_running_poe_process().map(|info| info.pid);
    read_recent_bootstrap_lines(&path, active_pid, 256 * 1024)
}

#[tauri::command]
fn check_poe_running() -> bool {
    poe_process_heartbeat::is_poe_process_running()
}

#[tauri::command]
fn write_vendor_regex_clipboard(regex: String) -> Result<(), String> {
    windows_clipboard_writer::write_text_to_clipboard(&regex)
}

#[tauri::command]
fn save_poesessid(value: String) -> Result<(), String> {
    os_keychain_poesessid_store::store_poesessid(&value)
}

#[tauri::command]
fn has_poesessid() -> bool {
    os_keychain_poesessid_store::has_stored_poesessid()
}

#[tauri::command]
fn clear_poesessid() -> Result<(), String> {
    os_keychain_poesessid_store::delete_poesessid()
}

#[tauri::command]
async fn poll_character_window(
    account_name: String,
    character_name: String,
    use_poesessid: bool,
    force: bool,
    state: State<'_, HostSharedState>,
) -> Result<CharacterPollResponse, String> {
    let now_ms = now_epoch_ms();
    if let Ok(guard) = state.circuit_breaker.lock() {
        if let Err(wait_ms) = guard.can_poll(now_ms, force) {
            return Ok(CharacterPollResponse {
                ok: false,
                status_code: 429,
                used_poesessid: false,
                throttled_ms: Some(wait_ms),
                error: Some(format!(
                    "Circuit breaker / cooldown active ({}s remaining)",
                    wait_ms.div_ceil(1000)
                )),
                items_json: None,
                passives_json: None,
            });
        }
    }

    let mut response = execute_character_window_fetch(&account_name, &character_name, use_poesessid).await;
    let after_ms = now_epoch_ms();

    if let Ok(mut guard) = state.circuit_breaker.lock() {
        if response.ok {
            guard.record_success(after_ms);
        } else if response.status_code == 429 || response.status_code >= 500 {
            let delay = guard.record_failure(after_ms, response.status_code);
            response.throttled_ms = Some(delay);
        }
    }

    Ok(response)
}

#[tauri::command]
fn set_tray_telemetry_status(app: AppHandle, status: String, tooltip: String) -> Result<(), String> {
    tray_icon_and_menu_controller::update_tray_status(&app, &status, &tooltip)
}

#[tauri::command]
fn set_passive_tree_hotkey(hotkey: String, state: State<'_, HostSharedState>) -> bool {
    state
        .tree_hotkey_tracker
        .lock()
        .map(|mut guard| guard.set_hotkey_label(&hotkey))
        .unwrap_or(false)
}

#[tauri::command]
fn set_in_game_tree_open(open: bool, app: AppHandle, state: State<'_, HostSharedState>) {
    if let Ok(mut guard) = state.tree_hotkey_tracker.lock() {
        if guard.set_tree_open(open) {
            let _ = app.emit("poe-passive-tree-state", open);
        }
    }
}

#[tauri::command]
fn get_pob_profile_storage_path(app: AppHandle) -> Result<String, String> {
    resolve_profile_file_path(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn load_saved_pob_profile(app: AppHandle) -> Result<Option<SavedPobProfileRecord>, String> {
    let path = resolve_profile_file_path(&app)?;
    load_saved_pob_profile_from_path(&path)
}

#[tauri::command]
fn save_pob_profile(app: AppHandle, profile: SavedPobProfileRecord) -> Result<String, String> {
    let path = resolve_profile_file_path(&app)?;
    save_pob_profile_to_path(&path, &profile)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_saved_campaign_progress(app: AppHandle) -> Result<Option<SavedCampaignProgressRecord>, String> {
    let path = resolve_campaign_progress_file_path(&app)?;
    load_campaign_progress_from_path(&path)
}

#[tauri::command]
fn save_campaign_progress(app: AppHandle, progress: SavedCampaignProgressRecord) -> Result<String, String> {
    let path = resolve_campaign_progress_file_path(&app)?;
    save_campaign_progress_to_path(&path, &progress)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_app_data_folder(app: AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed creating AppData folder: {e}"))?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed opening Explorer: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared = HostSharedState::default();
    if let Some(detected) = detect_client_txt_path().detected_path {
        if let Ok(mut guard) = shared.tailer.lock() {
            guard.set_path(Some(PathBuf::from(detected)), true);
        }
    }

    tauri::Builder::default()
        .manage(shared)
        .setup(|app| {
            tray_icon_and_menu_controller::setup_tray(app.handle())?;
            let state = app.state::<HostSharedState>();
            background_telemetry_watchers::spawn_background_watchers(app.handle(), &state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            detect_client_log_path,
            set_client_log_path,
            read_bootstrap_log_lines,
            check_poe_running,
            write_vendor_regex_clipboard,
            save_poesessid,
            has_poesessid,
            clear_poesessid,
            poll_character_window,
            set_tray_telemetry_status,
            get_pob_profile_storage_path,
            load_saved_pob_profile,
            save_pob_profile,
            load_saved_campaign_progress,
            save_campaign_progress,
            open_app_data_folder,
            set_passive_tree_hotkey,
            set_in_game_tree_open,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Exile Companion Control Center");
}
