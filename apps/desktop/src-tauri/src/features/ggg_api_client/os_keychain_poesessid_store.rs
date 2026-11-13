use keyring::Entry;

const KEYRING_SERVICE: &str = "ExileCompanionHUD";
const KEYRING_USER: &str = "poesessid";

fn entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| format!("Windows Credential Manager unavailable: {e}"))
}

pub fn store_poesessid(raw_value: &str) -> Result<(), String> {
    let trimmed = raw_value.trim();
    if trimmed.is_empty() {
        return Err("POESESSID value cannot be empty.".to_string());
    }
    entry()?
        .set_password(trimmed)
        .map_err(|e| format!("Failed to store POESESSID in OS keychain: {e}"))
}

pub fn has_stored_poesessid() -> bool {
    entry()
        .ok()
        .and_then(|e| e.get_password().ok())
        .map(|v| !v.is_empty())
        .unwrap_or(false)
}

pub fn delete_poesessid() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to clear POESESSID from OS keychain: {e}")),
    }
}

/// Crate-internal reader so POESESSID never crosses IPC to JS or web transports.
pub(crate) fn load_poesessid_internal() -> Option<String> {
    entry()
        .ok()
        .and_then(|e| e.get_password().ok())
        .filter(|v| !v.trim().is_empty())
}
