use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::character_window_http_poller::now_epoch_ms;
use crate::github_release_checker::{
    fetch_github_release_check, AppUpdatePhase, AppUpdateStateSnapshot, InstallVariant,
    ReleaseCheckOutcome,
};
use crate::release_asset_downloader::{choose_staging_path, download_and_verify_release_asset};
use crate::tray_icon_and_menu_controller;
use crate::windows_self_update_installer::spawn_windows_update_trampoline;

const INITIAL_CHECK_DELAY_SECS: u64 = 4;
const PERIODIC_CHECK_INTERVAL_SECS: u64 = 30 * 60;

struct UpdaterInner {
    snapshot: AppUpdateStateSnapshot,
    cached_etag: Option<String>,
    op_in_flight: bool,
}

pub struct AutoUpdaterSharedState {
    inner: Mutex<UpdaterInner>,
}

impl AutoUpdaterSharedState {
    pub fn new() -> Self {
        let variant = std::env::current_exe()
            .map(|p| InstallVariant::detect_for_exe(&p))
            .unwrap_or(InstallVariant::PortableStandalone);
        let initial = AppUpdateStateSnapshot::initial(env!("CARGO_PKG_VERSION").to_string(), variant);
        Self { inner: Mutex::new(UpdaterInner { snapshot: initial, cached_etag: None, op_in_flight: false }) }
    }
}

fn broadcast_update_state(app: &AppHandle, snapshot: &AppUpdateStateSnapshot) {
    let _ = tray_icon_and_menu_controller::set_tray_update_state(app, snapshot);
    let _ = app.emit("app-update-state-changed", snapshot);
}

fn apply_check_outcome(
    guard: &mut UpdaterInner,
    result: Result<ReleaseCheckOutcome, String>,
    is_manual: bool,
) {
    guard.op_in_flight = false;
    match result {
        Ok(ReleaseCheckOutcome::NotModified) => {
            guard.snapshot.last_checked_at_ms = Some(now_epoch_ms());
            guard.snapshot.error = None;
            guard.snapshot.phase = if guard.snapshot.update_available {
                AppUpdatePhase::Available
            } else {
                AppUpdatePhase::Idle
            };
        }
        Ok(ReleaseCheckOutcome::Updated { etag, release }) => {
            if etag.is_some() {
                guard.cached_etag = etag;
            }
            guard.snapshot.last_checked_at_ms = Some(now_epoch_ms());
            guard.snapshot.latest_version = Some(release.tag_name);
            guard.snapshot.update_available = release.update_available;
            guard.snapshot.asset_download_url = Some(release.asset_download_url);
            guard.snapshot.checksums_url = release.checksums_url;
            guard.snapshot.release_page_url = release.release_page_url;
            guard.snapshot.asset_size_bytes = release.asset_size_bytes;
            guard.snapshot.error = None;
            guard.snapshot.phase = if release.update_available {
                AppUpdatePhase::Available
            } else {
                AppUpdatePhase::Idle
            };
        }
        Err(err_msg) => {
            if is_manual {
                guard.snapshot.error = Some(err_msg);
            }
            guard.snapshot.phase = if guard.snapshot.update_available {
                AppUpdatePhase::Available
            } else if is_manual {
                AppUpdatePhase::Error
            } else {
                AppUpdatePhase::Idle
            };
        }
    }
}

pub async fn run_update_check(app: AppHandle, is_manual: bool) -> AppUpdateStateSnapshot {
    let state = app.state::<AutoUpdaterSharedState>();
    let (current_version, variant, cached_etag, checking_snapshot) = {
        let Ok(mut guard) = state.inner.lock() else {
            return AutoUpdaterSharedState::new().inner.into_inner().unwrap().snapshot;
        };
        if guard.op_in_flight
            || matches!(guard.snapshot.phase, AppUpdatePhase::Downloading | AppUpdatePhase::Installing)
        {
            return guard.snapshot.clone();
        }
        guard.op_in_flight = true;
        guard.snapshot.phase = AppUpdatePhase::Checking;
        if is_manual {
            guard.snapshot.error = None;
        }
        (
            guard.snapshot.current_version.clone(),
            guard.snapshot.install_variant,
            guard.cached_etag.clone(),
            guard.snapshot.clone(),
        )
    };

    if is_manual {
        broadcast_update_state(&app, &checking_snapshot);
    }

    let result = fetch_github_release_check(&current_version, variant, cached_etag.as_deref()).await;
    let final_snapshot = {
        let Ok(mut guard) = state.inner.lock() else {
            return checking_snapshot;
        };
        apply_check_outcome(&mut guard, result, is_manual);
        guard.snapshot.clone()
    };

    broadcast_update_state(&app, &final_snapshot);
    final_snapshot
}

