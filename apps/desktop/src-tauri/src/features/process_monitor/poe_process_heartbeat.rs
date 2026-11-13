use std::path::PathBuf;
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningPoeProcess {
    pub pid: u32,
    pub exe_path: Option<PathBuf>,
}

fn is_poe_executable_name(exe_name: &str) -> bool {
    let lower = exe_name.to_ascii_lowercase();
    lower.starts_with("pathofexile") && lower.ends_with(".exe")
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

/// Inspects running Windows processes via Win32 ToolHelp32 to locate active PathOfExile*.exe.
pub fn find_running_poe_process() -> Option<RunningPoeProcess> {
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
                    found = Some(RunningPoeProcess {
                        pid,
                        exe_path: query_process_exe_path(pid),
                    });
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

/// Returns whether any PathOfExile*.exe process is currently running.
pub fn is_poe_process_running() -> bool {
    find_running_poe_process().is_some()
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
