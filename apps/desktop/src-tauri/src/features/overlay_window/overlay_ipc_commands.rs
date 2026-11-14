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
    sync_overlay_window_chrome, OverlaySharedState, OVERLAY_WINDOW_LABEL,
};
use crate::poe_process_heartbeat::find_running_poe_process;

#[tauri::command]
pub fn get_overlay_config(state: State<'_, OverlaySharedState>) -> SavedOverlayConfigRecord {
    state
        .config
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn update_overlay_config(
    app: AppHandle,
    config: SavedOverlayConfigRecord,
    state: State<'_, OverlaySharedState>,
) -> Result<SavedOverlayConfigRecord, String> {
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

    persist_and_emit_overlay_config(&app, &sanitized)?;
    sync_overlay_window_chrome(
        &app,
        &state,
        &sanitized,
        !was_enabled && sanitized.enabled,
    )?;
    Ok(sanitized)
}

#[tauri::command]
pub fn apply_overlay_dock_preset(
    app: AppHandle,
    preset: String,
    state: State<'_, OverlaySharedState>,
) -> Result<SavedOverlayConfigRecord, String> {
    if !is_valid_dock_preset(&preset) || preset == "free" {
        return Err(format!("Unsupported dock preset: {preset}"));
    }

    let poe_pid = find_running_poe_process().map(|p| p.pid).unwrap_or(0);
    let monitor = resolve_target_monitor_rect(&app, poe_pid);

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

    persist_and_emit_overlay_config(&app, &updated)?;
    if updated.enabled || app.get_webview_window(OVERLAY_WINDOW_LABEL).is_some() {
        let win = ensure_overlay_window(&app, &updated, poe_pid)?;
        if let Some(b) = updated.bounds {
            apply_window_bounds(&win, b);
        }
    }
    Ok(updated)
}

#[tauri::command]
pub fn save_overlay_free_bounds(
    app: AppHandle,
    bounds: Option<OverlayBounds>,
    state: State<'_, OverlaySharedState>,
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

    let monitors = collect_monitor_work_rects(&app);
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

    persist_and_emit_overlay_config(&app, &updated)?;
    Ok(updated)
}

#[tauri::command]
pub fn toggle_overlay_visibility(app: AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    toggle_overlay_enabled_from_backend(&app)
}

#[tauri::command]
pub fn toggle_overlay_click_through(app: AppHandle) -> Result<SavedOverlayConfigRecord, String> {
    toggle_overlay_lock_from_backend(&app)
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
