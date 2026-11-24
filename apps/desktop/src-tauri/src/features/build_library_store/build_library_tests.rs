use std::collections::BTreeMap;
use std::fs;
use tempfile::tempdir;

use super::*;
use crate::build_library_store::build_library_disk_ops::{
    load_build_file, save_build_file, save_build_file_for_game, update_build_progress,
};
use crate::build_library_store::build_library_folder_ops::{
    create_folder, create_folder_for_game, delete_build, delete_folder, duplicate_build,
    rename_folder, rename_or_move_build,
};
use crate::build_library_store::build_library_types::{
    normalize_relative_build_path, normalize_relative_folder, sanitize_segment, BuildProgressPatch,
    BuildProgressSummary, SavedBuildFileRecord, BUILDS_DIR_NAME, LIBRARY_STATE_FILE_NAME,
};
use crate::local_campaign_progress_disk_store::{
    save_campaign_progress_to_path, SavedCampaignProgressRecord, CAMPAIGN_PROGRESS_FILE_NAME,
};
use crate::local_pob_profile_disk_store::{
    save_pob_profile_to_path, SavedPobProfileRecord, SavedPobSetSelection, POB_PROFILE_FILE_NAME,
};

fn sample_record(id: &str, name: &str, updated_at_ms: u64) -> SavedBuildFileRecord {
    SavedBuildFileRecord {
        schema_version: 1,
        game_id: "poe1".to_string(),
        id: id.to_string(),
        name: name.to_string(),
        notes: "Test note".to_string(),
        raw_input: "https://pobb.in/abc123".to_string(),
        cached_xml: Some("<PathOfBuilding/>".to_string()),
        league_start: true,
        custom_route_text: String::new(),
        selection: Some(SavedPobSetSelection::default()),
        character_name: "MyRunner".to_string(),
        selected_league: "Mercenaries".to_string(),
        summary: BuildProgressSummary {
            character_class: "Witch".to_string(),
            ascendancy_name: "Elementalist".to_string(),
            build_level: 42,
            completed_checkpoints: 3,
            total_checkpoints: 50,
            completed_gems: 2,
            total_gems: 10,
            current_act: 2,
            current_area_name: "The Forest Encampment".to_string(),
        },
        progress: SavedCampaignProgressRecord {
            completed_checkpoint_ids: vec!["1|1_1_1|MANDATORY_PATH||Kill Hillock#1".to_string()],
            updated_at_ms,
            ..Default::default()
        },
        run_elapsed_ms: 120_000,
        act_splits_ms: BTreeMap::from([("1".to_string(), 95_000)]),
        created_at_ms: 1000,
        updated_at_ms,
    }
}

#[test]
fn rejects_path_traversal_and_reserved_windows_names() {
    assert!(sanitize_segment("..").is_err());
    assert!(sanitize_segment(".").is_err());
    assert!(sanitize_segment("CON").is_err());
    assert!(sanitize_segment("aux.txt").is_err());
    assert!(sanitize_segment("foo/bar").is_err());
    assert!(sanitize_segment("bad:name").is_err());
    assert!(sanitize_segment("trail.").is_err());
    assert!(normalize_relative_folder("../outside").is_err());
    assert!(normalize_relative_folder("/rooted").is_err());
    assert!(normalize_relative_folder("C:/temp").is_err());
    assert!(normalize_relative_build_path("../secret.json").is_err());
    assert!(normalize_relative_build_path("not_json.txt").is_err());
    assert_eq!(
        normalize_relative_folder("3.26 Starters\\RF/").unwrap(),
        "3.26 Starters/RF"
    );
}

#[test]
fn manages_folders_collision_dedup_case_rename_and_independent_progress() {
    let dir = tempdir().expect("tempdir");
    let app_data = dir.path();

    let f1 = create_folder(app_data, "", "3.26 Starters").unwrap();
    let f2 = create_folder(app_data, &f1, "Witch").unwrap();
    assert_eq!(f2, "3.26 Starters/Witch");

    let saved1 = save_build_file(app_data, &f2, sample_record("id1", "RF Ele", 1000), None, true).unwrap();
    assert_eq!(saved1.relative_path, "3.26 Starters/Witch/RF Ele.json");

    // Duplicate name in same folder auto-deduplicates with (2)
    let saved2 = save_build_file(app_data, &f2, sample_record("id2", "RF Ele", 2000), None, false).unwrap();
    assert_eq!(saved2.relative_path, "3.26 Starters/Witch/RF Ele (2).json");
    assert_eq!(saved2.name, "RF Ele (2)");

    // Updating progress on build 2 leaves build 1 untouched ("one save, one progression")
    update_build_progress(
        app_data,
        &saved2.relative_path,
        BuildProgressPatch {
            progress: Some(SavedCampaignProgressRecord {
                completed_checkpoint_ids: vec!["2|1_2_1|MANDATORY_PATH||Act 2#1".to_string()],
                updated_at_ms: 3000,
                ..Default::default()
            }),
            character_name: Some("SecondChar".to_string()),
            run_elapsed_ms: Some(45_000),
            updated_at_ms: 3000,
            ..Default::default()
        },
    )
    .unwrap();

    let loaded1 = load_build_file(app_data, &saved1.relative_path).unwrap();
    let loaded2 = load_build_file(app_data, &saved2.relative_path).unwrap();
    assert_eq!(loaded1.character_name, "MyRunner");
    assert_eq!(loaded1.run_elapsed_ms, 120_000);
    assert_eq!(loaded2.character_name, "SecondChar");
    assert_eq!(loaded2.run_elapsed_ms, 45_000);

    // Case-only rename on Windows preserves the file without deleting it
    let renamed = rename_or_move_build(
        app_data,
        &saved1.relative_path,
        &f2,
        "rf ele",
        4000,
    )
    .unwrap();
    assert_eq!(renamed.relative_path, "3.26 Starters/Witch/rf ele.json");
    assert!(load_build_file(app_data, &renamed.relative_path).is_ok());

    // Rename folder updates active_build_path
    let renamed_folder = rename_folder(app_data, "3.26 Starters", "League 3.26").unwrap();
    assert_eq!(renamed_folder, "League 3.26");
    let listing = list_build_library(app_data).unwrap();
    assert_eq!(
        listing.active_build_path.as_deref(),
        Some("League 3.26/Witch/rf ele.json")
    );

    // Duplicate resets progression when copy_progress is false
    let dup = duplicate_build(
        app_data,
        "League 3.26/Witch/rf ele.json",
        "",
        "Fresh Run",
        false,
        "id3".to_string(),
        5000,
    )
    .unwrap();
    let dup_loaded = load_build_file(app_data, &dup.relative_path).unwrap();
    assert_eq!(dup_loaded.run_elapsed_ms, 0);
    assert!(dup_loaded.character_name.is_empty());
    assert!(dup_loaded.progress.completed_checkpoint_ids.is_empty());

    // Deleting active build selects most recently updated remaining build
    let next_active = delete_build(app_data, "League 3.26/Witch/rf ele.json").unwrap();
    assert_eq!(next_active.as_deref(), Some("Fresh Run.json"));

    // Recursive folder delete removes nested files cleanly
    assert!(delete_folder(app_data, "League 3.26", false).is_err());
    delete_folder(app_data, "League 3.26", true).unwrap();
    let after_del = list_build_library(app_data).unwrap();
    assert_eq!(after_del.builds.len(), 1);
}

