use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, WindowEvent};

#[path = "features/system_tray/tray_icon_and_menu_controller.rs"]
pub(crate) mod tray_icon_and_menu_controller;

#[path = "features/client_log_watcher/client_txt_path_detector.rs"]
pub(crate) mod client_txt_path_detector;

#[path = "features/client_log_watcher/client_txt_byte_offset_tailer.rs"]
pub(crate) mod client_txt_byte_offset_tailer;

#[path = "features/process_monitor/poe_process_heartbeat.rs"]
pub(crate) mod poe_process_heartbeat;

#[path = "features/ggg_api_client/os_keychain_poesessid_store.rs"]
pub(crate) mod os_keychain_poesessid_store;

#[path = "features/ggg_api_client/character_window_http_poller.rs"]
pub(crate) mod character_window_http_poller;

#[path = "features/clipboard_bridge/windows_clipboard_writer.rs"]
pub(crate) mod windows_clipboard_writer;

#[path = "features/pob_profile_store/local_pob_profile_disk_store.rs"]
pub(crate) mod local_pob_profile_disk_store;

#[path = "features/campaign_progress_store/local_campaign_progress_disk_store.rs"]
pub(crate) mod local_campaign_progress_disk_store;

#[path = "features/passive_tree_hotkey/foreground_poe_hotkey_poller.rs"]
pub(crate) mod foreground_poe_hotkey_poller;

#[path = "features/auto_updater/github_release_checker.rs"]
pub(crate) mod github_release_checker;

#[path = "features/auto_updater/release_asset_downloader.rs"]
pub(crate) mod release_asset_downloader;

#[path = "features/auto_updater/windows_self_update_installer.rs"]
pub(crate) mod windows_self_update_installer;

#[path = "features/auto_updater/auto_update_coordinator.rs"]
pub(crate) mod auto_update_coordinator;

#[path = "features/overlay_window/overlay_config_disk_store.rs"]
pub(crate) mod overlay_config_disk_store;

#[path = "features/overlay_window/overlay_monitor_docking.rs"]
pub(crate) mod overlay_monitor_docking;

#[path = "features/overlay_window/overlay_hotkey_and_focus_watcher.rs"]
pub(crate) mod overlay_hotkey_and_focus_watcher;

#[path = "features/overlay_window/overlay_window_controller.rs"]
pub(crate) mod overlay_window_controller;

#[path = "features/overlay_window/overlay_ipc_commands.rs"]
pub(crate) mod overlay_ipc_commands;

mod background_telemetry_watchers;
mod tauri_host_ipc_commands;

use character_window_http_poller::CircuitBreakerState;
use client_txt_byte_offset_tailer::ByteOffsetTailer;
use client_txt_path_detector::detect_client_txt_path;

#[derive(Default)]
pub struct HostSharedState {
    pub tailer: Arc<Mutex<ByteOffsetTailer>>,
    pub circuit_breaker: Arc<Mutex<CircuitBreakerState>>,
    pub manual_log_override: Arc<Mutex<bool>>,
    pub tree_hotkey_tracker: Arc<Mutex<foreground_poe_hotkey_poller::PassiveTreeHotkeyTracker>>,
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
        .manage(auto_update_coordinator::AutoUpdaterSharedState::new())
        .setup(|app| {
            app.manage(overlay_window_controller::OverlaySharedState::load_or_default(app.handle()));
            tray_icon_and_menu_controller::setup_tray(app.handle())?;
            let state = app.state::<HostSharedState>();
            background_telemetry_watchers::spawn_background_watchers(app.handle(), &state);
            auto_update_coordinator::spawn_auto_update_watcher(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                if window.label() == overlay_window_controller::OVERLAY_WINDOW_LABEL {
                    let app = window.app_handle();
                    let state = app.state::<overlay_window_controller::OverlaySharedState>();
                    if let Ok(mut cfg) = state.config.lock() {
                        cfg.enabled = false;
                        let _ = overlay_window_controller::persist_and_emit_overlay_config(app, &cfg);
                    }
                    if let Ok(mut vis) = state.last_applied_visible.lock() {
                        *vis = Some(false);
                    };
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            tauri_host_ipc_commands::detect_client_log_path,
            tauri_host_ipc_commands::set_client_log_path,
            tauri_host_ipc_commands::read_bootstrap_log_lines,
            tauri_host_ipc_commands::check_poe_running,
            tauri_host_ipc_commands::write_vendor_regex_clipboard,
            tauri_host_ipc_commands::save_poesessid,
            tauri_host_ipc_commands::has_poesessid,
            tauri_host_ipc_commands::clear_poesessid,
            tauri_host_ipc_commands::poll_character_window,
            tauri_host_ipc_commands::set_tray_telemetry_status,
            tauri_host_ipc_commands::get_pob_profile_storage_path,
            tauri_host_ipc_commands::load_saved_pob_profile,
            tauri_host_ipc_commands::save_pob_profile,
            tauri_host_ipc_commands::load_saved_campaign_progress,
            tauri_host_ipc_commands::save_campaign_progress,
            tauri_host_ipc_commands::open_app_data_folder,
            tauri_host_ipc_commands::set_passive_tree_hotkey,
            tauri_host_ipc_commands::set_in_game_tree_open,
            overlay_ipc_commands::get_overlay_config,
            overlay_ipc_commands::update_overlay_config,
            overlay_ipc_commands::apply_overlay_dock_preset,
            overlay_ipc_commands::save_overlay_free_bounds,
            overlay_ipc_commands::toggle_overlay_visibility,
            overlay_ipc_commands::toggle_overlay_click_through,
            auto_update_coordinator::get_app_update_state,
            auto_update_coordinator::check_for_app_update,
            auto_update_coordinator::install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Exile Companion Control Center");
}
