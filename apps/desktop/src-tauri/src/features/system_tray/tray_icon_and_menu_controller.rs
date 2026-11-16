use std::sync::{Mutex, OnceLock};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::github_release_checker::{AppUpdatePhase, AppUpdateStateSnapshot};
use crate::tray_menu_labels::{
    default_standby_tooltip, format_update_menu_label, is_default_standby_tooltip, menu_labels,
    update_tooltip_suffix, TrayLocale,
};

pub const TRAY_ID: &str = "exile-tray";

const ICON_GRAY: &[u8] = include_bytes!("../../../icons/tray-gray.png");
const ICON_GREEN: &[u8] = include_bytes!("../../../icons/tray-green.png");
const ICON_AMBER: &[u8] = include_bytes!("../../../icons/tray-amber.png");
const ICON_GRAY_UPDATE: &[u8] = include_bytes!("../../../icons/tray-gray-update.png");
const ICON_GREEN_UPDATE: &[u8] = include_bytes!("../../../icons/tray-green-update.png");
const ICON_AMBER_UPDATE: &[u8] = include_bytes!("../../../icons/tray-amber-update.png");

struct TrayVisualState {
    locale: TrayLocale,
    status: String,
    tooltip: String,
    update_tag: Option<String>,
    update_phase: Option<AppUpdatePhase>,
    update_progress: Option<u8>,
    applied_menu_sig: String,
}

impl Default for TrayVisualState {
    fn default() -> Self {
        let locale = TrayLocale::default();
        Self {
            locale,
            status: "gray".to_string(),
            tooltip: default_standby_tooltip(locale).to_string(),
            update_tag: None,
            update_phase: None,
            update_progress: None,
            applied_menu_sig: format!("{}:none:false", locale.code()),
        }
    }
}

static TRAY_VISUAL_STATE: OnceLock<Mutex<TrayVisualState>> = OnceLock::new();

fn visual_state() -> &'static Mutex<TrayVisualState> {
    TRAY_VISUAL_STATE.get_or_init(|| Mutex::new(TrayVisualState::default()))
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn build_tray_menu(
    app: &AppHandle,
    locale: TrayLocale,
    update_label: Option<&str>,
    update_enabled: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    let labels = menu_labels(locale);
    let open_item =
        MenuItem::with_id(app, "open_control_center", labels.open_control_center, true, None::<&str>)?;
    let overlay_item =
        MenuItem::with_id(app, "toggle_overlay", labels.toggle_overlay, true, None::<&str>)?;
    let overlay_lock_item =
        MenuItem::with_id(app, "toggle_overlay_lock", labels.toggle_overlay_lock, true, None::<&str>)?;
    let sync_item =
        MenuItem::with_id(app, "force_sync", labels.force_sync, true, None::<&str>)?;
    let copy_item =
        MenuItem::with_id(app, "copy_regex", labels.copy_regex, true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;

    if let Some(label) = update_label {
        let update_item =
            MenuItem::with_id(app, "install_update", label, update_enabled, None::<&str>)?;
        let update_sep = PredefinedMenuItem::separator(app)?;
        Menu::with_items(
            app,
            &[
                &update_item,
                &update_sep,
                &open_item,
                &overlay_item,
                &overlay_lock_item,
                &sync_item,
                &copy_item,
                &sep,
                &quit_item,
            ],
        )
    } else {
        Menu::with_items(
            app,
            &[
                &open_item,
                &overlay_item,
                &overlay_lock_item,
                &sync_item,
                &copy_item,
                &sep,
                &quit_item,
            ],
        )
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let initial_locale = TrayLocale::default();
    let menu = build_tray_menu(app, initial_locale, None, false)?;
    let initial_icon = Image::from_bytes(ICON_GRAY)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(initial_icon)
        .tooltip(default_standby_tooltip(initial_locale))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "install_update" => {
                let _ = crate::auto_update_coordinator::trigger_update_install(app.clone());
            }
            "open_control_center" => show_main_window(app),
            "toggle_overlay" => {
                let handle = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let _ = crate::overlay_ipc_commands::toggle_overlay_enabled_from_backend(&handle);
                });
            }
            "toggle_overlay_lock" => {
                let handle = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let _ = crate::overlay_ipc_commands::toggle_overlay_lock_from_backend(&handle);
                });
            }
            "force_sync" => {
                let _ = app.emit("tray-action", "force-sync");
            }
            "copy_regex" => {
                let _ = app.emit("tray-action", "copy-regex");
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn select_tray_icon_bytes(status: &str, has_update: bool) -> &'static [u8] {
    match (status, has_update) {
        ("green", true) => ICON_GREEN_UPDATE,
        ("green", false) => ICON_GREEN,
        ("amber", true) => ICON_AMBER_UPDATE,
        ("amber", false) => ICON_AMBER,
        (_, true) => ICON_GRAY_UPDATE,
        (_, false) => ICON_GRAY,
    }
}

