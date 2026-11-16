use serde::Serialize;
use serde_json::Value;
use urlencoding::encode;

use crate::character_window_http_poller::parse_retry_after_ms;

/// Normalizes account names (`Name-1234` -> `Name#1234`, trimmed) without altering case.
pub fn normalize_ggg_account_name(raw: &str) -> String {
    let trimmed = raw.trim();
    let bytes = trimmed.as_bytes();
    if bytes.len() > 5 {
        let split_idx = bytes.len() - 5;
        if bytes[split_idx] == b'-' && bytes[split_idx + 1..].iter().all(|b| b.is_ascii_digit()) {
            return format!("{}#{}", &trimmed[..split_idx], &trimmed[split_idx + 1..]);
        }
    }
    trimmed.to_string()
}

/// Builds the public PC `character-window/get-characters` URL for a PoE account.
pub fn build_get_characters_url(account_name: &str) -> String {
    let normalized = normalize_ggg_account_name(account_name);
    format!(
        "https://www.pathofexile.com/character-window/get-characters?accountName={}&realm=pc",
        encode(&normalized)
    )
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GggAccountCharacterEntry {
    pub name: String,
    pub class: String,
    pub league: String,
    pub level: u32,
    pub last_login_time: Option<u64>,
    pub last_active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountCharactersResponse {
    pub ok: bool,
    pub status_code: u16,
    pub normalized_account: String,
    pub throttled_ms: Option<u64>,
    pub error: Option<String>,
    pub characters: Vec<GggAccountCharacterEntry>,
}

/// Parses a raw GGG `get-characters` JSON array into normalized roster entries.
pub fn parse_characters_payload(val: &Value) -> Vec<GggAccountCharacterEntry> {
    let Some(items) = val.as_array() else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let name = item.get("name")?.as_str()?.trim();
            if name.is_empty() {
                return None;
            }
            let class = item
                .get("class")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("Unknown")
                .to_string();
            let league = item
                .get("league")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("Standard")
                .to_string();
            let level = item
                .get("level")
                .and_then(|v| v.as_u64())
                .and_then(|n| u32::try_from(n).ok())
                .unwrap_or(1);
            let last_login_time = item.get("lastLoginTime").and_then(|v| v.as_u64());
            let last_active = item
                .get("lastActive")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            Some(GggAccountCharacterEntry {
                name: name.to_string(),
                class,
                league,
                level,
                last_login_time,
                last_active,
            })
        })
        .collect()
}

fn error_response(
    status_code: u16,
    normalized_account: String,
    throttled_ms: Option<u64>,
    error: impl Into<String>,
) -> AccountCharactersResponse {
    AccountCharactersResponse {
        ok: false,
        status_code,
        normalized_account,
        throttled_ms,
        error: Some(error.into()),
        characters: Vec::new(),
    }
}

#[tauri::command]
pub async fn fetch_account_characters(
    account_name: String,
) -> Result<AccountCharactersResponse, String> {
    let normalized = normalize_ggg_account_name(&account_name);
    if normalized.is_empty() {
        return Ok(error_response(
            400,
            normalized,
            None,
            "Enter AccountName#1234 first",
        ));
    }

    let client = match reqwest::Client::builder()
        .user_agent("ExileRelay/0.1 (Windows Desktop Tray Host; contact: W.back93@gmail.com)")
        .timeout(std::time::Duration::from_secs(12))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(error_response(
                0,
                normalized,
                None,
                format!("HTTP client init failed: {e}"),
            ));
        }
    };

    let url = build_get_characters_url(&normalized);
    let res = match client
        .get(url)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(error_response(
                503,
                normalized,
                None,
                format!("GGG get-characters request error: {e}"),
            ));
        }
    };

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let retry_ms = parse_retry_after_ms(res.headers());
        let msg = match status {
            401 | 403 => "Account profile is private or AccountName#1234 was not found".to_string(),
            404 => "AccountName#1234 was not found".to_string(),
            429 => "GGG API rate limit (HTTP 429) — wait a moment and retry".to_string(),
            _ => format!("GGG API get-characters HTTP {status}"),
        };
        return Ok(error_response(status, normalized, retry_ms, msg));
    }

    let json_val = match res.json::<Value>().await {
        Ok(v) => v,
        Err(e) => {
            return Ok(error_response(
                502,
                normalized,
                None,
                format!("Failed to parse GGG character list: {e}"),
            ));
        }
    };

    let characters = parse_characters_payload(&json_val);
    Ok(AccountCharactersResponse {
        ok: true,
        status_code: status,
        normalized_account: normalized,
        throttled_ms: None,
        error: None,
        characters,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        build_get_characters_url, normalize_ggg_account_name, parse_characters_payload,
        GggAccountCharacterEntry,
    };
    use serde_json::json;

    #[test]
    fn normalizes_trailing_dash_discriminator_to_hash() {
        assert_eq!(normalize_ggg_account_name("  SrLimao-1234 "), "SrLimao#1234");
        assert_eq!(normalize_ggg_account_name("PeakingDuck#4718"), "PeakingDuck#4718");
        assert_eq!(normalize_ggg_account_name("Legacy-Name"), "Legacy-Name");
        assert_eq!(normalize_ggg_account_name("LegacyName"), "LegacyName");
    }

    #[test]
    fn builds_encoded_get_characters_url() {
        let url = build_get_characters_url("SrLimao-1234");
        assert_eq!(
            url,
            "https://www.pathofexile.com/character-window/get-characters?accountName=SrLimao%231234&realm=pc"
        );
    }

    #[test]
    fn parses_public_get_characters_json_entries() {
        let payload = json!([
            {
                "name": "TheRealSlimDucky",
                "realm": "pc",
                "class": "Juggernaut",
                "league": "Standard",
                "level": 100,
                "lastLoginTime": 1637139787,
                "pinnable": false
            },
            {
                "name": "LeagueRunner",
                "class": "Elementalist",
                "league": "HC SSF Covens",
                "level": 68,
                "lastActive": true
            },
            {
                "name": ""
            }
        ]);
        let parsed = parse_characters_payload(&payload);
        assert_eq!(
            parsed,
            vec![
                GggAccountCharacterEntry {
                    name: "TheRealSlimDucky".to_string(),
                    class: "Juggernaut".to_string(),
                    league: "Standard".to_string(),
                    level: 100,
                    last_login_time: Some(1637139787),
                    last_active: false,
                },
                GggAccountCharacterEntry {
                    name: "LeagueRunner".to_string(),
                    class: "Elementalist".to_string(),
                    league: "HC SSF Covens".to_string(),
                    level: 68,
                    last_login_time: None,
                    last_active: true,
                }
            ]
        );
    }
}
