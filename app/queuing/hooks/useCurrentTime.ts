import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getClockSnapshot, getServerClockSnapshot, subscribeClock } from "../state/clock";
const inactive = () => () => {};

export function useCurrentTime(frozenTime: number | null, enabled = true) {
  const ticking = frozenTime === null && enabled;
  const getSnapshot = useCallback(() => frozenTime ?? getClockSnapshot(), [frozenTime]);
  return useSyncExternalStore(ticking ? subscribeClock : inactive, getSnapshot, getServerClockSnapshot);
}

// CSS-hidden panels and offscreen roster rows should not consume clock updates.
export function useVisibleTime<Element extends HTMLElement = HTMLSpanElement>(frozenTime: number | null, enabled = true) {
  const ref = useRef<Element>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);
  return { ref, currentTime: useCurrentTime(frozenTime, enabled && visible) };
}
