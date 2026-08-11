// Cookie-consent choice, purely client-side (localStorage) — same external
// store shape as wishlist-storage.ts, for the same reasons: read via
// useSyncExternalStore so there's no SSR/hydration mismatch (server has no
// localStorage) and no "read localStorage in an effect" lint violation.
// getSnapshot/getServerSnapshot must keep returning stable/cached
// references — a fresh value each call is a real infinite-render bug with
// useSyncExternalStore, not a style choice.

export type ConsentChoice = "accepted" | "rejected" | null;

const STORAGE_KEY = "stia:analytics-consent";

let cachedRaw: string | null = null;
let cachedChoice: ConsentChoice = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): ConsentChoice {
  return raw === "accepted" || raw === "rejected" ? raw : null;
}

export function getConsentSnapshot(): ConsentChoice {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedChoice = parse(raw);
  }
  return cachedChoice;
}

// Server has no localStorage — "no choice yet" is the correct, honest
// server-rendered state; useSyncExternalStore reconciles to the real
// client snapshot right after hydration. `null` is a stable primitive, no
// caching needed the way the array-returning wishlist store needs it.
export function getConsentServerSnapshot(): ConsentChoice {
  return null;
}

export function subscribeConsent(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setConsentChoice(choice: "accepted" | "rejected"): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private browsing, disabled) — non-critical, fail silently.
  }
  cachedRaw = choice;
  cachedChoice = choice;
  listeners.forEach((listener) => listener());
}
