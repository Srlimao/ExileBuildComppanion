use std::path::{Path, PathBuf};

pub const BUILDS_DIR_NAME: &str = "builds";
pub const POE2_BUILDS_DIR_NAME: &str = "builds_poe2";
pub const LIBRARY_STATE_FILE_NAME: &str = "build_library_state.json";
pub const POE2_LIBRARY_STATE_FILE_NAME: &str = "build_library_state_poe2.json";
const MAX_SEGMENT_LEN: usize = 80;

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

pub fn normalize_game_id(raw: Option<&str>) -> &'static str {
    match raw.map(str::trim) {
        Some(v) if v.eq_ignore_ascii_case("poe2") => "poe2",
        _ => "poe1",
    }
}

pub fn library_builds_dir_name(game_id: Option<&str>) -> &'static str {
    if normalize_game_id(game_id) == "poe2" {
        POE2_BUILDS_DIR_NAME
    } else {
        BUILDS_DIR_NAME
    }
}

pub fn library_state_file_name(game_id: Option<&str>) -> &'static str {
    if normalize_game_id(game_id) == "poe2" {
        POE2_LIBRARY_STATE_FILE_NAME
    } else {
        LIBRARY_STATE_FILE_NAME
    }
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
