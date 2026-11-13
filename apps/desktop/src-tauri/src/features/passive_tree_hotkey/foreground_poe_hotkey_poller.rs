use std::sync::{Arc, Mutex};

/// Maps a user-facing key label ("P", "T", "TAB", "F1".."F12", "OFF") to a Win32 virtual key code.
pub fn parse_hotkey_vk(label: &str) -> Option<u16> {
    let norm = label.trim().to_ascii_uppercase();
    if norm.is_empty() || norm == "OFF" || norm == "NONE" || norm == "DISABLED" {
        return None;
    }
    if norm == "TAB" {
        return Some(0x09);
    }
    if norm == "SPACE" {
        return Some(0x20);
    }
    if let Some(rest) = norm.strip_prefix('F') {
        if let Ok(num) = rest.parse::<u16>() {
            if (1..=12).contains(&num) {
                return Some(0x70 + (num - 1));
            }
        }
    }
    let bytes = norm.as_bytes();
    if bytes.len() == 1 {
        let ch = bytes[0];
        if ch.is_ascii_uppercase() || ch.is_ascii_digit() {
            return Some(ch as u16);
        }
    }
    None
}

/// Edge-triggered foreground hotkey state machine with chat-typing and Esc/Space guards.
#[derive(Debug, Clone)]
pub struct PassiveTreeHotkeyTracker {
    hotkey_vk: Option<u16>,
    tree_open: bool,
    chat_open: bool,
    prev_hotkey_down: bool,
    prev_enter_down: bool,
    prev_esc_down: bool,
    prev_space_down: bool,
}

impl Default for PassiveTreeHotkeyTracker {
    fn default() -> Self {
        Self {
            hotkey_vk: Some(b'P' as u16),
            tree_open: false,
            chat_open: false,
            prev_hotkey_down: false,
            prev_enter_down: false,
            prev_esc_down: false,
            prev_space_down: false,
        }
    }
}

impl PassiveTreeHotkeyTracker {
    pub fn set_hotkey_label(&mut self, label: &str) -> bool {
        let next = parse_hotkey_vk(label);
        self.hotkey_vk = next;
        self.prev_hotkey_down = false;
        next.is_some()
    }

    pub fn hotkey_vk(&self) -> Option<u16> {
        self.hotkey_vk
    }

    pub fn is_tree_open(&self) -> bool {
        self.tree_open
    }

    pub fn set_tree_open(&mut self, open: bool) -> bool {
        if self.tree_open == open {
            return false;
        }
        self.tree_open = open;
        true
    }

    /// Evaluates one poll tick and returns `Some(next_open)` only on a state change.
    pub fn step(
        &mut self,
        is_poe_foreground: bool,
        hotkey_down: bool,
        enter_down: bool,
        esc_down: bool,
        space_down: bool,
        modifier_down: bool,
    ) -> Option<bool> {
        if !is_poe_foreground {
            self.prev_hotkey_down = false;
            self.prev_enter_down = false;
            self.prev_esc_down = false;
            self.prev_space_down = false;
            self.chat_open = false;
            return None;
        }

        let hotkey_edge = hotkey_down && !self.prev_hotkey_down;
        let enter_edge = enter_down && !self.prev_enter_down;
        let esc_edge = esc_down && !self.prev_esc_down;
        let space_edge = space_down && !self.prev_space_down;

        self.prev_hotkey_down = hotkey_down;
        self.prev_enter_down = enter_down;
        self.prev_esc_down = esc_down;
        self.prev_space_down = space_down;

        if esc_edge {
            if self.chat_open {
                self.chat_open = false;
                return None;
            }
            if self.tree_open {
                self.tree_open = false;
                return Some(false);
            }
            return None;
        }

        if enter_edge {
            self.chat_open = !self.chat_open;
            return None;
        }

        if self.chat_open || modifier_down {
            return None;
        }

        if space_edge && self.tree_open {
            self.tree_open = false;
            return Some(false);
        }

        if hotkey_edge && self.hotkey_vk.is_some() {
            self.tree_open = !self.tree_open;
            return Some(self.tree_open);
        }

        None
    }
}

