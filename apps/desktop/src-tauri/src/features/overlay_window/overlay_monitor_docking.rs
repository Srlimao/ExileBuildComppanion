use tauri::AppHandle;

use crate::overlay_config_disk_store::OverlayBounds;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

const DEFAULT_WIDTH: u32 = 380;
const DEFAULT_CORNER_HEIGHT: u32 = 520;
const MIN_WIDTH: u32 = 300;
const MIN_HEIGHT: u32 = 240;
const EDGE_MARGIN: i32 = 12;

/// Computes snapped overlay bounds inside a monitor's work area for one of the 6 dock presets.
pub fn compute_dock_bounds(
    monitor: MonitorRect,
    preset: &str,
    preferred_size: Option<(u32, u32)>,
) -> OverlayBounds {
    let max_w = monitor.width.saturating_sub((EDGE_MARGIN * 2) as u32).max(MIN_WIDTH);
    let max_h = monitor.height.saturating_sub((EDGE_MARGIN * 2) as u32).max(MIN_HEIGHT);

    let (pref_w, pref_h) = preferred_size.unwrap_or((DEFAULT_WIDTH, DEFAULT_CORNER_HEIGHT));
    let width = pref_w.clamp(MIN_WIDTH, max_w);
    let corner_height = pref_h.clamp(MIN_HEIGHT, max_h);
    let strip_height = ((monitor.height as f32 * 0.72) as u32).clamp(420.min(max_h), max_h);

    let left_x = monitor.x + EDGE_MARGIN;
    let right_x = monitor.x + monitor.width as i32 - width as i32 - EDGE_MARGIN;
    let top_y = monitor.y + EDGE_MARGIN;
    let bottom_y = monitor.y + monitor.height as i32 - corner_height as i32 - EDGE_MARGIN;
    let center_y = monitor.y + ((monitor.height as i32 - strip_height as i32) / 2).max(EDGE_MARGIN);

    match preset {
        "top-right" => OverlayBounds { x: right_x, y: top_y, width, height: corner_height },
        "bottom-left" => OverlayBounds { x: left_x, y: bottom_y, width, height: corner_height },
        "bottom-right" => OverlayBounds { x: right_x, y: bottom_y, width, height: corner_height },
        "left-edge" => OverlayBounds { x: left_x, y: center_y, width, height: strip_height },
        "right-edge" => OverlayBounds { x: right_x, y: center_y, width, height: strip_height },
        _ => OverlayBounds { x: left_x, y: top_y, width, height: corner_height },
    }
}

/// Ensures free-floating bounds keep valid dimensions and remain inside an attached monitor.
pub fn clamp_bounds_to_monitors(bounds: OverlayBounds, monitors: &[MonitorRect]) -> OverlayBounds {
    if monitors.is_empty() {
        return OverlayBounds {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width.max(MIN_WIDTH),
            height: bounds.height.max(MIN_HEIGHT),
        };
    }

    let cx = bounds.x + (bounds.width as i32 / 2);
    let cy = bounds.y + (bounds.height as i32 / 2);
    let target = monitors
        .iter()
        .copied()
        .min_by_key(|m| {
            let mx = (m.x + m.width as i32 / 2) as i64;
            let my = (m.y + m.height as i32 / 2) as i64;
            let dx = mx - cx as i64;
            let dy = my - cy as i64;
            dx * dx + dy * dy
        })
        .unwrap_or(monitors[0]);

    let width = bounds.width.clamp(MIN_WIDTH, target.width.max(MIN_WIDTH));
    let height = bounds.height.clamp(MIN_HEIGHT, target.height.max(MIN_HEIGHT));
    let max_x = target.x + (target.width as i32 - width as i32).max(0);
    let max_y = target.y + (target.height as i32 - height as i32).max(0);

    OverlayBounds {
        x: bounds.x.clamp(target.x, max_x),
        y: bounds.y.clamp(target.y, max_y),
        width,
        height,
    }
}

#[cfg(target_os = "windows")]
fn find_pid_window_center(target_pid: u32) -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowRect, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct SearchCtx {
        target_pid: u32,
        best_area: i64,
        center: Option<(i32, i32)>,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut SearchCtx);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid != ctx.target_pid {
            return 1;
        }
        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(hwnd, &mut rect) != 0 {
            let w = (rect.right - rect.left) as i64;
            let h = (rect.bottom - rect.top) as i64;
            if w > 200 && h > 200 && w * h > ctx.best_area {
                ctx.best_area = w * h;
                ctx.center = Some(((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2));
            }
        }
        1
    }

    if target_pid == 0 {
        return None;
    }
    let mut ctx = SearchCtx { target_pid, best_area: 0, center: None };
    unsafe {
        EnumWindows(Some(enum_proc), (&mut ctx as *mut SearchCtx) as LPARAM);
    }
    ctx.center
}

#[cfg(not(target_os = "windows"))]
fn find_pid_window_center(_target_pid: u32) -> Option<(i32, i32)> {
    None
}

pub fn collect_monitor_work_rects(app: &AppHandle) -> Vec<MonitorRect> {
    let mut rects = Vec::new();
    if let Ok(monitors) = app.available_monitors() {
        for m in monitors {
            let wa = m.work_area();
            rects.push(MonitorRect {
                x: wa.position.x,
                y: wa.position.y,
                width: wa.size.width,
                height: wa.size.height,
            });
        }
    }
    if rects.is_empty() {
        if let Ok(Some(primary)) = app.primary_monitor() {
            let wa = primary.work_area();
            rects.push(MonitorRect {
                x: wa.position.x,
                y: wa.position.y,
                width: wa.size.width,
                height: wa.size.height,
            });
        }
    }
    rects
}

pub fn resolve_target_monitor_rect(app: &AppHandle, poe_pid: u32) -> MonitorRect {
    let rects = collect_monitor_work_rects(app);
    if let Some((cx, cy)) = find_pid_window_center(poe_pid) {
        if let Some(found) = rects.iter().copied().find(|r| {
            cx >= r.x && cx < r.x + r.width as i32 && cy >= r.y && cy < r.y + r.height as i32
        }) {
            return found;
        }
    }
    rects.into_iter().next().unwrap_or(MonitorRect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_all_six_dock_presets_within_work_area() {
        let mon = MonitorRect { x: 1920, y: 0, width: 2560, height: 1400 };
        let tl = compute_dock_bounds(mon, "top-left", None);
        assert_eq!((tl.x, tl.y, tl.width, tl.height), (1932, 12, 380, 520));

        let tr = compute_dock_bounds(mon, "top-right", None);
        assert_eq!(tr.x, 1920 + 2560 - 380 - 12);
        assert_eq!(tr.y, 12);

        let br = compute_dock_bounds(mon, "bottom-right", None);
        assert_eq!(br.x, tr.x);
        assert_eq!(br.y, 1400 - 520 - 12);

        let left_strip = compute_dock_bounds(mon, "left-edge", None);
        assert_eq!(left_strip.x, 1932);
        assert!(left_strip.height > 900);
        assert!(left_strip.y > 0);
    }

    #[test]
    fn clamps_disconnected_monitor_bounds_back_on_screen() {
        let primary = vec![MonitorRect { x: 0, y: 0, width: 1920, height: 1040 }];
        let offscreen = OverlayBounds { x: 3200, y: 1500, width: 120, height: 100 };
        let clamped = clamp_bounds_to_monitors(offscreen, &primary);
        assert_eq!(clamped.width, 300);
        assert_eq!(clamped.height, 240);
        assert_eq!(clamped.x, 1920 - 300);
        assert_eq!(clamped.y, 1040 - 240);
    }
}