fn apply_tray_visual_state(app: &AppHandle, state: &mut TrayVisualState) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Tray icon handle not initialized".to_string())?;

    let has_update = state.update_tag.is_some();
    let icon = Image::from_bytes(select_tray_icon_bytes(&state.status, has_update))
        .map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;

    let combined_tooltip = if let Some(tag) = state.update_tag.as_deref() {
        format!("{}\n{}", state.tooltip, update_tooltip_suffix(state.locale, tag))
    } else {
        state.tooltip.clone()
    };
    tray.set_tooltip(Some(combined_tooltip))
        .map_err(|e| e.to_string())?;

    let resolved_update = match (state.update_tag.as_deref(), state.update_phase.as_ref()) {
        (Some(tag), Some(phase)) => Some(format_update_menu_label(
            state.locale,
            phase,
            tag,
            state.update_progress,
        )),
        _ => None,
    };
    let update_label = resolved_update.as_ref().map(|(l, _)| l.as_str());
    let update_enabled = resolved_update.as_ref().map(|(_, e)| *e).unwrap_or(false);

    let next_sig = format!(
        "{}:{}:{}",
        state.locale.code(),
        update_label.unwrap_or("none"),
        update_enabled
    );
    if next_sig != state.applied_menu_sig {
        let menu = build_tray_menu(app, state.locale, update_label, update_enabled)
            .map_err(|e| e.to_string())?;
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
        state.applied_menu_sig = next_sig;
    }

    Ok(())
}

pub fn update_tray_status(app: &AppHandle, status: &str, tooltip: &str) -> Result<(), String> {
    let mut guard = visual_state()
        .lock()
        .map_err(|_| "Tray visual state lock poisoned".to_string())?;
    guard.status = status.to_string();
    guard.tooltip = tooltip.to_string();
    apply_tray_visual_state(app, &mut guard)
}

pub fn set_tray_locale(app: &AppHandle, locale_str: &str) -> Result<(), String> {
    let mut guard = visual_state()
        .lock()
        .map_err(|_| "Tray visual state lock poisoned".to_string())?;
    let next_locale = TrayLocale::from_code(locale_str);
    if guard.locale == next_locale {
        return Ok(());
    }
    guard.locale = next_locale;
    if is_default_standby_tooltip(&guard.tooltip) {
        guard.tooltip = default_standby_tooltip(next_locale).to_string();
    }
    apply_tray_visual_state(app, &mut guard)
}

pub fn set_tray_update_state(
    app: &AppHandle,
    snapshot: &AppUpdateStateSnapshot,
) -> Result<(), String> {
    let mut guard = visual_state()
        .lock()
        .map_err(|_| "Tray visual state lock poisoned".to_string())?;

    if snapshot.update_available {
        let tag = snapshot
            .latest_version
            .as_deref()
            .unwrap_or("New Release");
        guard.update_tag = Some(tag.to_string());
        guard.update_phase = Some(snapshot.phase.clone());
        guard.update_progress = snapshot.progress_percent;
    } else {
        guard.update_tag = None;
        guard.update_phase = None;
        guard.update_progress = None;
    }

    apply_tray_visual_state(app, &mut guard)
}