#[cfg(target_os = "windows")]
fn is_pid_foreground(target_pid: u32) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    if target_pid == 0 {
        return false;
    }
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }
        let mut fg_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut fg_pid);
        fg_pid == target_pid
    }
}

#[cfg(target_os = "windows")]
fn is_vk_pressed(vk: u16) -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
}

/// Polls foreground PoE window key edges without injecting hooks or reading game memory.
#[cfg(target_os = "windows")]
pub fn poll_foreground_poe_hotkey(
    tracker: &Arc<Mutex<PassiveTreeHotkeyTracker>>,
    target_pid: u32,
) -> Option<bool> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        VK_CONTROL, VK_ESCAPE, VK_MENU, VK_RETURN, VK_SHIFT, VK_SPACE,
    };

    let fg = is_pid_foreground(target_pid);
    if !fg {
        if let Ok(mut guard) = tracker.lock() {
            return guard.step(false, false, false, false, false, false);
        }
        return None;
    }

    let hotkey_vk = tracker.lock().ok().and_then(|g| g.hotkey_vk());
    let hotkey_down = hotkey_vk.map(is_vk_pressed).unwrap_or(false);
    let enter_down = is_vk_pressed(VK_RETURN);
    let esc_down = is_vk_pressed(VK_ESCAPE);
    let space_down = is_vk_pressed(VK_SPACE);
    let modifier_down =
        is_vk_pressed(VK_CONTROL) || is_vk_pressed(VK_MENU) || is_vk_pressed(VK_SHIFT);

    if let Ok(mut guard) = tracker.lock() {
        return guard.step(
            true,
            hotkey_down,
            enter_down,
            esc_down,
            space_down,
            modifier_down,
        );
    }
    None
}

#[cfg(not(target_os = "windows"))]
pub fn poll_foreground_poe_hotkey(
    _tracker: &Arc<Mutex<PassiveTreeHotkeyTracker>>,
    _target_pid: u32,
) -> Option<bool> {
    None
}

#[cfg(test)]
mod tests {
    use super::{parse_hotkey_vk, PassiveTreeHotkeyTracker};

    #[test]
    fn parses_expected_hotkeys() {
        assert_eq!(parse_hotkey_vk("p"), Some(b'P' as u16));
        assert_eq!(parse_hotkey_vk("F4"), Some(0x73));
        assert_eq!(parse_hotkey_vk("Tab"), Some(0x09));
        assert_eq!(parse_hotkey_vk("off"), None);
    }

    #[test]
    fn toggles_on_hotkey_and_suppresses_chat_or_modifiers() {
        let mut t = PassiveTreeHotkeyTracker::default();
        assert_eq!(t.step(true, true, false, false, false, false), Some(true));
        // Holding key across ticks does not re-toggle
        assert_eq!(t.step(true, true, false, false, false, false), None);
        assert_eq!(t.step(true, false, false, false, false, false), None);
        // Ctrl+P / Alt+P ignored
        assert_eq!(t.step(true, true, false, false, false, true), None);
        assert_eq!(t.step(true, false, false, false, false, false), None);
        // Escape closes open tree
        assert_eq!(t.step(true, false, false, true, false, false), Some(false));
        assert_eq!(t.step(true, false, false, false, false, false), None);
        // Chat Enter suppresses P until Enter closes chat
        assert_eq!(t.step(true, false, true, false, false, false), None);
        assert_eq!(t.step(true, true, false, false, false, false), None);
        assert_eq!(t.step(true, false, false, false, false, false), None);
        assert_eq!(t.step(true, false, true, false, false, false), None);
        assert_eq!(t.step(true, true, false, false, false, false), Some(true));
        // Alt-tab keeps tree open; Space inside PoE closes it
        assert_eq!(t.step(false, false, false, false, false, false), None);
        assert!(t.is_tree_open());
        assert_eq!(t.step(true, false, false, false, true, false), Some(false));
    }
}