#[test]
fn migrates_legacy_pob_and_progress_once_preserving_legacy_files() {
    let dir = tempdir().expect("tempdir");
    let app_data = dir.path();

    let legacy_pob = SavedPobProfileRecord {
        raw_input: "https://pobb.in/legacy1".to_string(),
        cached_xml: Some(
            "<PathOfBuilding><Build buildName=\"Lightning Arrow Deadeye\"/></PathOfBuilding>"
                .to_string(),
        ),
        league_start: true,
        custom_route_text: "# note".to_string(),
        selection: None,
        updated_at_ms: 1500,
    };
    save_pob_profile_to_path(&app_data.join(POB_PROFILE_FILE_NAME), &legacy_pob).unwrap();

    let legacy_progress = SavedCampaignProgressRecord {
        completed_checkpoint_ids: vec!["1|1_1_1|MANDATORY_PATH||Kill Hillock#1".to_string()],
        updated_at_ms: 2500,
        ..Default::default()
    };
    save_campaign_progress_to_path(&app_data.join(CAMPAIGN_PROGRESS_FILE_NAME), &legacy_progress)
        .unwrap();

    let listing = list_build_library(app_data).unwrap();
    assert_eq!(listing.builds.len(), 1);
    assert_eq!(listing.builds[0].name, "Lightning Arrow Deadeye");
    assert_eq!(
        listing.active_build_path.as_deref(),
        Some("Lightning Arrow Deadeye.json")
    );
    assert!(app_data.join(POB_PROFILE_FILE_NAME).is_file());
    assert!(app_data.join(CAMPAIGN_PROGRESS_FILE_NAME).is_file());

    // Subsequent listing does not re-migrate or duplicate even if deleted
    delete_build(app_data, "Lightning Arrow Deadeye.json").unwrap();
    assert!(app_data.join(LIBRARY_STATE_FILE_NAME).is_file());
    let second = list_build_library(app_data).unwrap();
    assert!(second.builds.is_empty());
    assert_eq!(fs::read_dir(app_data.join(BUILDS_DIR_NAME)).unwrap().count(), 0);
}

#[test]
fn isolates_poe1_and_poe2_build_libraries_folders_and_active_paths() {
    let dir = tempdir().expect("tempdir");
    let app_data = dir.path();

    create_folder_for_game(app_data, "", "PoE1 Starters", Some("poe1")).unwrap();
    create_folder_for_game(app_data, "", "PoE2 Starters", Some("poe2")).unwrap();

    let b1 = save_build_file_for_game(
        app_data,
        "PoE1 Starters",
        sample_record("id-p1", "RF Witch", 1000),
        None,
        true,
        Some("poe1"),
    )
    .unwrap();
    let mut r2 = sample_record("id-p2", "Monk Invoker", 2000);
    r2.game_id = "poe2".to_string();
    let b2 = save_build_file_for_game(
        app_data,
        "PoE2 Starters",
        r2,
        None,
        true,
        Some("poe2"),
    )
    .unwrap();

    assert_eq!(b1.game_id, "poe1");
    assert_eq!(b2.game_id, "poe2");

    let list_p1 = list_build_library_for_game(app_data, Some("poe1")).unwrap();
    let list_p2 = list_build_library_for_game(app_data, Some("poe2")).unwrap();

    assert_eq!(list_p1.builds.len(), 1);
    assert_eq!(list_p1.builds[0].name, "RF Witch");
    assert_eq!(list_p1.folders, vec!["PoE1 Starters"]);
    assert_eq!(list_p1.active_build_path.as_deref(), Some("PoE1 Starters/RF Witch.json"));

    assert_eq!(list_p2.builds.len(), 1);
    assert_eq!(list_p2.builds[0].name, "Monk Invoker");
    assert_eq!(list_p2.folders, vec!["PoE2 Starters"]);
    assert_eq!(list_p2.active_build_path.as_deref(), Some("PoE2 Starters/Monk Invoker.json"));
}
