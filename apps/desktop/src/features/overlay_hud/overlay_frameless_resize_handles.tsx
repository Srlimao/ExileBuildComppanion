import { useEffect, useRef } from "react";
import {
  saveOverlayFreeBoundsIpc,
  startOverlayWindowResize,
  type OverlayResizeDirection,
} from "./overlay_types_and_ipc.js";

const EDGE_HANDLES: Array<{ dir: OverlayResizeDirection; className: string }> = [
  { dir: "North", className: "top-0 left-2 right-2 h-1.5 cursor-n-resize" },
  { dir: "South", className: "bottom-0 left-2 right-2 h-1.5 cursor-s-resize" },
  { dir: "West", className: "left-0 top-2 bottom-2 w-1.5 cursor-w-resize" },
  { dir: "East", className: "right-0 top-2 bottom-2 w-1.5 cursor-e-resize" },
  { dir: "NorthWest", className: "top-0 left-0 w-2.5 h-2.5 cursor-nw-resize" },
  { dir: "NorthEast", className: "top-0 right-0 w-2.5 h-2.5 cursor-ne-resize" },
  { dir: "SouthWest", className: "bottom-0 left-0 w-2.5 h-2.5 cursor-sw-resize" },
  { dir: "SouthEast", className: "bottom-0 right-0 w-2.5 h-2.5 cursor-se-resize" },
];

/** Renders invisible perimeter resize handles when the PC overlay is unlocked. */
export function OverlayFramelessResizeHandles({ unlocked }: { unlocked: boolean }) {
  const resizeTimerRef = useRef<number | null>(null);
  const draggingBoundsRef = useRef(false);

  useEffect(() => {
    if (!unlocked) return;
    const scheduleSave = () => {
      if (!draggingBoundsRef.current) return;
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        draggingBoundsRef.current = false;
        void saveOverlayFreeBoundsIpc();
      }, 220);
    };
    window.addEventListener("resize", scheduleSave);
    window.addEventListener("pointerup", scheduleSave);
    return () => {
      window.removeEventListener("resize", scheduleSave);
      window.removeEventListener("pointerup", scheduleSave);
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
    };
  }, [unlocked]);

  if (!unlocked) return null;

  return (
    <>
      {EDGE_HANDLES.map((h) => (
        <div
          key={h.dir}
          role="presentation"
          onPointerDown={(e) => {
            e.preventDefault();
            draggingBoundsRef.current = true;
            void startOverlayWindowResize(h.dir);
          }}
          className={`fixed z-40 ${h.className}`}
        />
      ))}
    </>
  );
}
