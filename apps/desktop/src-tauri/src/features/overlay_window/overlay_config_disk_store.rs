use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const OVERLAY_CONFIG_FILE_NAME: &str = "saved_overlay_config.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedOverlayConfigRecord {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub click_through_locked: bool,
    #[serde(default = "default_pin_on_desktop")]
    pub pin_on_desktop: bool,
    #[serde(default = "default_opacity_percent")]
    pub opacity_percent: u8,
    #[serde(default = "default_dock_preset")]
    pub dock_preset: String,
    #[serde(default)]
    pub bounds: Option<OverlayBounds>,
    #[serde(default = "default_visibility_hotkey")]
    pub toggle_visibility_hotkey: String,
    #[serde(default = "default_lock_hotkey")]
    pub toggle_lock_hotkey: String,
    #[serde(default = "default_mode_layouts")]
    pub mode_layouts: serde_json::Value,
    #[serde(default)]
    pub updated_at_ms: u64,
}

fn default_pin_on_desktop() -> bool {
    true
}

fn default_opacity_percent() -> u8 {
    88
}

fn default_dock_preset() -> String {
    "top-left".to_string()
}

fn default_visibility_hotkey() -> String {
    "F7".to_string()
}

fn default_lock_hotkey() -> String {
    "F8".to_string()
}

fn default_mode_layouts() -> serde_json::Value {
    serde_json::json!({})
}

impl Default for SavedOverlayConfigRecord {
    fn default() -> Self {
        Self {
            enabled: false,
            click_through_locked: false,
            pin_on_desktop: default_pin_on_desktop(),
            opacity_percent: default_opacity_percent(),
            dock_preset: default_dock_preset(),
            bounds: None,
            toggle_visibility_hotkey: default_visibility_hotkey(),
            toggle_lock_hotkey: default_lock_hotkey(),
            mode_layouts: default_mode_layouts(),
            updated_at_ms: 0,
        }
    }
}

pub fn is_valid_dock_preset(preset: &str) -> bool {
    matches!(
        preset,
        "top-left" | "top-right" | "bottom-left" | "bottom-right" | "left-edge" | "right-edge" | "free"
    )
}

/// Normalizes opacity, dock preset, and modeLayouts shape before use or persistence.
pub fn sanitize_overlay_config(mut cfg: SavedOverlayConfigRecord) -> SavedOverlayConfigRecord {
    cfg.opacity_percent = cfg.opacity_percent.clamp(35, 100);
    if !is_valid_dock_preset(&cfg.dock_preset) {
        cfg.dock_preset = default_dock_preset();
    }
    if !cfg.mode_layouts.is_object() {
        cfg.mode_layouts = default_mode_layouts();
    }
    if cfg.toggle_visibility_hotkey.trim().is_empty() {
        cfg.toggle_visibility_hotkey = "OFF".to_string();
    }
    if cfg.toggle_lock_hotkey.trim().is_empty() {
        cfg.toggle_lock_hotkey = "OFF".to_string();
    }
    cfg
}

/// Resolves the local AppData file path for PC overlay settings and isolated widget layouts.
pub fn resolve_overlay_config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))?;
    Ok(dir.join(OVERLAY_CONFIG_FILE_NAME))
}

/// Loads saved PC overlay config from disk, returning defaults if missing.
pub fn load_overlay_config_from_path(path: &Path) -> Result<SavedOverlayConfigRecord, String> {
    if !path.exists() {
        return Ok(SavedOverlayConfigRecord::default());
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed reading overlay config: {e}"))?;
    if content.trim().is_empty() {
        return Ok(SavedOverlayConfigRecord::default());
    }
    let parsed = serde_json::from_str::<SavedOverlayConfigRecord>(&content)
        .map_err(|e| format!("Invalid overlay config JSON: {e}"))?;
    Ok(sanitize_overlay_config(parsed))
}

/// Atomically persists PC overlay config via a temp file rename in local AppData.
pub fn save_overlay_config_to_path(
    path: &Path,
    record: &SavedOverlayConfigRecord,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed creating AppData directory: {e}"))?;
    }
    let sanitized = sanitize_overlay_config(record.clone());
    let serialized = serde_json::to_string_pretty(&sanitized)
        .map_err(|e| format!("Failed serializing overlay config: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &serialized)
        .map_err(|e| format!("Failed writing temp overlay config: {e}"))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed finalizing overlay config file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn loads_defaults_saves_and_sanitizes_overlay_config() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("nested").join(OVERLAY_CONFIG_FILE_NAME);

        let initial = load_overlay_config_from_path(&path).unwrap();
        assert_eq!(initial, SavedOverlayConfigRecord::default());
        assert!(!initial.enabled);
        assert!(initial.pin_on_desktop);
        assert_eq!(initial.toggle_visibility_hotkey, "F7");
        assert_eq!(initial.toggle_lock_hotkey, "F8");

        let custom = SavedOverlayConfigRecord {
            enabled: true,
            click_through_locked: true,
            pin_on_desktop: true,
            opacity_percent: 12,
            dock_preset: "invalid-slot".to_string(),
            bounds: Some(OverlayBounds { x: 40, y: 60, width: 420, height: 600 }),
            toggle_visibility_hotkey: "F9".to_string(),
            toggle_lock_hotkey: "F10".to_string(),
            mode_layouts: serde_json::json!({
                "FIELD": [{ "widgetId": "active_checklist", "colSpan": 1, "rowSpan": 2, "order": 0 }]
            }),
            updated_at_ms: 12345,
        };
        save_overlay_config_to_path(&path, &custom).unwrap();
        let reloaded = load_overlay_config_from_path(&path).unwrap();
        assert_eq!(reloaded.opacity_percent, 35);
        assert_eq!(reloaded.dock_preset, "top-left");
        assert!(reloaded.enabled);
        assert!(reloaded.click_through_locked);
        assert!(reloaded.pin_on_desktop);
        assert_eq!(reloaded.bounds, custom.bounds);
        assert_eq!(reloaded.mode_layouts["FIELD"][0]["widgetId"], "active_checklist");
    }
}
