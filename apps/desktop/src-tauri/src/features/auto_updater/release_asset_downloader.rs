use reqwest::header::USER_AGENT;
use sha2::{Digest, Sha256};
use std::fmt::Write as _;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use super::github_release_checker::{parse_sha256_for_asset, InstallVariant};

fn sanitize_tag_slug(tag: &str) -> String {
    let cleaned: String = tag
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.is_empty() {
        "latest".to_string()
    } else {
        cleaned
    }
}

pub fn choose_staging_path(variant: InstallVariant, current_exe: &Path, tag: &str) -> PathBuf {
    let slug = sanitize_tag_slug(tag);
    match variant {
        InstallVariant::NsisSetup => {
            std::env::temp_dir().join(format!("ExileCompanionHUD-Setup-{slug}.exe"))
        }
        InstallVariant::PortableStandalone => {
            if let Some(exe_dir) = current_exe.parent() {
                let candidate = exe_dir.join(format!("ExileCompanionHUD-{slug}.update.tmp"));
                if OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(&candidate)
                    .is_ok()
                {
                    let _ = fs::remove_file(&candidate);
                    return candidate;
                }
            }
            std::env::temp_dir().join(format!("ExileCompanionHUD-{slug}.update.tmp"))
        }
    }
}

fn bytes_to_lower_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(&mut out, "{b:02x}");
    }
    out
}

async fn fetch_expected_sha256(
    client: &reqwest::Client,
    ua: &str,
    checksums_url: &str,
    asset_name: &str,
) -> Result<String, String> {
    let res = client
        .get(checksums_url)
        .header(USER_AGENT, ua)
        .send()
        .await
        .map_err(|e| format!("Failed fetching SHA256SUMS.txt: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("SHA256SUMS.txt request returned HTTP {}", res.status().as_u16()));
    }
    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed reading SHA256SUMS.txt: {e}"))?;
    parse_sha256_for_asset(&text, asset_name).ok_or_else(|| {
        format!("Release SHA256SUMS.txt does not contain checksum for {asset_name}")
    })
}

pub async fn download_and_verify_release_asset<F>(
    asset_url: &str,
    asset_name: &str,
    checksums_url: Option<&str>,
    staging_path: &Path,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(u8),
{
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed initializing download HTTP client: {e}"))?;

    let ua = format!("ExileCompanionHUD/{}", env!("CARGO_PKG_VERSION"));
    let expected_sha256 = match checksums_url {
        Some(url) => Some(fetch_expected_sha256(&client, &ua, url, asset_name).await?),
        None => None,
    };

    let mut res = client
        .get(asset_url)
        .header(USER_AGENT, &ua)
        .send()
        .await
        .map_err(|e| format!("Failed downloading update asset: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Update download returned HTTP {}", res.status().as_u16()));
    }

    let total_bytes = res.content_length().unwrap_or(0);
    let mut file = File::create(staging_path)
        .map_err(|e| format!("Failed creating staging file {}: {e}", staging_path.display()))?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_pct: u8 = 0;

    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Download interrupted: {e}"))? {
        if let Err(e) = file.write_all(&chunk) {
            drop(file);
            let _ = fs::remove_file(staging_path);
            return Err(format!("Failed writing update staging file: {e}"));
        }
        hasher.update(&chunk);
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if total_bytes > 0 {
            let pct = ((downloaded.saturating_mul(100)) / total_bytes).min(100) as u8;
            if pct != last_pct {
                last_pct = pct;
                on_progress(pct);
            }
        }
    }

    file.sync_all()
        .map_err(|e| format!("Failed flushing update staging file: {e}"))?;
    drop(file);

    if let Some(expected) = expected_sha256 {
        let actual = bytes_to_lower_hex(&hasher.finalize());
        if actual != expected {
            let _ = fs::remove_file(staging_path);
            return Err(format!(
                "SHA-256 checksum mismatch for {asset_name} (expected {expected}, got {actual})"
            ));
        }
    }

    on_progress(100);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{bytes_to_lower_hex, choose_staging_path};
    use crate::github_release_checker::InstallVariant;
    use sha2::{Digest, Sha256};
    use tempfile::tempdir;

    #[test]
    fn chooses_writable_dir_for_portable_and_temp_for_nsis() {
        let dir = tempdir().expect("tempdir");
        let exe_path = dir.path().join("ExileCompanionHUD.exe");

        let portable_stage = choose_staging_path(
            InstallVariant::PortableStandalone,
            &exe_path,
            "v0.1.45",
        );
        assert_eq!(
            portable_stage,
            dir.path().join("ExileCompanionHUD-v0.1.45.update.tmp")
        );

        let setup_stage = choose_staging_path(InstallVariant::NsisSetup, &exe_path, "v0.1.45");
        assert_eq!(
            setup_stage,
            std::env::temp_dir().join("ExileCompanionHUD-Setup-v0.1.45.exe")
        );
    }

    #[test]
    fn computes_lowercase_sha256_hex_digest() {
        let digest = Sha256::digest(b"exile-companion");
        let hex = bytes_to_lower_hex(&digest);
        assert_eq!(hex.len(), 64);
        assert!(hex.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')));
    }
}
