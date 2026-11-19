use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::local_campaign_progress_disk_store::SavedCampaignProgressRecord;
use crate::local_pob_profile_disk_store::SavedPobSetSelection;

pub const BUILDS_DIR_NAME: &str = "builds";
pub const LIBRARY_STATE_FILE_NAME: &str = "build_library_state.json";
const MAX_SEGMENT_LEN: usize = 80;

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

fn default_schema_version() -> u32 {
    1
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

pub fn sanitize_segment(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("Invalid name segment".to_string());
    }
    if trimmed.ends_with('.') {
        return Err("Name cannot end with a dot".to_string());
    }
    if trimmed.chars().count() > MAX_SEGMENT_LEN {
        return Err(format!("Name exceeds {MAX_SEGMENT_LEN} characters"));
    }
    for ch in trimmed.chars() {
        if ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
            return Err(format!("Name contains unsupported character '{ch}'"));
        }
    }
    let stem = trimmed.split('.').next().unwrap_or(trimmed).to_ascii_uppercase();
    if WINDOWS_RESERVED_NAMES.contains(&stem.as_str()) {
        return Err(format!("'{trimmed}' is a reserved Windows filename"));
    }
    Ok(trimmed.to_string())
}

pub fn normalize_relative_folder(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.starts_with('/') || trimmed.starts_with('\\') || trimmed.contains(':') {
        return Err("Folder path must be relative".to_string());
    }
    let cleaned = trimmed.trim_end_matches(['/', '\\']);
    if cleaned.is_empty() {
        return Ok(String::new());
    }
    let mut parts = Vec::new();
    for part in cleaned.split(['/', '\\']) {
        parts.push(sanitize_segment(part)?);
    }
    Ok(parts.join("/"))
}

pub fn normalize_relative_build_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Build path cannot be empty".to_string());
    }
    if trimmed.starts_with('/') || trimmed.starts_with('\\') || trimmed.contains(':') {
        return Err("Build path must be relative".to_string());
    }
    let segments: Vec<&str> = trimmed.split(['/', '\\']).collect();
    let (file_seg, folder_segs) = segments
        .split_last()
        .ok_or_else(|| "Build path cannot be empty".to_string())?;
    if !file_seg.to_ascii_lowercase().ends_with(".json") {
        return Err("Build file must end with .json".to_string());
    }
    let stem = &file_seg[..file_seg.len() - 5];
    let clean_stem = sanitize_segment(stem)?;
    let mut parts = Vec::with_capacity(folder_segs.len() + 1);
    for seg in folder_segs {
        parts.push(sanitize_segment(seg)?);
    }
    parts.push(format!("{clean_stem}.json"));
    Ok(parts.join("/"))
}

pub fn build_relative_path(folder: &str, name: &str) -> Result<String, String> {
    let clean_folder = normalize_relative_folder(folder)?;
    let clean_name = sanitize_segment(name)?;
    if clean_folder.is_empty() {
        Ok(format!("{clean_name}.json"))
    } else {
        Ok(format!("{clean_folder}/{clean_name}.json"))
    }
}

pub fn relative_path_to_abs(builds_root: &Path, rel: &str) -> PathBuf {
    let mut out = builds_root.to_path_buf();
    if !rel.is_empty() {
        for seg in rel.split('/') {
            out.push(seg);
        }
    }
    out
}

pub fn folder_of_relative_build_path(rel: &str) -> String {
    match rel.rsplit_once('/') {
        Some((folder, _)) => folder.to_string(),
        None => String::new(),
    }
}

pub fn is_path_inside_folder(rel_build_path: &str, folder_path: &str) -> bool {
    if folder_path.is_empty() {
        return true;
    }
    let prefix = format!("{}/", folder_path.to_ascii_lowercase());
    rel_build_path.to_ascii_lowercase().starts_with(&prefix)
}

pub fn remap_active_path_after_folder_move(
    active: Option<&str>,
    old_folder: &str,
    new_folder: &str,
) -> Option<String> {
    let current = active?;
    if old_folder.is_empty() {
        return Some(current.to_string());
    }
    let old_prefix = format!("{}/", old_folder.to_ascii_lowercase());
    let current_lower = current.to_ascii_lowercase();
    if current_lower.starts_with(&old_prefix) {
        let suffix = &current[old_prefix.len()..];
        if new_folder.is_empty() {
            Some(suffix.to_string())
        } else {
            Some(format!("{new_folder}/{suffix}"))
        }
    } else {
        Some(current.to_string())
    }
}

pub fn entry_summary_from_record(
    relative_path: String,
    record: &SavedBuildFileRecord,
) -> BuildLibraryEntrySummary {
    BuildLibraryEntrySummary {
        folder_path: folder_of_relative_build_path(&relative_path),
        relative_path,
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
