// Recently-viewed is purely a client-side convenience (localStorage) — it
// has no server counterpart and no accuracy claim to protect, unlike
// ratings/bestseller labels elsewhere in this codebase.

const STORAGE_KEY = "stia:recently-viewed";
const MAX_ITEMS = 8;

export function recordRecentlyViewed(handle: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecentlyViewedHandles();
    const next = [handle, ...existing.filter((h) => h !== handle)].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private browsing, disabled) — non-critical feature, fail silently.
  }
}

export function readRecentlyViewedHandles(excludeHandle?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const handles: unknown = JSON.parse(raw);
    if (!Array.isArray(handles)) return [];
    return handles.filter((h): h is string => typeof h === "string" && h !== excludeHandle);
  } catch {
    return [];
  }
}
