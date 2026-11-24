use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

pub const BUILD_FINDER_WINDOW_LABEL: &str = "build-finder";
pub const MAIN_WINDOW_LABEL: &str = "main";
pub const BUILD_FINDER_OPENED_EVENT: &str = "build-finder:opened";
pub const BUILD_FINDER_SELECTED_EVENT: &str = "build-finder:selected";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildFinderOpenPayload {
    pub game_id: String,
    pub relay_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildFinderSelectionPayload {
    pub game_id: String,
    pub title: String,
    pub author: String,
    pub source: String,
    pub patch_version: String,
    pub pob_input: String,
    pub guide_url: String,
    pub league_start: bool,
}

/// Validates that an external guide URL is a safe `https://` URL without shell metacharacters.
pub fn validate_https_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return Err("Invalid external URL length.".to_string());
    }
    if !trimmed.starts_with("https://") {
        return Err("Only https:// guide URLs can be opened externally.".to_string());
    }
    let forbidden = ['"', '\'', '&', '|', '<', '>', ';', '`', '$', '\r', '\n'];
    if trimmed.chars().any(|c| c.is_whitespace() || c.is_control() || forbidden.contains(&c)) {
        return Err("External URL contains disallowed characters.".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn open_build_finder_window(
    app: AppHandle,
    game_id: String,
    relay_url: String,
) -> Result<(), String> {
    let win = app
        .get_webview_window(BUILD_FINDER_WINDOW_LABEL)
        .ok_or_else(|| "Build Finder window is not registered.".to_string())?;
    let payload = BuildFinderOpenPayload { game_id, relay_url };
    let _ = app.emit_to(BUILD_FINDER_WINDOW_LABEL, BUILD_FINDER_OPENED_EVENT, payload);
    let _ = win.unminimize();
    let _ = win.center();
    win.show().map_err(|e| format!("Failed to show Build Finder window: {e}"))?;
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
pub fn select_build_from_finder(
    app: AppHandle,
    payload: BuildFinderSelectionPayload,
) -> Result<(), String> {
    app.emit_to(MAIN_WINDOW_LABEL, BUILD_FINDER_SELECTED_EVENT, payload)
        .map_err(|e| format!("Failed to send selected build to main window: {e}"))?;
    if let Some(finder) = app.get_webview_window(BUILD_FINDER_WINDOW_LABEL) {
        let _ = finder.hide();
    }
    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn close_build_finder_window(app: AppHandle) -> Result<(), String> {
    if let Some(finder) = app.get_webview_window(BUILD_FINDER_WINDOW_LABEL) {
        finder
            .hide()
            .map_err(|e| format!("Failed to hide Build Finder window: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_external_guide_url(url: String) -> Result<(), String> {
    let safe_url = validate_https_url(&url)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&safe_url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = safe_url;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_https_url;

    #[test]
    fn validates_safe_https_urls_only() {
        assert!(validate_https_url("https://maxroll.gg/poe/build-guides/rf-chieftain").is_ok());
        assert!(validate_https_url("https://www.pathofexile.com/forum/view-thread/4016791").is_ok());
        assert!(validate_https_url("http://maxroll.gg/poe").is_err());
        assert!(validate_https_url("javascript:alert(1)").is_err());
        assert!(validate_https_url("file:///C:/Windows/win.ini").is_err());
        assert!(validate_https_url("https://example.com/?a=1&b=2").is_err());
    }
}
