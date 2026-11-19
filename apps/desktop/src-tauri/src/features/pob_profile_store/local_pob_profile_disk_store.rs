use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const POB_PROFILE_FILE_NAME: &str = "saved_pob_profile.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedPobSetSelection {
    #[serde(default)]
    pub passive_spec_ids: Vec<String>,
    #[serde(default)]
    pub skill_set_ids: Vec<String>,
    #[serde(default)]
    pub item_set_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedPobProfileRecord {
    pub raw_input: String,
    #[serde(default)]
    pub cached_xml: Option<String>,
    pub league_start: bool,
    #[serde(default)]
    pub custom_route_text: String,
    #[serde(default)]
    pub selection: Option<SavedPobSetSelection>,
    pub updated_at_ms: u64,
}

/// Resolves the shared local AppData file path for saved PoB profiles.
pub fn resolve_profile_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))?;
    Ok(dir.join(POB_PROFILE_FILE_NAME))
}

/// Reads and deserializes the saved PoB profile from disk, returning None if absent.
pub fn load_saved_pob_profile_from_path(
    path: &Path,
) -> Result<Option<SavedPobProfileRecord>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed reading PoB save file: {e}"))?;
    if content.trim().is_empty() {
        return Ok(None);
    }
    let record = serde_json::from_str::<SavedPobProfileRecord>(&content)
        .map_err(|e| format!("Invalid saved PoB JSON: {e}"))?;
    Ok(Some(record))
}

/// Persists a PoB profile record safely using a temp file rename in AppData.
pub fn save_pob_profile_to_path(
    path: &Path,
    record: &SavedPobProfileRecord,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed creating AppData directory: {e}"))?;
    }
    let serialized = serde_json::to_string_pretty(record)
        .map_err(|e| format!("Failed serializing PoB profile: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &serialized).map_err(|e| format!("Failed writing temp PoB file: {e}"))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed finalizing PoB save file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn saves_overwrites_and_loads_pob_profile_record() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("nested").join(POB_PROFILE_FILE_NAME);

        assert_eq!(load_saved_pob_profile_from_path(&path).unwrap(), None);

        let first = SavedPobProfileRecord {
            raw_input: "https://pobb.in/abc123".to_string(),
            cached_xml: Some("<PathOfBuilding/>".to_string()),
            league_start: true,
            custom_route_text: String::new(),
            selection: Some(SavedPobSetSelection {
                passive_spec_ids: vec!["spec_1".to_string()],
                skill_set_ids: vec!["1".to_string()],
                item_set_ids: vec!["1".to_string()],
            }),
            updated_at_ms: 1000,
        };
        save_pob_profile_to_path(&path, &first).unwrap();
        assert_eq!(load_saved_pob_profile_from_path(&path).unwrap(), Some(first));

        let updated = SavedPobProfileRecord {
            raw_input: "eNrt...".to_string(),
            cached_xml: None,
            league_start: false,
            custom_route_text: "custom".to_string(),
            selection: None,
            updated_at_ms: 2000,
        };
        save_pob_profile_to_path(&path, &updated).unwrap();
        assert_eq!(
            load_saved_pob_profile_from_path(&path).unwrap(),
            Some(updated)
        );
    }
}
