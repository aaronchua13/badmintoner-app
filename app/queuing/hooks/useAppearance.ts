import { useState, useSyncExternalStore } from "react";

export type ColorTheme = "emerald" | "ocean" | "violet";
export type ColorMode = "system" | "light" | "dark";
const key = "badminton_queue_appearance";
const defaults = { color: "emerald" as ColorTheme, mode: "system" as ColorMode };
let cached = "";
let snapshot = defaults;
function read() {
  try {
    const raw = localStorage.getItem(key) ?? "";
    if (raw !== cached) {
      cached = raw;
      const value = raw ? JSON.parse(raw) : defaults;
      snapshot = {
        color: ["emerald", "ocean", "violet"].includes(value?.color) ? value.color : "emerald",
        mode: ["system", "light", "dark"].includes(value?.mode) ? value.mode : "system",
      };
    }
  } catch { /* Keep the last valid preference. */ }
  return snapshot;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("queue-appearance", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("queue-appearance", callback);
  };
}
function subscribeSystem(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useAppearance() {
  const saved = useSyncExternalStore(subscribe, read, () => defaults);
  const [fallback, setFallback] = useState<typeof defaults | null>(null);
  const preference = fallback ?? saved;
  const systemDark = useSyncExternalStore(subscribeSystem,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false);
  const setAppearance = (next: typeof defaults) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setFallback(null);
      window.dispatchEvent(new Event("queue-appearance"));
    } catch { setFallback(next); }
  };
  return { ...preference, dark: preference.mode === "dark" || (preference.mode === "system" && systemDark), setAppearance };
}
