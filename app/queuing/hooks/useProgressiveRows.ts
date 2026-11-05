import { startTransition, useEffect, useState } from "react";

const BATCH_SIZE = 16;
// Mount all database rows, in small interruptible batches. This keeps the first
// dialog paint and typing responsive without pagination or recycling DOM rows.
export function useProgressiveRows<T>(rows: T[], enabled = true) {
  const [progress, setProgress] = useState({ rows, count: BATCH_SIZE });
  const count = progress.rows === rows ? progress.count : BATCH_SIZE;
  useEffect(() => {
    if (!enabled || count >= rows.length) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timeout = setTimeout(() => startTransition(() => {
        setProgress({ rows, count: Math.min(count + BATCH_SIZE, rows.length) });
      }), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [rows, count, enabled]);
  return rows.slice(0, count);
}
