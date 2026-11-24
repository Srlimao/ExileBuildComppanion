use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::local_campaign_progress_disk_store::SavedCampaignProgressRecord;
use crate::local_pob_profile_disk_store::SavedPobSetSelection;

pub use crate::build_library_store::build_library_path_rules::{
    build_relative_path, folder_of_relative_build_path, is_path_inside_folder,
    library_builds_dir_name, library_state_file_name, normalize_game_id,
    normalize_relative_build_path, normalize_relative_folder, relative_path_to_abs,
    remap_active_path_after_folder_move, sanitize_segment, LIBRARY_STATE_FILE_NAME,
};

#[cfg(test)]
pub use crate::build_library_store::build_library_path_rules::BUILDS_DIR_NAME;

fn default_schema_version() -> u32 {
    1
}

fn default_game_id() -> String {
    "poe1".to_string()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildProgressSummary {
    #[serde(default)]
    pub character_class: String,
    #[serde(default)]
    pub ascendancy_name: String,
    #[serde(default)]
    pub build_level: u32,
    #[serde(default)]
    pub completed_checkpoints: u32,
    #[serde(default)]
    pub total_checkpoints: u32,
    #[serde(default)]
    pub completed_gems: u32,
    #[serde(default)]
    pub total_gems: u32,
    #[serde(default)]
    pub current_act: u32,
    #[serde(default)]
    pub current_area_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedBuildFileRecord {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default = "default_game_id")]
    pub game_id: String,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub notes: String,
    pub raw_input: String,
    #[serde(default)]
    pub cached_xml: Option<String>,
    pub league_start: bool,
    #[serde(default)]
    pub custom_route_text: String,
    #[serde(default)]
    pub selection: Option<SavedPobSetSelection>,
    #[serde(default)]
    pub character_name: String,
    #[serde(default)]
    pub selected_league: String,
    #[serde(default)]
    pub summary: BuildProgressSummary,
    #[serde(default)]
    pub progress: SavedCampaignProgressRecord,
    #[serde(default)]
    pub run_elapsed_ms: u64,
    #[serde(default)]
    pub act_splits_ms: BTreeMap<String, u64>,
    #[serde(default)]
    pub created_at_ms: u64,
    #[serde(default)]
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildLibraryEntrySummary {
    pub relative_path: String,
    pub folder_path: String,
    pub game_id: String,
    pub id: String,
    pub name: String,
    pub notes: String,
    pub league_start: bool,
    pub character_name: String,
    pub selected_league: String,
    pub summary: BuildProgressSummary,
    pub run_elapsed_ms: u64,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildLibraryListing {
    pub root_dir: String,
    pub active_build_path: Option<String>,
    pub folders: Vec<String>,
    pub builds: Vec<BuildLibraryEntrySummary>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildLibraryStateFile {
    #[serde(default)]
    pub active_build_path: Option<String>,
    #[serde(default)]
    pub active_build_path_by_game: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildProgressPatch {
    #[serde(default)]
    pub progress: Option<SavedCampaignProgressRecord>,
    #[serde(default)]
    pub summary: Option<BuildProgressSummary>,
    #[serde(default)]
    pub run_elapsed_ms: Option<u64>,
    #[serde(default)]
    pub act_splits_ms: Option<BTreeMap<String, u64>>,
    #[serde(default)]
    pub character_name: Option<String>,
    #[serde(default)]
    pub selected_league: Option<String>,
    pub updated_at_ms: u64,
}

pub fn entry_summary_from_record(
    relative_path: String,
    record: &SavedBuildFileRecord,
) -> BuildLibraryEntrySummary {
    BuildLibraryEntrySummary {
        folder_path: folder_of_relative_build_path(&relative_path),
        relative_path,
        game_id: normalize_game_id(Some(&record.game_id)).to_string(),
        id: record.id.clone(),
        name: record.name.clone(),
        notes: record.notes.clone(),
        league_start: record.league_start,
        character_name: record.character_name.clone(),
        selected_league: record.selected_league.clone(),
        summary: record.summary.clone(),
        run_elapsed_ms: record.run_elapsed_ms,
        created_at_ms: record.created_at_ms,
        updated_at_ms: record.updated_at_ms,
    }
}
