use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoeGameKind {
    #[default]
    Poe1,
    Poe2,
}

impl PoeGameKind {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.map(str::trim) {
            Some(v) if v.eq_ignore_ascii_case("poe2") => Self::Poe2,
            _ => Self::Poe1,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Poe1 => "poe1",
            Self::Poe2 => "poe2",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningPoeProcess {
    pub pid: u32,
    pub game: PoeGameKind,
    pub exe_path: Option<PathBuf>,
}

fn is_poe_executable_name(exe_name: &str) -> bool {
    let lower = exe_name.to_ascii_lowercase();
    lower.starts_with("pathofexile") && lower.ends_with(".exe")
}

/// Classifies whether an active PathOfExile*.exe belongs to PoE 1 or PoE 2.
pub fn classify_poe_game(exe_name: &str, exe_path: Option<&Path>) -> PoeGameKind {
    let lower_name = exe_name.to_ascii_lowercase();
    if lower_name.contains("pathofexile2") {
        return PoeGameKind::Poe2;
    }
    if let Some(path) = exe_path {
        let lower_path = path.to_string_lossy().to_ascii_lowercase();
        if lower_path.contains("path of exile 2") || lower_path.contains("pathofexile2") {
            return PoeGameKind::Poe2;
        }
    }
    PoeGameKind::Poe1
}

unsafe fn query_process_exe_path(pid: u32) -> Option<PathBuf> {
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if handle.is_null() || handle == INVALID_HANDLE_VALUE {
        return None;
    }

    let mut buf = [0u16; 1024];
    let mut size = buf.len() as u32;
    let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
    CloseHandle(handle);

    if ok != 0 && size > 0 {
        Some(PathBuf::from(String::from_utf16_lossy(&buf[..size as usize])))
    } else {
        None
    }
}

fn scan_poe_process(filter_game: Option<PoeGameKind>) -> Option<RunningPoeProcess> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return None;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut found = None;
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if is_poe_executable_name(&name) {
                    let pid = entry.th32ProcessID;
                    let exe_path = query_process_exe_path(pid);
                    let game = classify_poe_game(&name, exe_path.as_deref());
                    if filter_game.is_none_or(|target| target == game) {
                        found = Some(RunningPoeProcess {
                            pid,
                            game,
                            exe_path,
                        });
                        break;
                    }
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);
        found
    }
}

/// Inspects running Windows processes via Win32 ToolHelp32 to locate any active PathOfExile*.exe.
pub fn find_running_poe_process() -> Option<RunningPoeProcess> {
    scan_poe_process(None)
}

/// Inspects running Windows processes to locate the active PathOfExile*.exe for `target_game`.
pub fn find_running_poe_process_for_game(target_game: PoeGameKind) -> Option<RunningPoeProcess> {
    scan_poe_process(Some(target_game))
}

/// Returns whether any PathOfExile*.exe process is currently running.
pub fn is_poe_process_running() -> bool {
    find_running_poe_process().is_some()
}

/// Returns whether a PathOfExile*.exe process for `target_game` is currently running.
pub fn is_poe_process_running_for_game(target_game: PoeGameKind) -> bool {
    find_running_poe_process_for_game(target_game).is_some()
}

#[cfg(test)]
mod tests {
    use super::{classify_poe_game, is_poe_executable_name, PoeGameKind};
    use std::path::Path;

    #[test]
    fn recognizes_poe_executable_variants() {
        assert!(is_poe_executable_name("PathOfExile.exe"));
        assert!(is_poe_executable_name("PathOfExileSteam.exe"));
        assert!(is_poe_executable_name("PathOfExile_x64.exe"));
        assert!(is_poe_executable_name("PathOfExile2_x64.exe"));
        assert!(!is_poe_executable_name("explorer.exe"));
    }

    #[test]
    fn classifies_poe1_and_poe2_including_shared_steam_executable_name() {
        assert_eq!(
            classify_poe_game(
                "PathOfExileSteam.exe",
                Some(Path::new(r"D:\SteamLibrary\steamapps\common\Path of Exile\PathOfExileSteam.exe")),
            ),
            PoeGameKind::Poe1
        );
        assert_eq!(
            classify_poe_game(
                "PathOfExileSteam.exe",
                Some(Path::new(r"D:\SteamLibrary\steamapps\common\Path of Exile 2\PathOfExileSteam.exe")),
            ),
            PoeGameKind::Poe2
        );
        assert_eq!(classify_poe_game("PathOfExile2_x64.exe", None), PoeGameKind::Poe2);
        assert_eq!(
            classify_poe_game(
                "PathOfExile.exe",
                Some(Path::new(r"C:\Program Files\Epic Games\PathOfExile2\PathOfExile.exe")),
            ),
            PoeGameKind::Poe2
        );
    }
}
