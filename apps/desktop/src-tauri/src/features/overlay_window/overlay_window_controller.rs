use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::overlay_config_disk_store::{
    load_overlay_config_from_path, resolve_overlay_config_file_path, save_overlay_config_to_path,
    sanitize_overlay_config, OverlayBounds, SavedOverlayConfigRecord,
};
use crate::overlay_hotkey_and_focus_watcher::{
    foreground_focus_flags, read_hotkey_inputs, OverlayWatcherState,
};
use crate::overlay_monitor_docking::{
    clamp_bounds_to_monitors, collect_monitor_work_rects, compute_dock_bounds,
    resolve_target_monitor_rect,
};
use crate::poe_process_heartbeat::find_running_poe_process;

pub const OVERLAY_WINDOW_LABEL: &str = "overlay";
pub const OVERLAY_CONFIG_UPDATED_EVENT: &str = "overlay-config-updated";

pub struct OverlaySharedState {
    pub config: Mutex<SavedOverlayConfigRecord>,
    pub watcher: Mutex<OverlayWatcherState>,
    pub last_applied_visible: Mutex<Option<bool>>,
    pub window_lifecycle_lock: Mutex<()>,
    pub cached_poe_pid: AtomicU32,
}

impl OverlaySharedState {
    pub fn load_or_default(app: &AppHandle) -> Self {
        let cfg = resolve_overlay_config_file_path(app)
            .ok()
            .and_then(|p| load_overlay_config_from_path(&p).ok())
            .unwrap_or_default();
        let mut watcher = OverlayWatcherState::default();
        watcher.sync_hotkeys(&cfg.toggle_visibility_hotkey, &cfg.toggle_lock_hotkey);
        Self {
            config: Mutex::new(cfg),
            watcher: Mutex::new(watcher),
            last_applied_visible: Mutex::new(None),
            window_lifecycle_lock: Mutex::new(()),
            cached_poe_pid: AtomicU32::new(0),
        }
    }
}

pub fn persist_and_emit_overlay_config(app: &AppHandle, config: &SavedOverlayConfigRecord) -> Result<(), String> {
    let path = resolve_overlay_config_file_path(app)?;
    save_overlay_config_to_path(&path, config)?;
    let _ = app.emit(OVERLAY_CONFIG_UPDATED_EVENT, config.clone());
    Ok(())
}

pub fn apply_window_bounds(win: &WebviewWindow, bounds: OverlayBounds) {
    let _ = win.set_position(PhysicalPosition::new(bounds.x, bounds.y));
    let _ = win.set_size(PhysicalSize::new(bounds.width, bounds.height));
}

pub fn ensure_overlay_window(
    app: &AppHandle,
    state: &OverlaySharedState,
    config: &SavedOverlayConfigRecord,
    poe_pid: u32,
) -> Result<WebviewWindow, String> {
    let _lifecycle = state
        .window_lifecycle_lock
        .lock()
        .map_err(|_| "Overlay window lifecycle lock poisoned".to_string())?;
    if let Some(existing) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        return Ok(existing);
    }

    let bounds = resolve_initial_bounds(app, config, poe_pid);
    let win = WebviewWindowBuilder::new(
        app,
        OVERLAY_WINDOW_LABEL,
        WebviewUrl::App("index.html?window=overlay".into()),
    )
    .title("Exile Companion Overlay")
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(true)
    .focused(false)
    .visible(false)
    .min_inner_size(300.0, 240.0)
    .inner_size(bounds.width as f64, bounds.height as f64)
    .position(bounds.x as f64, bounds.y as f64)
    .build()
    .map_err(|e| format!("Failed creating overlay window: {e}"))?;

    apply_window_bounds(&win, bounds);
    let _ = win.set_always_on_top(true);
    let _ = win.set_ignore_cursor_events(config.click_through_locked);
    Ok(win)
}

pub fn resolve_initial_bounds(
    app: &AppHandle,
    config: &SavedOverlayConfigRecord,
    poe_pid: u32,
) -> OverlayBounds {
    let monitors = collect_monitor_work_rects(app);
    if config.dock_preset == "free" {
        if let Some(b) = config.bounds {
            return clamp_bounds_to_monitors(b, &monitors);
        }
    }
    let mon = resolve_target_monitor_rect(app, poe_pid);
    let pref = config.bounds.map(|b| (b.width, b.height));
    compute_dock_bounds(mon, &config.dock_preset, pref)
}

#[cfg(target_os = "windows")]
fn set_overlay_visible_no_activate(win: &WebviewWindow, visible: bool) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
    };

    if visible {
        // Call win.show() first so wry updates WebView2 ICoreWebView2Controller::put_IsVisible(TRUE).
        let _ = win.show();
        if let Ok(hwnd) = win.hwnd() {
            let raw = hwnd.0 as HWND;
            unsafe {
                SetWindowPos(
                    raw,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOMOVE | SWP_NOSIZE,
                );
            }
        }
    } else {
        let _ = win.hide();
    }
}

