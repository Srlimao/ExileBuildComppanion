use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLogDetectionResult {
    pub detected_path: Option<String>,
    pub checked_candidates: Vec<String>,
}

const DEFAULT_CANDIDATES: &[&str] = &[
    r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt",
    r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt",
    r"D:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"E:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    r"C:\Program Files\Epic Games\PathOfExile\logs\Client.txt",
    r"D:\Games\Path of Exile\logs\Client.txt",
    r"C:\Games\Path of Exile\logs\Client.txt",
];

pub fn detect_client_txt_path() -> ClientLogDetectionResult {
    let mut checked = Vec::with_capacity(DEFAULT_CANDIDATES.len());
    let mut detected = None;

    for raw in DEFAULT_CANDIDATES {
        let candidate = (*raw).to_string();
        checked.push(candidate.clone());
        if detected.is_none() && Path::new(&candidate).is_file() {
            detected = Some(candidate);
        }
    }

    ClientLogDetectionResult {
        detected_path: detected,
        checked_candidates: checked,
    }
}
