use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

#[path = "features/system_tray/tray_icon_and_menu_controller.rs"]
mod tray_icon_and_menu_controller;

#[path = "features/client_log_watcher/client_txt_path_detector.rs"]
mod client_txt_path_detector;

#[path = "features/client_log_watcher/client_txt_byte_offset_tailer.rs"]
mod client_txt_byte_offset_tailer;

#[path = "features/process_monitor/poe_process_heartbeat.rs"]
mod poe_process_heartbeat;

#[path = "features/ggg_api_client/os_keychain_poesessid_store.rs"]
mod os_keychain_poesessid_store;

#[path = "features/ggg_api_client/character_window_http_poller.rs"]
mod character_window_http_poller;

#[path = "features/clipboard_bridge/windows_clipboard_writer.rs"]
mod windows_clipboard_writer;

use character_window_http_poller::{
    execute_character_window_fetch, now_epoch_ms, CharacterPollResponse, CircuitBreakerState,
};
use client_txt_byte_offset_tailer::ByteOffsetTailer;
use client_txt_path_detector::{detect_client_txt_path, ClientLogDetectionResult};

#[derive(Default)]
pub struct HostSharedState {
    pub tailer: Arc<Mutex<ByteOffsetTailer>>,
    pub circuit_breaker: Arc<Mutex<CircuitBreakerState>>,
}

#[tauri::command]
fn detect_client_log_path() -> ClientLogDetectionResult {
    detect_client_txt_path()
}

#[tauri::command]
fn set_client_log_path(path: String, state: State<'_, HostSharedState>) -> Result<bool, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        if let Ok(mut tailer) = state.tailer.lock() {
            tailer.set_path(None, true);
        }
        return Ok(false);
    }
    let candidate = PathBuf::from(trimmed);
    let exists = Path::new(&candidate).is_file();
    if let Ok(mut tailer) = state.tailer.lock() {
        tailer.set_path(Some(candidate), true);
    }
    Ok(exists)
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

fn spawn_background_watchers(app: &AppHandle, shared: &HostSharedState) {
    let log_app = app.clone();
    let tailer_ref = Arc::clone(&shared.tailer);
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(250));
        loop {
            interval.tick().await;
            let lines = match tailer_ref.lock() {
                Ok(mut guard) => guard.poll_new_lines().unwrap_or_default(),
                Err(_) => Vec::new(),
            };
            if !lines.is_empty() {
                let _ = log_app.emit("client-log-lines", lines);
            }
        }
    });

    let proc_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut last_state: Option<bool> = None;
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            let running = poe_process_heartbeat::is_poe_process_running();
            if last_state != Some(running) {
                last_state = Some(running);
                let _ = proc_app.emit("poe-process-state", running);
            }
        }
    });
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
            spawn_background_watchers(app.handle(), &state);
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
            check_poe_running,
            write_vendor_regex_clipboard,
            save_poesessid,
            has_poesessid,
            clear_poesessid,
            poll_character_window,
            set_tray_telemetry_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Exile Companion Control Center");
}
