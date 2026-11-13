use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

fn is_poe_executable_name(exe_name: &str) -> bool {
    let lower = exe_name.to_ascii_lowercase();
    lower.starts_with("pathofexile") && lower.ends_with(".exe")
}

/// Inspects running Windows processes via Win32 ToolHelp32 to detect PathOfExile*.exe.
pub fn is_poe_process_running() -> bool {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut found = false;
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if is_poe_executable_name(&name) {
                    found = true;
                    break;
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

#[cfg(test)]
mod tests {
    use super::is_poe_executable_name;

    #[test]
    fn recognizes_poe_executable_variants() {
        assert!(is_poe_executable_name("PathOfExile.exe"));
        assert!(is_poe_executable_name("PathOfExileSteam.exe"));
        assert!(is_poe_executable_name("PathOfExile_x64.exe"));
        assert!(!is_poe_executable_name("explorer.exe"));
    }
}
