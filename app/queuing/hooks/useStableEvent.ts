import { useCallback, useLayoutEffect, useRef } from "react";

// Stable event identity, with the handler from the latest committed render.
export function useStableEvent<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; });
  return useCallback((...args: Args) => ref.current(...args), []);
}
