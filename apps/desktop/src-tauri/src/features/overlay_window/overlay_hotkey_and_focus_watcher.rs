use crate::foreground_poe_hotkey_poller::parse_hotkey_vk;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OverlayTickOutcome {
    pub toggled_enabled: Option<bool>,
    pub toggled_locked: Option<bool>,
    pub desired_visible: bool,
}

#[derive(Debug, Clone)]
pub struct OverlayWatcherState {
    vis_hotkey_vk: Option<u16>,
    lock_hotkey_vk: Option<u16>,
    prev_vis_down: bool,
    prev_lock_down: bool,
}

impl Default for OverlayWatcherState {
    fn default() -> Self {
        Self {
            vis_hotkey_vk: parse_hotkey_vk("F7"),
            lock_hotkey_vk: parse_hotkey_vk("F8"),
            prev_vis_down: false,
            prev_lock_down: false,
        }
    }
}

fn is_function_vk(vk: u16) -> bool {
    (0x70..=0x7B).contains(&vk)
}

impl OverlayWatcherState {
    pub fn sync_hotkeys(&mut self, vis_label: &str, lock_label: &str) {
        let next_vis = parse_hotkey_vk(vis_label);
        if next_vis != self.vis_hotkey_vk {
            self.vis_hotkey_vk = next_vis;
            self.prev_vis_down = false;
        }
        let next_lock = parse_hotkey_vk(lock_label);
        if next_lock != self.lock_hotkey_vk {
            self.lock_hotkey_vk = next_lock;
            self.prev_lock_down = false;
        }
    }

    pub fn vis_hotkey_vk(&self) -> Option<u16> {
        self.vis_hotkey_vk
    }

    pub fn lock_hotkey_vk(&self) -> Option<u16> {
        self.lock_hotkey_vk
    }

    /// Evaluates one poll tick for F7/F8 hotkeys and Alt-Tab auto-visibility.
    #[allow(clippy::too_many_arguments)]
    pub fn step(
        &mut self,
        enabled: bool,
        pin_on_desktop: bool,
        click_through_locked: bool,
        poe_running: bool,
        fg_is_poe: bool,
        fg_is_self: bool,
        vis_down: bool,
        lock_down: bool,
        modifier_down: bool,
    ) -> OverlayTickOutcome {
        let fg_active = fg_is_poe || fg_is_self;
        if !fg_active {
            self.prev_vis_down = false;
            self.prev_lock_down = false;
            return OverlayTickOutcome {
                toggled_enabled: None,
                toggled_locked: None,
                desired_visible: enabled && (pin_on_desktop || !poe_running),
            };
        }

        let vis_edge = vis_down && !self.prev_vis_down;
        let lock_edge = lock_down && !self.prev_lock_down;
        self.prev_vis_down = vis_down;
        self.prev_lock_down = lock_down;

        let can_trigger_vis = fg_is_poe || self.vis_hotkey_vk.map(is_function_vk).unwrap_or(false);
        let can_trigger_lock = fg_is_poe || self.lock_hotkey_vk.map(is_function_vk).unwrap_or(false);

        let mut next_enabled = enabled;
        let mut toggled_enabled = None;
        if vis_edge && !modifier_down && can_trigger_vis && self.vis_hotkey_vk.is_some() {
            next_enabled = !enabled;
            toggled_enabled = Some(next_enabled);
        }

        let mut toggled_locked = None;
        if lock_edge && !modifier_down && can_trigger_lock && next_enabled && self.lock_hotkey_vk.is_some() {
            toggled_locked = Some(!click_through_locked);
        }

        OverlayTickOutcome {
            toggled_enabled,
            toggled_locked,
            desired_visible: next_enabled && (pin_on_desktop || !poe_running || fg_active),
        }
    }
}

#[cfg(target_os = "windows")]
pub fn foreground_focus_flags(poe_pid: u32) -> (bool, bool) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    let self_pid = std::process::id();
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return (false, false);
        }
        let mut fg_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut fg_pid);
        (poe_pid != 0 && fg_pid == poe_pid, fg_pid == self_pid)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn foreground_focus_flags(_poe_pid: u32) -> (bool, bool) {
    (false, false)
}

#[cfg(target_os = "windows")]
fn is_vk_down(vk: u16) -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
}

#[cfg(target_os = "windows")]
pub fn read_hotkey_inputs(vis_vk: Option<u16>, lock_vk: Option<u16>) -> (bool, bool, bool) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{VK_CONTROL, VK_MENU, VK_SHIFT};
    let vis_down = vis_vk.map(is_vk_down).unwrap_or(false);
    let lock_down = lock_vk.map(is_vk_down).unwrap_or(false);
    let modifier_down =
        is_vk_down(VK_CONTROL) || is_vk_down(VK_MENU) || is_vk_down(VK_SHIFT);
    (vis_down, lock_down, modifier_down)
}

#[cfg(not(target_os = "windows"))]
pub fn read_hotkey_inputs(_vis_vk: Option<u16>, _lock_vk: Option<u16>) -> (bool, bool, bool) {
    (false, false, false)
}

#[cfg(test)]
mod tests {
    use super::OverlayWatcherState;

    #[test]
    fn handles_hotkey_edges_and_alt_tab_visibility() {
        let mut watcher = OverlayWatcherState::default();

        // Alt-tabbed away while PoE is running with pin_on_desktop = false -> hidden
        let out_away = watcher.step(true, false, false, true, false, false, false, false, false);
        assert!(!out_away.desired_visible);
        assert_eq!(out_away.toggled_enabled, None);

        // PoE not running with pin_on_desktop = false -> stays visible on desktop
        let out_no_poe = watcher.step(true, false, false, false, false, false, false, false, false);
        assert!(out_no_poe.desired_visible);

        // Alt-tabbed away while PoE is running with pin_on_desktop = true -> stays visible
        let out_pinned = watcher.step(true, true, false, true, false, false, false, false, false);
        assert!(out_pinned.desired_visible);

        // Press F7 in PoE -> disables overlay
        let out_f7 = watcher.step(true, false, false, true, true, false, true, false, false);
        assert_eq!(out_f7.toggled_enabled, Some(false));
        assert!(!out_f7.desired_visible);

        // Holding F7 across ticks does not double-toggle
        let out_hold = watcher.step(false, false, false, true, true, false, true, false, false);
        assert_eq!(out_hold.toggled_enabled, None);

        // Release and press F8 while enabled -> toggles click-through lock
        watcher.step(true, false, false, true, true, false, false, false, false);
        let out_f8 = watcher.step(true, false, false, true, true, false, false, true, false);
        assert_eq!(out_f8.toggled_locked, Some(true));
        assert!(out_f8.desired_visible);

        // Ctrl+F8 modifier ignored
        watcher.step(true, false, true, true, true, false, false, false, false);
        let out_mod = watcher.step(true, false, true, true, true, false, false, true, true);
        assert_eq!(out_mod.toggled_locked, None);
    }
}
