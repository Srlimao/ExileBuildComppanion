use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::client_txt_byte_offset_tailer::read_recent_bootstrap_lines;
use crate::foreground_poe_hotkey_poller::poll_foreground_poe_hotkey;
use crate::overlay_window_controller::{poll_overlay_focus_and_hotkeys, OverlaySharedState};
use crate::poe_process_heartbeat::find_running_poe_process;
use crate::HostSharedState;

/// Spawns async Client.txt tailing, PoE process monitoring, and foreground hotkey observation.
pub fn spawn_background_watchers(app: &AppHandle, shared: &HostSharedState) {
    let active_pid = Arc::new(AtomicU32::new(
        find_running_poe_process().map(|p| p.pid).unwrap_or(0),
    ));
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
    let proc_pid = Arc::clone(&active_pid);
    let hotkey_tracker_reset = Arc::clone(&shared.tree_hotkey_tracker);
    let tailer_switch_ref = Arc::clone(&shared.tailer);
    let manual_override_ref = Arc::clone(&shared.manual_log_override);
    tauri::async_runtime::spawn(async move {
        let mut last_state: Option<bool> = None;
        let mut interval = tokio::time::interval(Duration::from_secs(3));
        loop {
            interval.tick().await;
            let proc_info = find_running_poe_process();
            proc_pid.store(proc_info.as_ref().map(|p| p.pid).unwrap_or(0), Ordering::Relaxed);
            let running = proc_info.is_some();
            if last_state != Some(running) {
                last_state = Some(running);
                if !running {
                    if let Ok(mut guard) = hotkey_tracker_reset.lock() {
                        if guard.set_tree_open(false) {
                            let _ = proc_app.emit("poe-passive-tree-state", false);
                        }
                    }
                }
                let _ = proc_app.emit("poe-process-state", running);
            }
            let is_manual = manual_override_ref
                .lock()
                .map(|flag| *flag)
                .unwrap_or(false);
            if !is_manual {
                if let Some(info) = proc_info {
                    if let Some(active_log) = info
                        .exe_path
                        .as_deref()
                        .and_then(|exe| exe.parent())
                        .map(|dir| dir.join("logs").join("Client.txt"))
                    {
                        if active_log.is_file() {
                            let switched = if let Ok(mut guard) = tailer_switch_ref.lock() {
                                if guard.current_path() != Some(&active_log) {
                                    guard.set_path(Some(active_log.clone()), true);
                                    true
                                } else {
                                    false
                                }
                            } else {
                                false
                            };
                            if switched {
                                let _ = proc_app.emit(
                                    "client-log-path-changed",
                                    active_log.to_string_lossy().to_string(),
                                );
                                let boot = read_recent_bootstrap_lines(
                                    &active_log,
                                    Some(info.pid),
                                    256 * 1024,
                                );
                                if !boot.is_empty() {
                                    let _ = proc_app.emit("client-log-lines", boot);
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    let hotkey_app = app.clone();
    let hotkey_pid = Arc::clone(&active_pid);
    let hotkey_tracker = Arc::clone(&shared.tree_hotkey_tracker);
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(60));
        loop {
            interval.tick().await;
            let pid = hotkey_pid.load(Ordering::Relaxed);
            if let Some(open) = poll_foreground_poe_hotkey(&hotkey_tracker, pid) {
                let _ = hotkey_app.emit("poe-passive-tree-state", open);
            }
            let overlay_state = hotkey_app.state::<OverlaySharedState>();
            poll_overlay_focus_and_hotkeys(&hotkey_app, &overlay_state, pid);
        }
    });
}
