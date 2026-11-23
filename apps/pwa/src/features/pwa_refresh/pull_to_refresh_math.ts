export const PULL_DEADZONE_PX = 12;
export const PULL_TRIGGER_DISTANCE_PX = 68;
export const PULL_MAX_DISTANCE_PX = 104;

const BLOCKED_ANCESTOR_SELECTOR = [
  '[data-testid="passive-tree-canvas"]',
  '[data-disable-pull-refresh="true"]',
  '[role="dialog"]',
  ".touch-none",
  "input",
  "textarea",
  "select",
  '[contenteditable="true"]',
].join(", ");

/** Applies exponential resistance past the deadzone up to `PULL_MAX_DISTANCE_PX`. */
export function computeDampedPullDistance(rawDy: number): number {
  if (rawDy <= PULL_DEADZONE_PX) return 0;
  return PULL_MAX_DISTANCE_PX * (1 - Math.exp(-(rawDy - PULL_DEADZONE_PX) / 115));
}

/** Classifies early touch movement into downward pull, cancel, or undecided inside deadzone. */
export function classifyTouchMoveIntent(dx: number, dy: number): "pull" | "cancel" | "undecided" {
  if (Math.abs(dx) < PULL_DEADZONE_PX && Math.abs(dy) < PULL_DEADZONE_PX) {
    return "undecided";
  }
  if (dy > PULL_DEADZONE_PX && dy > Math.abs(dx) * 1.25) {
    return "pull";
  }
  return "cancel";
}

/** Returns true if the touch target is inside an interactive canvas, dialog, or scrolled container. */
export function isTargetBlockedFromPullRefresh(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as HTMLElement;
  if (typeof el.closest === "function" && el.closest(BLOCKED_ANCESTOR_SELECTOR)) {
    return true;
  }

  const docBody = typeof document !== "undefined" ? document.body : null;
  const docEl = typeof document !== "undefined" ? document.documentElement : null;
  let cur: HTMLElement | null = el;
  while (cur && cur !== docBody && cur !== docEl) {
    if (cur.scrollTop > 0 && cur.scrollHeight > cur.clientHeight) {
      if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
        const overflowY = window.getComputedStyle(cur).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") return true;
      } else {
        return true;
      }
    }
    cur = cur.parentElement;
  }

  return false;
}

/** Returns true when the viewport scroll position is at the top of the document. */
export function isWindowAtTop(): boolean {
  if (typeof window === "undefined") return true;
  const docTop = typeof document !== "undefined" ? (document.documentElement?.scrollTop ?? 0) : 0;
  return (window.scrollY || docTop || 0) <= 0;
}
