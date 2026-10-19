"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getWishlistServerSnapshot,
  getWishlistSnapshot,
  subscribeWishlist,
  toggleWishlistHandle,
} from "@/lib/wishlist-storage";
import { getWishlistHandlesAction, toggleWishlistItemAction } from "@/lib/actions/wishlist";
import { useSession } from "@/components/session/SessionProvider";

type WishlistContextValue = {
  handles: string[];
  has: (handle: string) => boolean;
  toggle: (handle: string) => void;
  count: number;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Dual-mode: a guest's favorites are localStorage only (unchanged from
 * before), exactly as `wishlist-storage.ts` already implements. A logged-in
 * customer's favorites live server-side (shop.wishlist_item) instead, so
 * they survive a login on a different browser/device — the localStorage
 * store is simply not consulted while `isLoggedIn` is true.
 *
 * Sign-in state comes from SessionProvider (/api/session), not re-derived
 * here. It used to be resolved server-side in the storefront layout, which
 * kept every page from being cached (PAGE_CACHING_SPEC.md). Until the
 * session answers, the visitor is treated as a guest: most visitors are,
 * and their saved favourites then show with no wait at all.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useSession().isLoggedIn === true;
  const localHandles = useSyncExternalStore(subscribeWishlist, getWishlistSnapshot, getWishlistServerSnapshot);
  const [serverHandles, setServerHandles] = useState<string[] | null>(null);

  useEffect(() => {
    // Nothing to fetch while logged out — `handles` below already ignores
    // `serverHandles` in that case, so there's no stale state to clear.
    if (!isLoggedIn) return;
    let cancelled = false;
    getWishlistHandlesAction().then((handles) => {
      if (!cancelled) setServerHandles(handles);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const handles = useMemo(
    () => (isLoggedIn ? (serverHandles ?? []) : localHandles),
    [isLoggedIn, serverHandles, localHandles]
  );
  const has = useCallback((handle: string) => handles.includes(handle), [handles]);

  const toggle = useCallback(
    (handle: string) => {
      if (!isLoggedIn) {
        toggleWishlistHandle(handle);
        return;
      }
      const saved = handles.includes(handle);
      // Optimistic: flip immediately, reconcile from the server's response
      // (same pattern as QuantityStepper) — a favorite toggle should never
      // feel like it's waiting on a network round trip.
      setServerHandles((current) => {
        const base = current ?? [];
        return saved ? base.filter((h) => h !== handle) : [handle, ...base];
      });
      toggleWishlistItemAction(handle, saved).then((result) => {
        if (result.ok) setServerHandles(result.handles);
      });
    },
    [isLoggedIn, handles]
  );

  return (
    <WishlistContext.Provider value={{ handles, has, toggle, count: handles.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
