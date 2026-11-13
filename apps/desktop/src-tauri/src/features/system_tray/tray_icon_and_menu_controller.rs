use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub const TRAY_ID: &str = "exile-tray";

const ICON_GRAY: &[u8] = include_bytes!("../../../icons/tray-gray.png");
const ICON_GREEN: &[u8] = include_bytes!("../../../icons/tray-green.png");
const ICON_AMBER: &[u8] = include_bytes!("../../../icons/tray-amber.png");

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open_control_center", "Open Control Center", true, None::<&str>)?;
    let sync_item = MenuItem::with_id(app, "force_sync", "Force Character Sync", true, None::<&str>)?;
    let copy_item = MenuItem::with_id(app, "copy_regex", "Copy Active Vendor Regex", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Exile Companion", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_item, &sync_item, &copy_item, &sep, &quit_item])?;
    let initial_icon = Image::from_bytes(ICON_GRAY)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(initial_icon)
        .tooltip("Exile Companion HUD — Standby")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
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

pub fn update_tray_status<R: Runtime>(app: &AppHandle<R>, status: &str, tooltip: &str) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Tray icon handle not initialized".to_string())?;

    let bytes = match status {
        "green" => ICON_GREEN,
        "amber" => ICON_AMBER,
        _ => ICON_GRAY,
    };

    let icon = Image::from_bytes(bytes).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
    Ok(())
}
