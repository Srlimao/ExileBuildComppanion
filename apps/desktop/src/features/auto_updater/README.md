# `auto_updater` Domain

Self-update pipeline for `@exile-hud/desktop` supporting both **Standalone Portable** (`ExileCompanionHUD.exe`) and **NSIS Installer** (`ExileCompanionHUD-Setup.exe`) Windows builds:

- **Variant Detection (`github_release_checker.rs`):** Checks `std::env::current_exe()` for a sibling `uninstall.exe` (`NsisSetup` vs `PortableStandalone`) and polls GitHub `/releases/latest` with `If-None-Match` ETag headers (4s after launch, then every 30 minutes).
- **Verified Download & Replacement (`release_asset_downloader.rs`, `windows_self_update_installer.rs`):** Downloads only when clicked, validates the binary against `SHA256SUMS.txt`, spawns a windowless PowerShell trampoline (`CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP`) that waits for PID exit, runs `/P` unattended install (Setup) or moves the new `.exe` into place (Portable), relaunches the app, and deletes itself.
- **Synchronized UI (`tray_icon_and_menu_controller.rs`, `desktop_update_footer_bar.tsx`):** Displays a blue corner dot badge + top `"Update to vX.Y.Z & Restart"` tray menu item alongside a docked blue bottom Update button in Control Center.
