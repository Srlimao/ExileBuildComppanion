use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const CAMPAIGN_PROGRESS_FILE_NAME: &str = "saved_campaign_progress.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedCampaignProgressRecord {
    #[serde(default)]
    pub completed_checkpoint_ids: Vec<String>,
    #[serde(default)]
    pub soft_completed_checkpoint_ids: Vec<String>,
    #[serde(default)]
    pub manual_completed_gem_ids: Vec<String>,
    #[serde(default)]
    pub soft_acquired_gem_ids: Vec<String>,
    #[serde(default)]
    pub visited_area_ids: Vec<String>,
    #[serde(default)]
    pub cleared_area_ids: Vec<String>,
    #[serde(default)]
    pub was_explicitly_reset: bool,
    #[serde(default)]
    pub updated_at_ms: u64,
}

/// Resolves the shared local AppData file path for persisted checklist and gem progress.
pub fn resolve_campaign_progress_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve AppData directory: {e}"))?;
    Ok(dir.join(CAMPAIGN_PROGRESS_FILE_NAME))
}

/// Reads and deserializes saved checklist & gem progress from disk, returning None if absent.
pub fn load_campaign_progress_from_path(
    path: &Path,
) -> Result<Option<SavedCampaignProgressRecord>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed reading progress file: {e}"))?;
    if content.trim().is_empty() {
        return Ok(None);
    }
    let record = serde_json::from_str::<SavedCampaignProgressRecord>(&content)
        .map_err(|e| format!("Invalid saved progress JSON: {e}"))?;
    Ok(Some(record))
}

/// Persists checklist & gem progress atomically using a temp file rename in AppData.
pub fn save_campaign_progress_to_path(
    path: &Path,
    record: &SavedCampaignProgressRecord,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed creating AppData directory: {e}"))?;
    }
    let serialized = serde_json::to_string_pretty(record)
        .map_err(|e| format!("Failed serializing campaign progress: {e}"))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &serialized)
        .map_err(|e| format!("Failed writing temp progress file: {e}"))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed finalizing progress file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn saves_overwrites_and_resets_campaign_progress_record() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("nested").join(CAMPAIGN_PROGRESS_FILE_NAME);

        assert_eq!(load_campaign_progress_from_path(&path).unwrap(), None);

        let initial = SavedCampaignProgressRecord {
            completed_checkpoint_ids: vec!["1|1_1_1|MANDATORY_PATH||Kill Hillock#1".to_string()],
            soft_completed_checkpoint_ids: vec!["1|1_1_3|SKILL_BOOK||Dweller#1".to_string()],
            manual_completed_gem_ids: vec!["gem_a1q1_GemFrostblink".to_string()],
            soft_acquired_gem_ids: vec![],
            visited_area_ids: vec!["1_1_1".to_string(), "1_1_town".to_string()],
            cleared_area_ids: vec!["1_1_1".to_string()],
            was_explicitly_reset: false,
            updated_at_ms: 1000,
        };
        save_campaign_progress_to_path(&path, &initial).unwrap();
        assert_eq!(
            load_campaign_progress_from_path(&path).unwrap(),
            Some(initial)
        );

        let reset = SavedCampaignProgressRecord {
            completed_checkpoint_ids: vec![],
            soft_completed_checkpoint_ids: vec![],
            manual_completed_gem_ids: vec![],
            soft_acquired_gem_ids: vec![],
            visited_area_ids: vec![],
            cleared_area_ids: vec![],
            was_explicitly_reset: true,
            updated_at_ms: 2000,
        };
        save_campaign_progress_to_path(&path, &reset).unwrap();
        assert_eq!(
            load_campaign_progress_from_path(&path).unwrap(),
            Some(reset)
        );

        // Legacy JSON missing visitedAreaIds / clearedAreaIds still deserializes cleanly.
        let legacy_json = r#"{"completedCheckpointIds":["1|1_1_1|MANDATORY_PATH||Kill Hillock#1"],"softCompletedCheckpointIds":[],"manualCompletedGemIds":[],"softAcquiredGemIds":[],"wasExplicitlyReset":false,"updatedAtMs":3000}"#;
        std::fs::write(&path, legacy_json).unwrap();
        let legacy_loaded = load_campaign_progress_from_path(&path).unwrap().unwrap();
        assert!(legacy_loaded.visited_area_ids.is_empty());
        assert!(legacy_loaded.cleared_area_ids.is_empty());
    }
}