fn update_snapshot_with<F: FnOnce(&mut UpdaterInner)>(app: &AppHandle, f: F) {
    let state = app.state::<AutoUpdaterSharedState>();
    let maybe_snap = state.inner.lock().ok().map(|mut guard| {
        f(&mut guard);
        guard.snapshot.clone()
    });
    if let Some(snap) = maybe_snap {
        broadcast_update_state(app, &snap);
    }
}

fn set_install_error(app: &AppHandle, message: String) {
    update_snapshot_with(app, |guard| {
        guard.op_in_flight = false;
        guard.snapshot.phase = AppUpdatePhase::Error;
        guard.snapshot.progress_percent = None;
        guard.snapshot.error = Some(message);
    });
}

struct InstallJob {
    asset_url: String,
    checksums_url: Option<String>,
    variant: InstallVariant,
    tag: String,
    downloading_snap: AppUpdateStateSnapshot,
}

async fn execute_install_job(app: AppHandle, job: InstallJob) {
    let Ok(current_exe) = std::env::current_exe() else {
        set_install_error(&app, "Failed locating current executable path.".to_string());
        return;
    };
    let staging_path = choose_staging_path(job.variant, &current_exe, &job.tag);
    let mut last_pct: u8 = 0;

    let dl_result = download_and_verify_release_asset(
        &job.asset_url,
        job.variant.target_asset_name(),
        job.checksums_url.as_deref(),
        &staging_path,
        |pct| {
            if pct == 100 || pct.saturating_sub(last_pct) >= 2 {
                last_pct = pct;
                update_snapshot_with(&app, |g| g.snapshot.progress_percent = Some(pct));
            }
        },
    )
    .await;

    if let Err(err) = dl_result {
        set_install_error(&app, err);
        return;
    }

    update_snapshot_with(&app, |g| {
        g.snapshot.phase = AppUpdatePhase::Installing;
        g.snapshot.progress_percent = Some(100);
    });

    if let Err(err) =
        spawn_windows_update_trampoline(std::process::id(), job.variant, &staging_path, &current_exe)
    {
        set_install_error(&app, err);
        return;
    }

    app.exit(0);
}

pub fn trigger_update_install(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AutoUpdaterSharedState>();
    let job = {
        let mut guard = state.inner.lock().map_err(|_| "Updater lock poisoned".to_string())?;
        if matches!(guard.snapshot.phase, AppUpdatePhase::Downloading | AppUpdatePhase::Installing) {
            return Ok(());
        }
        if guard.op_in_flight {
            return Err("Update check in progress; please retry in a moment.".to_string());
        }
        if !guard.snapshot.update_available {
            return Err("No new update is currently available.".to_string());
        }
        let Some(url) = guard.snapshot.asset_download_url.clone() else {
            return Err("Missing update download URL.".to_string());
        };
        if cfg!(debug_assertions) {
            guard.snapshot.phase = AppUpdatePhase::Error;
            guard.snapshot.error = Some(
                "Self-update install is disabled in debug dev builds; run a release build to test binary replacement.".to_string(),
            );
            let snap = guard.snapshot.clone();
            drop(guard);
            broadcast_update_state(&app, &snap);
            return Ok(());
        }
        guard.op_in_flight = true;
        guard.snapshot.phase = AppUpdatePhase::Downloading;
        guard.snapshot.progress_percent = Some(0);
        guard.snapshot.error = None;
        InstallJob {
            asset_url: url,
            checksums_url: guard.snapshot.checksums_url.clone(),
            variant: guard.snapshot.install_variant,
            tag: guard.snapshot.latest_version.clone().unwrap_or_else(|| "latest".to_string()),
            downloading_snap: guard.snapshot.clone(),
        }
    };

    broadcast_update_state(&app, &job.downloading_snap);
    tauri::async_runtime::spawn(execute_install_job(app, job));
    Ok(())
}

pub fn spawn_auto_update_watcher(app: &AppHandle) {
    let watcher_app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(INITIAL_CHECK_DELAY_SECS)).await;
        let _ = run_update_check(watcher_app.clone(), false).await;

        let mut interval = tokio::time::interval(Duration::from_secs(PERIODIC_CHECK_INTERVAL_SECS));
        interval.tick().await;
        loop {
            interval.tick().await;
            let _ = run_update_check(watcher_app.clone(), false).await;
        }
    });
}

#[tauri::command]
pub fn get_app_update_state(state: State<'_, AutoUpdaterSharedState>) -> AppUpdateStateSnapshot {
    state
        .inner
        .lock()
        .map(|guard| guard.snapshot.clone())
        .unwrap_or_else(|_| AutoUpdaterSharedState::new().inner.into_inner().unwrap().snapshot)
}

#[tauri::command]
pub async fn check_for_app_update(app: AppHandle) -> AppUpdateStateSnapshot {
    run_update_check(app, true).await
}

#[tauri::command]
pub fn install_app_update(app: AppHandle) -> Result<(), String> {
    trigger_update_install(app)
}