#[cfg(not(target_os = "windows"))]
fn set_overlay_visible_no_activate(win: &WebviewWindow, visible: bool) {
    if visible {
        let _ = win.show();
    } else {
        let _ = win.hide();
    }
}

pub fn resolve_overlay_poe_pid(state: &OverlaySharedState, refresh_if_zero: bool) -> u32 {
    let cached = state.cached_poe_pid.load(Ordering::Relaxed);
    if cached == 0 && refresh_if_zero {
        let pid = find_running_poe_process().map(|p| p.pid).unwrap_or(0);
        if pid != 0 {
            state.cached_poe_pid.store(pid, Ordering::Relaxed);
        }
        return pid;
    }
    cached
}

pub fn sync_overlay_window_chrome(
    app: &AppHandle,
    state: &OverlaySharedState,
    config: &SavedOverlayConfigRecord,
    reapply_bounds: bool,
) -> Result<(), String> {
    let poe_pid = resolve_overlay_poe_pid(state, reapply_bounds);
    let (fg_poe, fg_self) = foreground_focus_flags(poe_pid);
    let desired_visible =
        config.enabled && (config.pin_on_desktop || poe_pid == 0 || fg_poe || fg_self || reapply_bounds);

    if !config.enabled && app.get_webview_window(OVERLAY_WINDOW_LABEL).is_none() {
        if let Ok(mut vis) = state.last_applied_visible.lock() {
            *vis = Some(false);
        }
        return Ok(());
    }

    let win = ensure_overlay_window(app, state, config, poe_pid)?;
    let _ = win.set_always_on_top(true);
    let _ = win.set_ignore_cursor_events(config.click_through_locked);
    if reapply_bounds {
        let bounds = resolve_initial_bounds(app, config, poe_pid);
        apply_window_bounds(&win, bounds);
    }

    set_overlay_visible_no_activate(&win, desired_visible);
    if let Ok(mut vis) = state.last_applied_visible.lock() {
        *vis = Some(desired_visible);
    }
    Ok(())
}

/// Runs inside the 60 ms watcher loop to handle F7/F8 hotkeys and Alt-Tab auto-visibility.
pub fn poll_overlay_focus_and_hotkeys(app: &AppHandle, state: &OverlaySharedState, poe_pid: u32) {
    state.cached_poe_pid.store(poe_pid, Ordering::Relaxed);
    let (fg_poe, fg_self) = foreground_focus_flags(poe_pid);
    let (vis_vk, lock_vk) = state
        .watcher
        .lock()
        .map(|w| (w.vis_hotkey_vk(), w.lock_hotkey_vk()))
        .unwrap_or((None, None));
    let (vis_down, lock_down, mod_down) = read_hotkey_inputs(vis_vk, lock_vk);

    let (enabled, pin_on_desktop, locked) = match state.config.lock() {
        Ok(cfg) => (cfg.enabled, cfg.pin_on_desktop, cfg.click_through_locked),
        Err(_) => return,
    };

    let outcome = match state.watcher.lock() {
        Ok(mut w) => w.step(
            enabled,
            pin_on_desktop,
            locked,
            poe_pid != 0,
            fg_poe,
            fg_self,
            vis_down,
            lock_down,
            mod_down,
        ),
        Err(_) => return,
    };

    let mut updated_cfg: Option<SavedOverlayConfigRecord> = None;
    if outcome.toggled_enabled.is_some() || outcome.toggled_locked.is_some() {
        if let Ok(mut cfg) = state.config.lock() {
            if let Some(next_en) = outcome.toggled_enabled {
                cfg.enabled = next_en;
            }
            if let Some(next_lock) = outcome.toggled_locked {
                cfg.click_through_locked = next_lock;
            }
            *cfg = sanitize_overlay_config(cfg.clone());
            updated_cfg = Some(cfg.clone());
        }
    }

    if let Some(ref cfg) = updated_cfg {
        let _ = persist_and_emit_overlay_config(app, cfg);
        let _ = sync_overlay_window_chrome(app, state, cfg, outcome.toggled_enabled == Some(true));
        return;
    }

    let last_vis = state.last_applied_visible.lock().ok().and_then(|v| *v);
    if last_vis != Some(outcome.desired_visible) {
        if outcome.desired_visible || app.get_webview_window(OVERLAY_WINDOW_LABEL).is_some() {
            let cfg = state.config.lock().ok().map(|g| g.clone());
            if let Some(cfg) = cfg {
                if let Ok(win) = ensure_overlay_window(app, state, &cfg, poe_pid) {
                    let _ = win.set_ignore_cursor_events(cfg.click_through_locked);
                    set_overlay_visible_no_activate(&win, outcome.desired_visible);
                }
            }
        }
        if let Ok(mut vis) = state.last_applied_visible.lock() {
            *vis = Some(outcome.desired_visible);
        }
    }
}
