// Wishlist is purely a client-side convenience (localStorage), same spirit
// as recently-viewed — no Medusa customer/wishlist entity exists (Medusa
// has no native wishlist module, and this storefront has no customer auth
// system yet, see PRODUCT_CARD_WISHLIST_PDP_SPEC.md §2).
//
// Shaped as a real external store (module-level cache + listener set) so
// WishlistProvider can read it via useSyncExternalStore rather than
// useEffect+useState — avoids both the SSR/hydration mismatch a naive
// "read localStorage on mount" causes (server has no localStorage) and the
// react-hooks/set-state-in-effect lint rule this project enforces
// elsewhere (see SearchBox.tsx). getSnapshot must return a stable/cached
// array reference when nothing changed, or useSyncExternalStore will
// re-render in a loop — that's what the raw-string cache below is for.

const STORAGE_KEY = "stia:wishlist";

let cachedRaw: string | null = null;
let cachedHandles: string[] = [];
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const handles: unknown = JSON.parse(raw);
    return Array.isArray(handles) ? handles.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function getWishlistSnapshot(): string[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedHandles = parse(raw);
  }
  return cachedHandles;
}

// Server has no localStorage — an empty wishlist is the correct, honest
// server-rendered state; useSyncExternalStore reconciles to the real
// client snapshot right after hydration. Must return the *same* reference
// every call (React requires it, same as getSnapshot below) — a fresh `[]`
// literal each time triggers "getServerSnapshot should be cached".
const EMPTY_HANDLES: string[] = [];
export function getWishlistServerSnapshot(): string[] {
  return EMPTY_HANDLES;
}

export function subscribeWishlist(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function toggleWishlistHandle(handle: string): void {
  const current = getWishlistSnapshot();
  const next = current.includes(handle) ? current.filter((h) => h !== handle) : [handle, ...current];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private browsing, disabled) — non-critical feature, fail silently.
  }
  cachedRaw = JSON.stringify(next);
  cachedHandles = next;
  listeners.forEach((listener) => listener());
}
