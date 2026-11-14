use std::sync::{Mutex, OnceLock};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::github_release_checker::{AppUpdatePhase, AppUpdateStateSnapshot};

pub const TRAY_ID: &str = "exile-tray";

const ICON_GRAY: &[u8] = include_bytes!("../../../icons/tray-gray.png");
const ICON_GREEN: &[u8] = include_bytes!("../../../icons/tray-green.png");
const ICON_AMBER: &[u8] = include_bytes!("../../../icons/tray-amber.png");
const ICON_GRAY_UPDATE: &[u8] = include_bytes!("../../../icons/tray-gray-update.png");
const ICON_GREEN_UPDATE: &[u8] = include_bytes!("../../../icons/tray-green-update.png");
const ICON_AMBER_UPDATE: &[u8] = include_bytes!("../../../icons/tray-amber-update.png");

struct TrayVisualState {
    status: String,
    tooltip: String,
    update_tag: Option<String>,
    update_menu_label: Option<String>,
    update_menu_enabled: bool,
    applied_menu_sig: String,
}

impl Default for TrayVisualState {
    fn default() -> Self {
        Self {
            status: "gray".to_string(),
            tooltip: "Exile Companion HUD — Standby".to_string(),
            update_tag: None,
            update_menu_label: None,
            update_menu_enabled: false,
            applied_menu_sig: "none:false".to_string(),
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
    update_label: Option<&str>,
    update_enabled: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    let open_item =
        MenuItem::with_id(app, "open_control_center", "Open Control Center", true, None::<&str>)?;
    let sync_item =
        MenuItem::with_id(app, "force_sync", "Force Character Sync", true, None::<&str>)?;
    let copy_item =
        MenuItem::with_id(app, "copy_regex", "Copy Active Vendor Regex", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Exile Companion", true, None::<&str>)?;

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
                &sync_item,
                &copy_item,
                &sep,
                &quit_item,
            ],
        )
    } else {
        Menu::with_items(app, &[&open_item, &sync_item, &copy_item, &sep, &quit_item])
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_tray_menu(app, None, false)?;
    let initial_icon = Image::from_bytes(ICON_GRAY)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(initial_icon)
        .tooltip("Exile Companion HUD — Standby")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "install_update" => {
                let _ = crate::auto_update_coordinator::trigger_update_install(app.clone());
            }
            "open_control_center" => show_main_window(app),
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
        format!("{}\n[Update {tag} Available]", state.tooltip)
    } else {
        state.tooltip.clone()
    };
    tray.set_tooltip(Some(combined_tooltip))
        .map_err(|e| e.to_string())?;

    let next_sig = format!(
        "{}:{}",
        state.update_menu_label.as_deref().unwrap_or("none"),
        state.update_menu_enabled
    );
    if next_sig != state.applied_menu_sig {
        let menu = build_tray_menu(
            app,
            state.update_menu_label.as_deref(),
            state.update_menu_enabled,
        )
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
        let (label, enabled) = match snapshot.phase {
            AppUpdatePhase::Downloading => (
                Some(format!(
                    "Downloading {tag} ({}%)...",
                    snapshot.progress_percent.unwrap_or(0)
                )),
                false,
            ),
            AppUpdatePhase::Installing => (Some(format!("Installing {tag}...")), false),
            _ => (Some(format!("Update to {tag} & Restart")), true),
        };
        guard.update_menu_label = label;
        guard.update_menu_enabled = enabled;
    } else {
        guard.update_tag = None;
        guard.update_menu_label = None;
        guard.update_menu_enabled = false;
    }

    apply_tray_visual_state(app, &mut guard)
}
