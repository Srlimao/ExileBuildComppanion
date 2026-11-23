import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && window.getComputedStyle(el).display !== "none",
  );
}

interface UseAccessibleDialogOptions {
  open: boolean;
  onClose: () => void;
}

/**
 * Traps Tab focus within an open modal/drawer, handles Escape, locks body scroll,
 * and restores focus to the trigger control upon closing.
 */
export function useAccessibleDialog({ open, onClose }: UseAccessibleDialogOptions): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === "undefined" || typeof window === "undefined") return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const focusable = getFocusableElements(dialog);
      (focusable[0] ?? dialog).focus({ preventScroll: true });
    }

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCloseRef.current();
        return;
      }
      if (ev.key !== "Tab" || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        ev.preventDefault();
        dialogRef.current.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (ev.shiftKey) {
        if (active === first || !dialogRef.current.contains(active) || active === dialogRef.current) {
          ev.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || !dialogRef.current.contains(active)) {
        ev.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return dialogRef;
}
