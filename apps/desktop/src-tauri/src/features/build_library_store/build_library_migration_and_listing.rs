use std::fs;
use std::path::Path;

use crate::build_library_store::build_library_disk_ops::{
    ensure_builds_root, load_library_state, save_build_file, save_library_state,
};
use crate::build_library_store::build_library_types::{
    entry_summary_from_record, sanitize_segment, BuildLibraryEntrySummary, BuildLibraryListing,
    BuildProgressSummary, SavedBuildFileRecord, LIBRARY_STATE_FILE_NAME,
};
use crate::local_campaign_progress_disk_store::{
    load_campaign_progress_from_path, CAMPAIGN_PROGRESS_FILE_NAME,
};
use crate::local_pob_profile_disk_store::{
    load_saved_pob_profile_from_path, POB_PROFILE_FILE_NAME,
};

fn has_any_json_file(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && has_any_json_file(&path) {
            return true;
        }
        if path.is_file()
            && path
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
        {
            return true;
        }
    }
    false
}

fn extract_xml_build_name(xml: Option<&str>) -> String {
    let Some(raw) = xml else {
        return "Migrated Build".to_string();
    };
    let Some(idx) = raw.find("buildName=\"") else {
        return "Migrated Build".to_string();
    };
    let rest = &raw[idx + "buildName=\"".len()..];
    let Some(end) = rest.find('"') else {
        return "Migrated Build".to_string();
    };
    let decoded = rest[..end].replace("&amp;", "&").replace("&quot;", "\"");
    sanitize_segment(&decoded).unwrap_or_else(|_| "Migrated Build".to_string())
}

pub fn migrate_legacy_profile_if_needed(app_data_dir: &Path) -> Result<Option<String>, String> {
    let state_path = app_data_dir.join(LIBRARY_STATE_FILE_NAME);
    if state_path.exists() {
        return Ok(None);
    }
    let root = ensure_builds_root(app_data_dir)?;
    if has_any_json_file(&root) {
        return Ok(None);
    }

    let legacy_pob_path = app_data_dir.join(POB_PROFILE_FILE_NAME);
    let Ok(Some(legacy_pob)) = load_saved_pob_profile_from_path(&legacy_pob_path) else {
        return Ok(None);
    };
    let progress = load_campaign_progress_from_path(&app_data_dir.join(CAMPAIGN_PROGRESS_FILE_NAME))
        .ok()
        .flatten()
        .unwrap_or_default();

    let name = extract_xml_build_name(legacy_pob.cached_xml.as_deref());
    let summary = BuildProgressSummary {
        completed_checkpoints: progress.completed_checkpoint_ids.len() as u32,
        completed_gems: (progress.manual_completed_gem_ids.len()
            + progress.soft_acquired_gem_ids.len()) as u32,
        ..Default::default()
    };
    let record = SavedBuildFileRecord {
        schema_version: 1,
        id: "migrated-legacy-build".to_string(),
        name,
        notes: String::new(),
        raw_input: legacy_pob.raw_input,
        cached_xml: legacy_pob.cached_xml,
        league_start: legacy_pob.league_start,
        custom_route_text: legacy_pob.custom_route_text,
        selection: legacy_pob.selection,
        character_name: String::new(),
        selected_league: String::new(),
        summary,
        progress,
        run_elapsed_ms: 0,
        act_splits_ms: Default::default(),
        created_at_ms: legacy_pob.updated_at_ms,
        updated_at_ms: legacy_pob.updated_at_ms,
    };

    let saved = save_build_file(app_data_dir, "", record, None, true)?;
    Ok(Some(saved.relative_path))
}

pub(crate) fn collect_folders_and_builds(
    dir: &Path,
    rel_prefix: &str,
    folders: &mut Vec<String>,
    builds: &mut Vec<BuildLibraryEntrySummary>,
) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if rel_prefix.is_empty() {
            name.clone()
        } else {
            format!("{rel_prefix}/{name}")
        };
        if path.is_dir() {
            folders.push(rel.clone());
            collect_folders_and_builds(&path, &rel, folders, builds);
        } else if path.is_file()
            && name.to_ascii_lowercase().ends_with(".json")
            && !name.to_ascii_lowercase().ends_with(".tmp")
        {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(record) = serde_json::from_str::<SavedBuildFileRecord>(&content) {
                    builds.push(entry_summary_from_record(rel, &record));
                }
            }
        }
    }
}

pub(crate) fn pick_next_active_build_path(builds: &[BuildLibraryEntrySummary]) -> Option<String> {
    builds
        .iter()
        .max_by_key(|b| b.updated_at_ms)
        .map(|b| b.relative_path.clone())
}

pub fn list_build_library(app_data_dir: &Path) -> Result<BuildLibraryListing, String> {
    let root = ensure_builds_root(app_data_dir)?;
    let _ = migrate_legacy_profile_if_needed(app_data_dir)?;

    let mut folders = Vec::new();
    let mut builds = Vec::new();
    collect_folders_and_builds(&root, "", &mut folders, &mut builds);
    folders.sort_by_key(|a| a.to_ascii_lowercase());
    builds.sort_by(|a, b| b.updated_at_ms.cmp(&a.updated_at_ms));

    let mut state = load_library_state(app_data_dir);
    let resolved_active = state
        .active_build_path
        .as_deref()
        .and_then(|active| {
            builds
                .iter()
                .find(|b| b.relative_path.eq_ignore_ascii_case(active))
                .map(|b| b.relative_path.clone())
        })
        .or_else(|| pick_next_active_build_path(&builds));

    if state.active_build_path != resolved_active {
        state.active_build_path = resolved_active.clone();
        let _ = save_library_state(app_data_dir, &state);
    }

    Ok(BuildLibraryListing {
        root_dir: root.to_string_lossy().to_string(),
        active_build_path: resolved_active,
        folders,
        builds,
    })
}

#[cfg(test)]
#[path = "build_library_tests.rs"]
mod tests;
