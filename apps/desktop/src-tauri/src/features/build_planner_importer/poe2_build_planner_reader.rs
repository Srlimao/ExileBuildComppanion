use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::AppHandle;

use crate::local_loot_filter_installer::resolve_poe_filter_dir;
use crate::poe_process_heartbeat::PoeGameKind;

const MAX_BUILD_FILE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Poe2BuildPlannerFileSummary {
    pub file_name: String,
    pub build_name: String,
    pub ascendancy: String,
    pub author: String,
    pub byte_size: u64,
    pub modified_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Poe2BuildPlannerScanResult {
    pub planner_dir: String,
    pub dir_exists: bool,
    pub files: Vec<Poe2BuildPlannerFileSummary>,
}

/// Ensures a `.build` filename is a single safe path segment without traversal characters.
pub fn validate_build_file_name(file_name: &str) -> Result<&str, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
        || trimmed.contains(':')
    {
        return Err("Invalid .build filename.".to_string());
    }
    if !trimmed.to_ascii_lowercase().ends_with(".build") {
        return Err("Expected a .build file extension.".to_string());
    }
    Ok(trimmed)
}

fn resolve_poe2_build_planner_dir(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_poe_filter_dir(app, PoeGameKind::Poe2).map(|dir| dir.join("BuildPlanner"))
}

fn peek_build_metadata(path: &Path) -> (String, String, String) {
    let fallback_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("PoE 2 Build")
        .to_string();
    let Ok(raw) = fs::read_to_string(path) else {
        return (fallback_name, String::new(), String::new());
    };
    let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&raw) else {
        return (fallback_name, String::new(), String::new());
    };
    let get_str = |key: &str| {
        map.get(key)
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned)
    };
    (
        get_str("name").unwrap_or(fallback_name),
        get_str("ascendancy").unwrap_or_default(),
        get_str("author").unwrap_or_default(),
    )
}

/// Scans `dir` for `.build` files and extracts lightweight preview headers.
pub fn scan_build_planner_dir(dir: &Path) -> Poe2BuildPlannerScanResult {
    let dir_exists = dir.is_dir();
    let mut files = Vec::new();

    if dir_exists {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let Some(file_name) = path.file_name().and_then(|n| n.to_str()).map(ToOwned::to_owned) else {
                    continue;
                };
                if !file_name.to_ascii_lowercase().ends_with(".build") {
                    continue;
                }
                let Ok(meta) = entry.metadata() else {
                    continue;
                };
                if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_BUILD_FILE_BYTES {
                    continue;
                }
                let modified_at_ms = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let (build_name, ascendancy, author) = peek_build_metadata(&path);
                files.push(Poe2BuildPlannerFileSummary {
                    file_name,
                    build_name,
                    ascendancy,
                    author,
                    byte_size: meta.len(),
                    modified_at_ms,
                });
            }
        }
    }

    files.sort_by(|a, b| {
        b.modified_at_ms
            .cmp(&a.modified_at_ms)
            .then_with(|| a.file_name.to_ascii_lowercase().cmp(&b.file_name.to_ascii_lowercase()))
    });

    Poe2BuildPlannerScanResult {
        planner_dir: dir.to_string_lossy().to_string(),
        dir_exists,
        files,
    }
}

/// Reads a single validated `.build` JSON file from `dir` (2 MB max).
pub fn read_build_planner_file_in_dir(dir: &Path, file_name: &str) -> Result<String, String> {
    let valid_name = validate_build_file_name(file_name)?;
    let path = dir.join(valid_name);
    let meta = fs::metadata(&path).map_err(|e| format!("Failed reading .build metadata: {e}"))?;
    if !meta.is_file() {
        return Err("Target .build path is not a file.".to_string());
    }
    if meta.len() > MAX_BUILD_FILE_BYTES {
        return Err("The selected .build file exceeds the 2 MB limit.".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed reading .build file: {e}"))
}

#[tauri::command]
pub fn scan_poe2_build_planner_dir(app: AppHandle) -> Result<Poe2BuildPlannerScanResult, String> {
    let dir = resolve_poe2_build_planner_dir(&app)?;
    Ok(scan_build_planner_dir(&dir))
}

#[tauri::command]
pub fn read_poe2_build_planner_file(app: AppHandle, file_name: String) -> Result<String, String> {
    let dir = resolve_poe2_build_planner_dir(&app)?;
    read_build_planner_file_in_dir(&dir, &file_name)
}

#[tauri::command]
pub fn open_poe2_build_planner_folder(app: AppHandle) -> Result<String, String> {
    let dir = resolve_poe2_build_planner_dir(&app)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed creating BuildPlanner folder: {e}"))?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed opening Explorer: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scans_valid_build_files_and_rejects_traversal() {
        let dir = tempdir().expect("tempdir");
        let missing = scan_build_planner_dir(&dir.path().join("Missing"));
        assert!(!missing.dir_exists);
        assert!(missing.files.is_empty());

        fs::write(
            dir.path().join("monk.build"),
            r#"{"name":"Ice Strike Invoker","ascendancy":"Invoker","author":"Exile","passives":[]}"#,
        )
        .unwrap();
        fs::write(dir.path().join("notes.txt"), "ignore me").unwrap();

        let scan = scan_build_planner_dir(dir.path());
        assert!(scan.dir_exists);
        assert_eq!(scan.files.len(), 1);
        assert_eq!(scan.files[0].file_name, "monk.build");
        assert_eq!(scan.files[0].build_name, "Ice Strike Invoker");
        assert_eq!(scan.files[0].ascendancy, "Invoker");
        assert_eq!(scan.files[0].author, "Exile");

        let body = read_build_planner_file_in_dir(dir.path(), "monk.build").unwrap();
        assert!(body.contains("Ice Strike Invoker"));

        assert!(read_build_planner_file_in_dir(dir.path(), "../monk.build").is_err());
        assert!(read_build_planner_file_in_dir(dir.path(), "sub/monk.build").is_err());
        assert!(read_build_planner_file_in_dir(dir.path(), "notes.txt").is_err());
    }
}
