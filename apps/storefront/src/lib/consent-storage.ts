// Cookie-consent choice, purely client-side (localStorage) — same external
// store shape as wishlist-storage.ts, for the same reasons: read via
// useSyncExternalStore so there's no SSR/hydration mismatch (server has no
// localStorage) and no "read localStorage in an effect" lint violation.
// getSnapshot/getServerSnapshot must keep returning stable/cached
// references — a fresh value each call is a real infinite-render bug with
// useSyncExternalStore, not a style choice.
//
// Granular by category rather than one accept/reject flag: "Analytics"
// covers GA4/GTM/Clarity, "Marketing" covers Meta Pixel — see
// AnalyticsScripts.tsx for exactly which script reads which flag. There is
// no separate "Preferences" category: nothing in this codebase sets a
// preference cookie today (no language/currency picker), and inventing a
// toggle with nothing behind it would be exactly the "invented cookie"
// problem the Cookie Policy explicitly promises not to do. Add one here,
// and to the Cookie Policy text, the day something real needs it.
// "Necessary" cookies (cart, login session) aren't part of this store at
// all — they're not optional, so there's nothing to toggle.

export type ConsentCategories = { analytics: boolean; marketing: boolean };
export type ConsentState = ConsentCategories | null; // null = no choice made yet

const STORAGE_KEY = "mavrakishome:cookie-consent";

let cachedRaw: string | null = null;
let cachedState: ConsentState = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): ConsentState {
  if (!raw) return null;
  // Pre-granular sessions stored the literal string "accepted"/"rejected"
  // (old key "stia:analytics-consent") — those never reach this key, so an
  // old value can't appear here at all; a malformed/foreign value is the
  // only other case, treated as "no choice yet" rather than thrown.
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed && typeof parsed === "object" &&
      typeof (parsed as ConsentCategories).analytics === "boolean" &&
      typeof (parsed as ConsentCategories).marketing === "boolean"
    ) {
      return parsed as ConsentCategories;
    }
  } catch {
    // fall through to null
  }
  return null;
}

export function getConsentSnapshot(): ConsentState {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parse(raw);
  }
  return cachedState;
}

// Server has no localStorage — "no choice yet" is the correct, honest
// server-rendered state; useSyncExternalStore reconciles to the real
// client snapshot right after hydration. `null` is a stable primitive, no
// caching needed the way the array-returning wishlist store needs it.
export function getConsentServerSnapshot(): ConsentState {
  return null;
}

export function subscribeConsent(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setConsentChoices(choices: ConsentCategories): void {
  const raw = JSON.stringify(choices);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage unavailable (private browsing, disabled) — non-critical, fail silently.
  }
  cachedRaw = raw;
  cachedState = choices;
  requestSettingsOpen(false);
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// "Reopen settings" signal — an ephemeral (non-persisted) flag, separate
// from the stored choice itself. The footer's "Ρυθμίσεις Cookies" link sets
// this true; ConsentBanner shows itself whenever EITHER this is true OR no
// choice has been stored yet (first visit). Kept as its own tiny store
// rather than folded into ConsentState so "the user asked to see the panel
// again" can never itself be mistaken for "the user chose no consent".
// ---------------------------------------------------------------------------

let settingsOpen = false;
const settingsListeners = new Set<() => void>();

export function getSettingsOpenSnapshot(): boolean {
  return settingsOpen;
}

export function getSettingsOpenServerSnapshot(): boolean {
  return false;
}

export function subscribeSettingsOpen(callback: () => void): () => void {
  settingsListeners.add(callback);
  return () => settingsListeners.delete(callback);
}

export function requestSettingsOpen(open: boolean): void {
  if (settingsOpen === open) return;
  settingsOpen = open;
  settingsListeners.forEach((listener) => listener());
}
