// Opt-in diagnostics for local performance runs; no session/player data is recorded.
export function measureQueue<T>(phase: string, operation: () => T): T {
  if (typeof window === "undefined" || !Object.hasOwn(window, "queuePerf")) return operation();
  const start = performance.now();
  try { return operation(); }
  finally { performance.measure(`queue:${phase}`, { start, end: performance.now() }); }
}
