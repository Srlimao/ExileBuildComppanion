use serde::Serialize;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use urlencoding::encode;

use super::os_keychain_poesessid_store::load_poesessid_internal;

pub const DEFAULT_COOLDOWN_MS: u64 = 45_000;
const BACKOFF_SCHEDULE_MS: &[u64] = &[60_000, 120_000, 300_000];

pub fn build_character_window_url(endpoint: &str, account_name: &str, character_name: &str) -> String {
    format!(
        "https://www.pathofexile.com/character-window/{}?accountName={}&character={}",
        endpoint,
        encode(account_name.trim()),
        encode(character_name.trim())
    )
}

pub fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug, Default)]
pub struct CircuitBreakerState {
    last_attempt_at_ms: Option<u64>,
    consecutive_failures: u32,
    backoff_until_ms: Option<u64>,
}

impl CircuitBreakerState {
    pub fn can_poll(&self, now_ms: u64, force: bool) -> Result<(), u64> {
        if let Some(until) = self.backoff_until_ms {
            if now_ms < until {
                return Err(until - now_ms);
            }
        }
        if !force {
            if let Some(last) = self.last_attempt_at_ms {
                let elapsed = now_ms.saturating_sub(last);
                if elapsed < DEFAULT_COOLDOWN_MS {
                    return Err(DEFAULT_COOLDOWN_MS - elapsed);
                }
            }
        }
        Ok(())
    }

    pub fn record_success(&mut self, now_ms: u64) {
        self.last_attempt_at_ms = Some(now_ms);
        self.consecutive_failures = 0;
        self.backoff_until_ms = None;
    }

    pub fn record_failure(&mut self, now_ms: u64, _status_code: u16) -> u64 {
        self.last_attempt_at_ms = Some(now_ms);
        let idx = (self.consecutive_failures as usize).min(BACKOFF_SCHEDULE_MS.len() - 1);
        let delay = BACKOFF_SCHEDULE_MS[idx];
        self.consecutive_failures = self.consecutive_failures.saturating_add(1);
        self.backoff_until_ms = Some(now_ms + delay);
        delay
    }

    pub fn reset(&mut self) {
        self.last_attempt_at_ms = None;
        self.consecutive_failures = 0;
        self.backoff_until_ms = None;
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterPollResponse {
    pub ok: bool,
    pub status_code: u16,
    pub used_poesessid: bool,
    pub throttled_ms: Option<u64>,
    pub error: Option<String>,
    pub items_json: Option<Value>,
    pub passives_json: Option<Value>,
}

pub async fn execute_character_window_fetch(
    account_name: &str,
    character_name: &str,
    use_poesessid: bool,
) -> CharacterPollResponse {
    let items_url = build_character_window_url("get-items", account_name, character_name);
    let passives_url = build_character_window_url("get-passive-skills", account_name, character_name);

    let client = match reqwest::Client::builder()
        .user_agent("ExileRelay/0.1 (Windows Desktop Tray Host; contact: W.back93@gmail.com)")
        .timeout(std::time::Duration::from_secs(12))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return CharacterPollResponse {
                ok: false,
                status_code: 0,
                used_poesessid: false,
                throttled_ms: None,
                error: Some(format!("HTTP client init failed: {e}")),
                items_json: None,
                passives_json: None,
            };
        }
    };

    let sess_cookie = if use_poesessid {
        load_poesessid_internal()
    } else {
        None
    };
    let used_sess = sess_cookie.is_some();

    let send_get = |url: String| {
        let mut req = client.get(url);
        if let Some(ref val) = sess_cookie {
            req = req.header("Cookie", format!("POESESSID={val}"));
        }
        req.send()
    };

    let items_res = match send_get(items_url).await {
        Ok(r) => r,
        Err(e) => {
            return CharacterPollResponse {
                ok: false,
                status_code: 503,
                used_poesessid: used_sess,
                throttled_ms: None,
                error: Some(format!("GGG get-items request error: {e}")),
                items_json: None,
                passives_json: None,
            };
        }
    };

    let status = items_res.status().as_u16();
    if !items_res.status().is_success() {
        return CharacterPollResponse {
            ok: false,
            status_code: status,
            used_poesessid: used_sess,
            throttled_ms: None,
            error: Some(format!("GGG API get-items HTTP {status}")),
            items_json: None,
            passives_json: None,
        };
    }

    let items_json = items_res.json::<Value>().await.ok();
    let passives_res = send_get(passives_url).await.ok();
    let passives_json = match passives_res {
        Some(r) if r.status().is_success() => r.json::<Value>().await.ok(),
        _ => None,
    };

    CharacterPollResponse {
        ok: true,
        status_code: 200,
        used_poesessid: used_sess,
        throttled_ms: None,
        error: None,
        items_json,
        passives_json,
    }
}

#[cfg(test)]
mod tests {
    use super::{build_character_window_url, CircuitBreakerState, DEFAULT_COOLDOWN_MS};

    #[test]
    fn encodes_account_discriminator_as_percent_23() {
        let url = build_character_window_url("get-items", "SrLimao#1234", "ExileRunner");
        assert!(url.contains("accountName=SrLimao%231234"));
        assert!(!url.contains("accountName=SrLimao#1234"));
    }

    #[test]
    fn enforces_45s_cooldown_and_exponential_circuit_breaker_backoff() {
        let mut cb = CircuitBreakerState::default();
        assert!(cb.can_poll(100_000, false).is_ok());

        cb.record_success(100_000);
        assert_eq!(cb.can_poll(110_000, false), Err(DEFAULT_COOLDOWN_MS - 10_000));
        assert!(cb.can_poll(145_000, false).is_ok());

        // 429 exponential backoff: 60s -> 120s -> 300s
        let d1 = cb.record_failure(200_000, 429);
        assert_eq!(d1, 60_000);
        assert_eq!(cb.can_poll(230_000, true), Err(30_000));

        let d2 = cb.record_failure(260_000, 429);
        assert_eq!(d2, 120_000);

        let d3 = cb.record_failure(380_000, 503);
        assert_eq!(d3, 300_000);

        let d4 = cb.record_failure(680_000, 503);
        assert_eq!(d4, 300_000);

        cb.record_success(985_000);
        assert!(cb.can_poll(985_000 + DEFAULT_COOLDOWN_MS, false).is_ok());
    }
}
