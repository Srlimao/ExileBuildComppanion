use reqwest::header::{ACCEPT, IF_NONE_MATCH, USER_AGENT};
use reqwest::StatusCode;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

pub const GITHUB_LATEST_RELEASE_API_URL: &str =
    "https://api.github.com/repos/Srlimao/ExileBuildComppanion/releases/latest";
pub const PORTABLE_ASSET_NAME: &str = "ExileRelay.exe";
pub const SETUP_ASSET_NAME: &str = "ExileRelay-Setup.exe";
pub const CHECKSUMS_ASSET_NAME: &str = "SHA256SUMS.txt";
const LATEST_DOWNLOAD_BASE: &str =
    "https://github.com/Srlimao/ExileBuildComppanion/releases/latest/download";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallVariant {
    PortableStandalone,
    NsisSetup,
}

impl InstallVariant {
    pub fn detect_for_exe(exe_path: &Path) -> Self {
        let has_uninstaller = exe_path
            .parent()
            .map(|dir| dir.join("uninstall.exe").is_file())
            .unwrap_or(false);
        if has_uninstaller {
            Self::NsisSetup
        } else {
            Self::PortableStandalone
        }
    }

    pub fn target_asset_name(self) -> &'static str {
        match self {
            Self::PortableStandalone => PORTABLE_ASSET_NAME,
            Self::NsisSetup => SETUP_ASSET_NAME,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppUpdatePhase {
    Idle,
    Checking,
    Available,
    Downloading,
    Installing,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateStateSnapshot {
    pub phase: AppUpdatePhase,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub install_variant: InstallVariant,
    pub update_available: bool,
    pub asset_download_url: Option<String>,
    pub checksums_url: Option<String>,
    pub release_page_url: Option<String>,
    pub asset_size_bytes: Option<u64>,
    pub progress_percent: Option<u8>,
    pub last_checked_at_ms: Option<u64>,
    pub error: Option<String>,
}

impl AppUpdateStateSnapshot {
    pub fn initial(current_version: String, install_variant: InstallVariant) -> Self {
        Self {
            phase: AppUpdatePhase::Idle,
            current_version,
            latest_version: None,
            install_variant,
            update_available: false,
            asset_download_url: None,
            checksums_url: None,
            release_page_url: None,
            asset_size_bytes: None,
            progress_percent: None,
            last_checked_at_ms: None,
            error: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CheckedReleaseInfo {
    pub tag_name: String,
    pub update_available: bool,
    pub asset_download_url: String,
    pub checksums_url: Option<String>,
    pub release_page_url: Option<String>,
    pub asset_size_bytes: Option<u64>,
}

#[derive(Debug, Clone)]
pub enum ReleaseCheckOutcome {
    NotModified,
    Updated {
        etag: Option<String>,
        release: CheckedReleaseInfo,
    },
}

#[derive(Debug, Deserialize)]
struct GitHubReleaseAssetDto {
    name: String,
    size: u64,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubReleaseDto {
    tag_name: String,
    html_url: Option<String>,
    assets: Option<Vec<GitHubReleaseAssetDto>>,
}

pub fn is_remote_tag_newer(current_pkg_version: &str, remote_tag: &str) -> bool {
    let cur_clean = current_pkg_version.trim().trim_start_matches(['v', 'V']);
    let rem_clean = remote_tag.trim().trim_start_matches(['v', 'V']);
    let (Ok(cur), Ok(rem)) = (Version::parse(cur_clean), Version::parse(rem_clean)) else {
        return false;
    };
    rem > cur
}

pub fn parse_sha256_for_asset(checksums_text: &str, asset_name: &str) -> Option<String> {
    let clean = checksums_text.trim_start_matches('\u{feff}');
    for line in clean.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        let Some(raw_hash) = parts.next() else {
            continue;
        };
        let Some(raw_file) = parts.next() else {
            continue;
        };
        let hash = raw_hash.to_ascii_lowercase();
        if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            continue;
        }
        let file_name = raw_file
            .trim_start_matches('*')
            .rsplit(['/', '\\'])
            .next()
            .unwrap_or("");
        if file_name.eq_ignore_ascii_case(asset_name) {
            return Some(hash);
        }
    }
    None
}

pub async fn fetch_github_release_check(
    current_version: &str,
    variant: InstallVariant,
    cached_etag: Option<&str>,
) -> Result<ReleaseCheckOutcome, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed initializing update HTTP client: {e}"))?;

    let mut req = client
        .get(GITHUB_LATEST_RELEASE_API_URL)
        .header(USER_AGENT, format!("ExileRelay/{current_version}"))
        .header(ACCEPT, "application/vnd.github+json");

    if let Some(etag) = cached_etag {
        req = req.header(IF_NONE_MATCH, etag);
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("GitHub release check failed: {e}"))?;

    if res.status() == StatusCode::NOT_MODIFIED {
        return Ok(ReleaseCheckOutcome::NotModified);
    }

    if !res.status().is_success() {
        return Err(format!(
            "GitHub release check returned HTTP {}",
            res.status().as_u16()
        ));
    }

    let next_etag = res
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let dto = res
        .json::<GitHubReleaseDto>()
        .await
        .map_err(|e| format!("Invalid GitHub release JSON: {e}"))?;

    let target_name = variant.target_asset_name();
    let assets = dto.assets.unwrap_or_default();
    let matched_asset = assets.iter().find(|a| a.name == target_name);
    let checksums_asset = assets.iter().find(|a| a.name == CHECKSUMS_ASSET_NAME);

    let update_available = is_remote_tag_newer(current_version, &dto.tag_name);
    let asset_download_url = matched_asset
        .map(|a| a.browser_download_url.clone())
        .unwrap_or_else(|| format!("{LATEST_DOWNLOAD_BASE}/{target_name}"));

    Ok(ReleaseCheckOutcome::Updated {
        etag: next_etag,
        release: CheckedReleaseInfo {
            tag_name: dto.tag_name,
            update_available,
            asset_download_url,
            checksums_url: checksums_asset.map(|a| a.browser_download_url.clone()),
            release_page_url: dto.html_url,
            asset_size_bytes: matched_asset.map(|a| a.size),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::{is_remote_tag_newer, parse_sha256_for_asset, InstallVariant};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn detects_nsis_vs_portable_from_sibling_uninstaller() {
        let dir = tempdir().expect("tempdir");
        let exe_path = dir.path().join("ExileRelay.exe");
        fs::write(&exe_path, b"exe").expect("write exe");
        assert_eq!(
            InstallVariant::detect_for_exe(&exe_path),
            InstallVariant::PortableStandalone
        );

        fs::write(dir.path().join("uninstall.exe"), b"uninst").expect("write uninst");
        assert_eq!(
            InstallVariant::detect_for_exe(&exe_path),
            InstallVariant::NsisSetup
        );
    }

    #[test]
    fn compares_semver_tags_accurately() {
        assert!(is_remote_tag_newer("0.1.0", "v0.1.45"));
        assert!(is_remote_tag_newer("0.1.44", "V0.1.45"));
        assert!(!is_remote_tag_newer("0.1.45", "v0.1.45"));
        assert!(!is_remote_tag_newer("0.1.46", "v0.1.45"));
        assert!(!is_remote_tag_newer("0.1.0", "invalid-tag"));
    }

    #[test]
    fn parses_sha256sums_with_and_without_bom() {
        let text = "\u{feff}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA  ExileRelay.exe\r\nbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb *ExileRelay-Setup.exe\n";
        assert_eq!(
            parse_sha256_for_asset(text, "ExileRelay.exe").as_deref(),
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_eq!(
            parse_sha256_for_asset(text, "ExileRelay-Setup.exe").as_deref(),
            Some("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
        );
        assert_eq!(parse_sha256_for_asset(text, "missing.exe"), None);
    }
}
