use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::poe_process_heartbeat::{find_running_poe_process_for_game, PoeGameKind};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLogDetectionResult {
    pub detected_path: Option<String>,
    pub checked_candidates: Vec<String>,
}

const STEAM_VDF_PATHS: &[&str] = &[
    r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
    r"C:\Program Files\Steam\steamapps\libraryfolders.vdf",
];

const DEFAULT_POE1_CANDIDATES: &[&str] = &[
    r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt",
    r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt",
    r"D:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"E:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"F:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"G:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"C:\Program Files\Epic Games\PathOfExile\logs\Client.txt",
    r"C:\Games\Path of Exile\logs\Client.txt",
    r"D:\Games\Path of Exile\logs\Client.txt",
    r"E:\Games\Path of Exile\logs\Client.txt",
];

const DEFAULT_POE2_CANDIDATES: &[&str] = &[
    r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"E:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"F:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"G:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files\Epic Games\PathOfExile2\logs\Client.txt",
    r"C:\Games\Path of Exile 2\logs\Client.txt",
    r"D:\Games\Path of Exile 2\logs\Client.txt",
    r"E:\Games\Path of Exile 2\logs\Client.txt",
];

/// Parses Steam libraryfolders.vdf to extract `<library>\steamapps\common\<GameDir>\logs\Client.txt` paths.
pub fn parse_steam_library_vdf_paths_for_game(vdf_text: &str, game: PoeGameKind) -> Vec<PathBuf> {
    let steam_folder = match game {
        PoeGameKind::Poe1 => "Path of Exile",
        PoeGameKind::Poe2 => "Path of Exile 2",
    };
    let mut results = Vec::new();
    for line in vdf_text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("\"path\"") {
            continue;
        }
        let rest = &trimmed["\"path\"".len()..];
        let Some(start) = rest.find('"') else {
            continue;
        };
        let after_start = &rest[start + 1..];
        let Some(end) = after_start.find('"') else {
            continue;
        };
        let lib_root = after_start[..end].replace("\\\\", "\\");
        if !lib_root.is_empty() {
            results.push(
                PathBuf::from(lib_root)
                    .join("steamapps")
                    .join("common")
                    .join(steam_folder)
                    .join("logs")
                    .join("Client.txt"),
            );
        }
    }
    results
}

/// Parses Steam libraryfolders.vdf for PoE 1 install paths.
pub fn parse_steam_library_vdf_paths(vdf_text: &str) -> Vec<PathBuf> {
    parse_steam_library_vdf_paths_for_game(vdf_text, PoeGameKind::Poe1)
}

/// Picks the existing Client.txt with the newest modification timestamp, falling back on ties to earlier candidates.
pub fn pick_newest_existing_log(candidates: &[PathBuf]) -> Option<PathBuf> {
    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    for path in candidates {
        if !path.is_file() {
            continue;
        }
        let mod_time = fs::metadata(path)
            .and_then(|m| m.modified())
            .unwrap_or(UNIX_EPOCH);
        let should_replace = match &best {
            None => true,
            Some((_, best_time)) => mod_time > *best_time,
        };
        if should_replace {
            best = Some((path.clone(), mod_time));
        }
    }
    best.map(|(p, _)| p)
}

fn push_unique_candidate(candidates: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    let key = path.to_string_lossy().to_ascii_lowercase();
    if seen.insert(key) {
        candidates.push(path);
    }
}

/// Detects the active Client.txt for `game`, prioritizing the matching running PoE process.
pub fn detect_client_txt_path_for_game(game: PoeGameKind) -> ClientLogDetectionResult {
    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();

    if let Some(proc_info) = find_running_poe_process_for_game(game) {
        if let Some(exe_path) = proc_info.exe_path {
            if let Some(poe_dir) = exe_path.parent() {
                let active_log = poe_dir.join("logs").join("Client.txt");
                push_unique_candidate(&mut candidates, &mut seen, active_log.clone());
                if active_log.is_file() {
                    return ClientLogDetectionResult {
                        detected_path: Some(active_log.to_string_lossy().to_string()),
                        checked_candidates: candidates
                            .into_iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect(),
                    };
                }
            }
        }
    }

    for vdf_path in STEAM_VDF_PATHS {
        if Path::new(vdf_path).is_file() {
            if let Ok(content) = fs::read_to_string(vdf_path) {
                for p in parse_steam_library_vdf_paths_for_game(&content, game) {
                    push_unique_candidate(&mut candidates, &mut seen, p);
                }
            }
        }
    }

    let defaults = match game {
        PoeGameKind::Poe1 => DEFAULT_POE1_CANDIDATES,
        PoeGameKind::Poe2 => DEFAULT_POE2_CANDIDATES,
    };
    for raw in defaults {
        push_unique_candidate(&mut candidates, &mut seen, PathBuf::from(raw));
    }

    let detected = pick_newest_existing_log(&candidates).map(|p| p.to_string_lossy().to_string());
    let checked_candidates = candidates
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    ClientLogDetectionResult {
        detected_path: detected,
        checked_candidates,
    }
}

/// Detects the active PoE 1 Client.txt (backwards-compatible default).
pub fn detect_client_txt_path() -> ClientLogDetectionResult {
    detect_client_txt_path_for_game(PoeGameKind::Poe1)
}

#[cfg(test)]
mod tests {
    use super::{
        parse_steam_library_vdf_paths, parse_steam_library_vdf_paths_for_game,
        pick_newest_existing_log, PoeGameKind,
    };
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::PathBuf;
    use std::thread;
    use std::time::Duration;
    use tempfile::tempdir;

    #[test]
    fn parses_steam_libraryfolders_vdf_paths_for_poe1_and_poe2() {
        let sample = r#""libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
	}
	"1"
	{
		"path"		"D:\\SteamLibrary"
	}
}"#;
        let poe1_paths = parse_steam_library_vdf_paths(sample);
        assert_eq!(
            poe1_paths,
            vec![
                PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt"),
                PathBuf::from(r"D:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt"),
            ]
        );
        let poe2_paths = parse_steam_library_vdf_paths_for_game(sample, PoeGameKind::Poe2);
        assert_eq!(
            poe2_paths,
            vec![
                PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt"),
                PathBuf::from(r"D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt"),
            ]
        );
    }

    #[test]
    fn picks_most_recently_modified_client_txt_over_stale_file() {
        let dir = tempdir().expect("tempdir");
        let stale_path = dir.path().join("stale_Client.txt");
        let fresh_path = dir.path().join("fresh_Client.txt");

        let mut f1 = File::create(&stale_path).unwrap();
        writeln!(f1, "old").unwrap();
        f1.flush().unwrap();

        thread::sleep(Duration::from_millis(25));

        let mut f2 = File::create(&fresh_path).unwrap();
        writeln!(f2, "new").unwrap();
        f2.flush().unwrap();
        let _ = fs::metadata(&fresh_path).unwrap();

        let picked = pick_newest_existing_log(&[stale_path.clone(), fresh_path.clone()]);
        assert_eq!(picked, Some(fresh_path));
    }
}
