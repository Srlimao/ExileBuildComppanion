import { useEffect, useRef, useState } from "react";
import {
  classifyTouchMoveIntent,
  computeDampedPullDistance,
  isTargetBlockedFromPullRefresh,
  isWindowAtTop,
  PULL_TRIGGER_DISTANCE_PX,
} from "./pull_to_refresh_math.js";

export interface UsePullToRefreshOptions {
  enabled: boolean;
  onRefresh: () => Promise<void> | void;
}

export interface PullToRefreshState {
  pullDistance: number;
  isReady: boolean;
  isRefreshing: boolean;
}

/** Tracks single-finger downward pull gestures from the top of the viewport to trigger PWA refresh. */
export function usePullToRefresh({
  enabled,
  onRefresh,
}: UsePullToRefreshOptions): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const enabledRef = useRef(enabled);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(isRefreshing);
  const pullDistanceRef = useRef(pullDistance);
  enabledRef.current = enabled;
  onRefreshRef.current = onRefresh;
  refreshingRef.current = isRefreshing;
  pullDistanceRef.current = pullDistance;

  const gestureRef = useRef<{
    phase: "idle" | "armed" | "pulling";
    startX: number;
    startY: number;
  }>({
    phase: "idle",
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    if (!enabled) {
      gestureRef.current.phase = "idle";
      if (!refreshingRef.current) setPullDistance(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetGesture = () => {
      gestureRef.current.phase = "idle";
      if (!refreshingRef.current) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || refreshingRef.current) return;
      if (e.touches.length !== 1) {
        resetGesture();
        return;
      }
      if (!isWindowAtTop() || isTargetBlockedFromPullRefresh(e.target)) {
        gestureRef.current.phase = "idle";
        return;
      }
      const touch = e.touches[0]!;
      gestureRef.current = {
        phase: "armed",
        startX: touch.clientX,
        startY: touch.clientY,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const gesture = gestureRef.current;
      if (gesture.phase === "idle" || !enabledRef.current || refreshingRef.current) return;
      if (e.touches.length !== 1 || !isWindowAtTop()) {
        resetGesture();
        return;
      }

      const touch = e.touches[0]!;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (gesture.phase === "armed") {
        const intent = classifyTouchMoveIntent(dx, dy);
        if (intent === "undecided") return;
        if (intent === "cancel") {
          resetGesture();
          return;
        }
        gesture.phase = "pulling";
      }

      if (dy <= 0) {
        resetGesture();
        return;
      }

      if (e.cancelable) e.preventDefault();
      const damped = computeDampedPullDistance(dy);
      pullDistanceRef.current = damped;
      setPullDistance(damped);
    };

    const onTouchEnd = () => {
      const gesture = gestureRef.current;
      if (gesture.phase !== "pulling" || refreshingRef.current) {
        resetGesture();
        return;
      }
      gesture.phase = "idle";
      if (pullDistanceRef.current >= PULL_TRIGGER_DISTANCE_PX) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        pullDistanceRef.current = PULL_TRIGGER_DISTANCE_PX;
        setPullDistance(PULL_TRIGGER_DISTANCE_PX);
        Promise.resolve(onRefreshRef.current()).finally(() => {
          refreshingRef.current = false;
          setIsRefreshing(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        });
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", resetGesture, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", resetGesture);
    };
  }, []);

  return {
    pullDistance,
    isReady: pullDistance >= PULL_TRIGGER_DISTANCE_PX,
    isRefreshing,
  };
}
