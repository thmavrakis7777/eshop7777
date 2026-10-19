"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCartUI } from "@/components/cart/CartUIProvider";
import type { Cart } from "@/lib/types";

type SessionContextValue = {
  /** null until the first /api/session answer arrives. */
  isLoggedIn: boolean | null;
  /** Re-read cart and sign-in state, e.g. right after login or an order. */
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionAnswer = { cart: Cart | null; isLoggedIn: boolean; readAt: number };

// Routes where the server changes the session or the cart without the
// browser being told: logout (a plain form post that redirects to "/"),
// account pages, and checkout. Leaving one re-reads the session.
const SESSION_CHANGING_PREFIXES = ["/logariasmos", "/checkout"];
const inSessionArea = (path: string) => SESSION_CHANGING_PREFIXES.some((p) => path.startsWith(p));

/** The /api/session answer, or null when it can't be had right now. */
async function fetchSession(): Promise<SessionAnswer | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    return res.ok ? ((await res.json()) as SessionAnswer) : null;
  } catch {
    // Offline or a deploy in progress: keep what we have. The next trigger
    // (or a reload) asks again.
    return null;
  }
}

/**
 * The visitor's cart and sign-in state, read in the browser from
 * /api/session instead of in the storefront layout.
 *
 * Why: a layout that reads cookies renders every page per request, so the
 * shop could never be cached (PAGE_CACHING_SPEC.md, B2). The layout now
 * renders the same for everyone, and this asks once when the shop first
 * loads. The layout survives client-side navigation, so that is once per
 * visit, not once per page.
 *
 * It re-asks:
 *   - when someone calls refreshSession() — login, registration, Google
 *     sign-in and a placed order do, because each changes the cart
 *     (guest-cart merge, order) or the sign-in state on the server;
 *   - when the visitor leaves the account area or checkout, which covers
 *     logout (a plain <form action> that redirects home) without wiring a
 *     callback through a Server Component.
 *
 * The cart goes into CartUIProvider through receiveCart, so the newest
 * snapshot still wins (lib/cart-snapshot.ts). One extra rule: an answer of
 * "no cart" that was read BEFORE the browser's current cart was fetched is
 * stale — an add-to-cart created the cart while this request was in
 * flight — and must not wipe it. newerCart alone can't tell, because a null
 * carries no timestamp; `readAt` is that timestamp.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { cart, receiveCart } = useCartUI();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // The latest cart, read inside the async callback below without making
  // refreshSession change identity on every cart edit.
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Fetching and applying are two steps so the effects below can start the
  // request and apply its answer in a `.then`, the same shape as
  // WishlistProvider's effect: state only ever changes after the response.
  const applySession = useCallback(
    (answer: SessionAnswer) => {
      setIsLoggedIn(answer.isLoggedIn);
      const current = cartRef.current;
      if (answer.cart === null && current && current.fetchedAt > answer.readAt) return;
      receiveCart(answer.cart);
    },
    [receiveCart]
  );

  const refreshSession = useCallback(async () => {
    const answer = await fetchSession();
    if (answer) applySession(answer);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    fetchSession().then((answer) => {
      if (answer && !cancelled) applySession(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // An effect, not the render-time pathname check CartUIProvider uses for
  // its drawer: this one starts a network request, which must not run
  // during render.
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;
    if (previous === pathname || !inSessionArea(previous) || inSessionArea(pathname)) return;
    fetchSession().then((answer) => {
      if (answer) applySession(answer);
    });
  }, [pathname, applySession]);

  return <SessionContext.Provider value={{ isLoggedIn, refreshSession }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
