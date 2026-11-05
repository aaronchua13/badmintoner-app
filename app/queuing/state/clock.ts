// One wall clock for the entire workspace. No ticks while backgrounded or unused.
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const tick = () => {
  now = Date.now();
  listeners.forEach((listener) => listener());
};
const updateTimer = () => {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  if (listeners.size && !document.hidden) {
    tick();
    timer = setInterval(tick, 1000);
  }
};
export const getClockSnapshot = () => now;
export const getServerClockSnapshot = () => 0;
export function subscribeClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", updateTimer);
    updateTimer();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", updateTimer);
    }
  };
}
