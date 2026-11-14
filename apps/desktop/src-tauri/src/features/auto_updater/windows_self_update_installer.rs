use std::fs;
use std::path::Path;

use super::github_release_checker::InstallVariant;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW_AND_NEW_GROUP: u32 = 0x0800_0200;

pub fn escape_powershell_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

pub fn build_trampoline_powershell_script(
    old_pid: u32,
    variant: InstallVariant,
    staged_file: &Path,
    target_exe: &Path,
) -> String {
    let staged = escape_powershell_single_quoted(&staged_file.to_string_lossy());
    let target = escape_powershell_single_quoted(&target_exe.to_string_lossy());

    let apply_block = match variant {
        InstallVariant::PortableStandalone => {
            "  $moved = $false
  for ($i = 0; $i -lt 20; $i++) {
    try {
      Move-Item -LiteralPath $staged -Destination $target -Force
      $moved = $true
      break
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $moved) {
    Move-Item -LiteralPath $staged -Destination $target -Force
  }
  Start-Process -FilePath $target"
        }
        InstallVariant::NsisSetup => {
            "  $proc = Start-Process -FilePath $staged -ArgumentList '/P' -Wait -PassThru
  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
  if ($proc.ExitCode -eq 0 -and (Test-Path -LiteralPath $target)) {
    Start-Process -FilePath $target
  }"
        }
    };

    format!(
        "$ErrorActionPreference = 'Stop'
$staged = '{staged}'
$target = '{target}'
$oldPid = {old_pid}
try {{
  for ($i = 0; $i -lt 120; $i++) {{
    if (-not (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {{ break }}
    Start-Sleep -Milliseconds 250
  }}
{apply_block}
}} finally {{
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}}
"
    )
}

pub fn spawn_windows_update_trampoline(
    old_pid: u32,
    variant: InstallVariant,
    staged_file: &Path,
    target_exe: &Path,
) -> Result<(), String> {
    if cfg!(debug_assertions) {
        let _ = fs::remove_file(staged_file);
        return Err(
            "Self-update install is disabled in debug dev builds; run a release build to test binary replacement."
                .to_string(),
        );
    }

    let script_path = std::env::temp_dir().join(format!("exile_companion_updater_{old_pid}.ps1"));
    let script_body = build_trampoline_powershell_script(old_pid, variant, staged_file, target_exe);
    fs::write(&script_path, script_body)
        .map_err(|e| format!("Failed writing updater trampoline script: {e}"))?;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let script_str = script_path.to_string_lossy().to_string();
        std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
                &script_str,
            ])
            .creation_flags(CREATE_NO_WINDOW_AND_NEW_GROUP)
            .spawn()
            .map_err(|e| format!("Failed launching updater trampoline: {e}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = fs::remove_file(&script_path);
        Err("Windows auto-update trampoline requires Windows.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::build_trampoline_powershell_script;
    use crate::github_release_checker::InstallVariant;
    use std::path::Path;

    #[test]
    fn builds_portable_trampoline_escaping_quotes_and_spaces() {
        let staged = Path::new(r"C:\Temp\Player's Folder\ExileCompanionHUD-v0.1.45.update.tmp");
        let target = Path::new(r"D:\Games\PoE Tools\Exile's HUD\ExileCompanionHUD.exe");
        let script = build_trampoline_powershell_script(
            4242,
            InstallVariant::PortableStandalone,
            staged,
            target,
        );
        assert!(script.contains("$oldPid = 4242"));
        assert!(script.contains(r"C:\Temp\Player''s Folder\ExileCompanionHUD-v0.1.45.update.tmp"));
        assert!(script.contains(r"D:\Games\PoE Tools\Exile''s HUD\ExileCompanionHUD.exe"));
        assert!(script.contains("Move-Item -LiteralPath $staged -Destination $target -Force"));
        assert!(script.contains("Start-Process -FilePath $target"));
        assert!(script.contains("Remove-Item -LiteralPath $PSCommandPath"));
    }

    #[test]
    fn builds_nsis_passive_trampoline_with_cleanup_and_relaunch() {
        let staged = Path::new(r"C:\Users\Exile\AppData\Local\Temp\ExileCompanionHUD-Setup-v0.1.45.exe");
        let target = Path::new(r"C:\Users\Exile\AppData\Local\Programs\Exile Companion HUD\exile_companion_host.exe");
        let script = build_trampoline_powershell_script(
            9001,
            InstallVariant::NsisSetup,
            staged,
            target,
        );
        assert!(script.contains("$oldPid = 9001"));
        assert!(script.contains("-ArgumentList '/P' -Wait -PassThru"));
        assert!(script.contains("Remove-Item -LiteralPath $staged"));
        assert!(script.contains("$proc.ExitCode -eq 0"));
        assert!(script.contains("Start-Process -FilePath $target"));
    }
}
