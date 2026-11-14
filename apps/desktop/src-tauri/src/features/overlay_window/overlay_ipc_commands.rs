use tauri::{AppHandle, Manager, State};

use crate::overlay_config_disk_store::{
    is_valid_dock_preset, sanitize_overlay_config, OverlayBounds, SavedOverlayConfigRecord,
};
use crate::overlay_monitor_docking::{
    clamp_bounds_to_monitors, collect_monitor_work_rects, compute_dock_bounds,
    resolve_target_monitor_rect,
};
use crate::overlay_window_controller::{
    apply_window_bounds, ensure_overlay_window, persist_and_emit_overlay_config,
    resolve_overlay_poe_pid, sync_overlay_window_chrome, OverlaySharedState, OVERLAY_WINDOW_LABEL,
};

#[tauri::command]
pub fn get_overlay_config(state: State<'_, OverlaySharedState>) -> SavedOverlayConfigRecord {
    state
        .config
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

fn update_overlay_config_blocking(
    app: &AppHandle,
    config: SavedOverlayConfigRecord,
) -> Result<SavedOverlayConfigRecord, String> {
    let state = app.state::<OverlaySharedState>();
    let sanitized = sanitize_overlay_config(config);
    let was_enabled = state.config.lock().map(|g| g.enabled).unwrap_or(false);

    if let Ok(mut watcher) = state.watcher.lock() {
        watcher.sync_hotkeys(
            &sanitized.toggle_visibility_hotkey,
            &sanitized.toggle_lock_hotkey,
        );
    }
    if let Ok(mut guard) = state.config.lock() {
        *guard = sanitized.clone();
    }

    persist_and_emit_overlay_config(app, &sanitized)?;
    sync_overlay_window_chrome(app, &state, &sanitized, !was_enabled && sanitized.enabled)?;
    Ok(sanitized)
}

fn apply_overlay_dock_preset_blocking(
    app: &AppHandle,
    preset: String,
) -> Result<SavedOverlayConfigRecord, String> {
    if !is_valid_dock_preset(&preset) || preset == "free" {
        return Err(format!("Unsupported dock preset: {preset}"));
    }

    let state = app.state::<OverlaySharedState>();
    let poe_pid = resolve_overlay_poe_pid(&state, true);
    let monitor = resolve_target_monitor_rect(app, poe_pid);

    let updated = {
        let mut guard = state
            .config
            .lock()
            .map_err(|_| "Overlay config lock poisoned".to_string())?;
        let pref_size = guard.bounds.map(|b| (b.width, b.height));
        let computed = compute_dock_bounds(monitor, &preset, pref_size);
        guard.dock_preset = preset;
        guard.bounds = Some(computed);
        guard.clone()
    };

    persist_and_emit_overlay_config(app, &updated)?;
    if updated.enabled || app.get_webview_window(OVERLAY_WINDOW_LABEL).is_some() {
        let win = ensure_overlay_window(app, &state, &updated, poe_pid)?;
        if let Some(b) = updated.bounds {
            apply_window_bounds(&win, b);
        }
        sync_overlay_window_chrome(app, &state, &updated, false)?;
    }
    Ok(updated)
}

fn save_overlay_free_bounds_blocking(
    app: &AppHandle,
    bounds: Option<OverlayBounds>,
) -> Result<SavedOverlayConfigRecord, String> {
    let raw_bounds = match bounds {
        Some(b) => b,
        None => {
            let win = app
                .get_webview_window(OVERLAY_WINDOW_LABEL)
                .ok_or_else(|| "Overlay window is not initialized".to_string())?;
            let pos = win.outer_position().map_err(|e| e.to_string())?;
            let size = win.outer_size().map_err(|e| e.to_string())?;
            OverlayBounds {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
            }
        }
    };

    let state = app.state::<OverlaySharedState>();
    let monitors = collect_monitor_work_rects(app);
    let clamped = clamp_bounds_to_monitors(raw_bounds, &monitors);
    let updated = {
        let mut guard = state
            .config
            .lock()
            .map_err(|_| "Overlay config lock poisoned".to_string())?;
        guard.dock_preset = "free".to_string();
        guard.bounds = Some(clamped);
        guard.clone()
    };

    persist_and_emit_overlay_config(app, &updated)?;
    Ok(updated)
}

async fn run_blocking_ipc<F>(task: F) -> Result<SavedOverlayConfigRecord, String>
where
    F: FnOnce() -> Result<SavedOverlayConfigRecord, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("Overlay worker join failed: {e}"))?
}

#[tauri::command]
pub async fn update_overlay_config(
    app: AppHandle,
    config: SavedOverlayConfigRecord,
) -> Result<SavedOverlayConfigRecord, String> {
    run_blocking_ipc(move || update_overlay_config_blocking(&app, config)).await
}

#[tauri::command]
pub async fn apply_overlay_dock_preset(
    app: AppHandle,
    preset: String,
) -> Result<SavedOverlayConfigRecord, String> {
    run_blocking_ipc(move || apply_overlay_dock_preset_blocking(&app, preset)).await
}

#[tauri::command]
pub async fn save_overlay_free_bounds(
    app: AppHandle,
    bounds: Option<OverlayBounds>,
) -> Result<SavedOverlayConfigRecord, String> {
    run_blocking_ipc(move || save_overlay_free_bounds_blocking(&app, bounds)).await
}

#[tauri::command]
pub async fn toggle_overlay_visibility(app: AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    run_blocking_ipc(move || toggle_overlay_enabled_from_backend(&app)).await
}

#[tauri::command]
pub async fn toggle_overlay_click_through(app: AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    run_blocking_ipc(move || toggle_overlay_lock_from_backend(&app)).await
}

pub fn toggle_overlay_enabled_from_backend(app: &AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    let state = app.state::<OverlaySharedState>();
    let updated = {
        let mut guard = state
            .config
            .lock()
            .map_err(|_| "Overlay config lock poisoned".to_string())?;
        guard.enabled = !guard.enabled;
        guard.clone()
    };
    persist_and_emit_overlay_config(app, &updated)?;
    sync_overlay_window_chrome(app, &state, &updated, updated.enabled)?;
    Ok(updated)
}

pub fn toggle_overlay_lock_from_backend(app: &AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    let state = app.state::<OverlaySharedState>();
    let updated = {
        let mut guard = state
            .config
            .lock()
            .map_err(|_| "Overlay config lock poisoned".to_string())?;
        guard.click_through_locked = !guard.click_through_locked;
        guard.clone()
    };
    persist_and_emit_overlay_config(app, &updated)?;
    sync_overlay_window_chrome(app, &state, &updated, false)?;
    Ok(updated)
}
