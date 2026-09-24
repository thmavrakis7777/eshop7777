"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Cart } from "@/lib/types";
import { newerCart } from "@/lib/cart-snapshot";

type ToastState = { message: string } | null;

type CartUIContextValue = {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toast: ToastState;
  showAddedToast: () => void;
  dismissToast: () => void;
  // The one copy of the cart the whole storefront reads — header badge,
  // drawer, /kalathi, /checkout. See CART_STATE_SPEC.md.
  cart: Cart | null;
  // Every server snapshot goes through here (action results, page renders,
  // background refreshes); the newer one wins, see lib/cart-snapshot.ts.
  receiveCart: (incoming: Cart | null) => void;
  // Optimistic local edits only (useCartController's quantity/removal
  // patches). Keeps the snapshot's fetchedAt, so the server's answer to the
  // same edit always replaces it.
  patchCart: (patch: (cart: Cart) => Cart) => void;
};

const CartUIContext = createContext<CartUIContextValue | null>(null);

const TOAST_AUTO_DISMISS_MS = 4000;

export function CartUIProvider({
  initialCart,
  children,
}: {
  // The layout's own getCart(). Also the channel for the rare server
  // actions that still refresh the whole layout (login/logout cart merge,
  // order placed): each of those re-renders the layout with a new snapshot.
  initialCart: Cart | null;
  children: React.ReactNode;
}) {
  // Cart actions used to end in revalidatePath("/", "layout"): every add,
  // +/− or removal re-rendered and re-sent the whole current page (221 KB
  // on a product page) just so the header badge would update, and wiped the
  // router cache so every visible link prefetched again (Speed audit
  // PERF-003/SPD-08). The actions already return the full Cart, so the
  // browser keeps it here instead and every surface reads this copy.
  const [cart, setCart] = useState<Cart | null>(initialCart);
  const [lastInitialCart, setLastInitialCart] = useState(initialCart);
  if (lastInitialCart !== initialCart) {
    setLastInitialCart(initialCart);
    setCart((prev) => newerCart(prev, initialCart));
  }

  const receiveCart = useCallback((incoming: Cart | null) => {
    setCart((prev) => newerCart(prev, incoming));
  }, []);

  const patchCart = useCallback((patch: (cart: Cart) => Cart) => {
    setCart((prev) => (prev ? patch(prev) : prev));
  }, []);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToast(null);
  }, []);

  const showAddedToast = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToast({ message: "Προστέθηκε στο καλάθι" });
    dismissTimer.current = setTimeout(() => setToast(null), TOAST_AUTO_DISMISS_MS);
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Every link inside CartDrawer already closes the drawer on click, because
  // this provider lives in RootLayout and a client-side navigation never
  // unmounts it (see the note on the drawer's checkout button). Browser
  // Back/Forward was the hole in that: it is a route change nothing clicked,
  // so the drawer rode along onto the destination page with `body { overflow:
  // hidden }` still applied — measured on /kouzina with the drawer open,
  // history.back() landed on / still covered and still unscrollable, which is
  // a page the shopper cannot use at all.
  //
  // Watching the pathname covers both cases at once — a clicked link and a
  // history entry are the same signal here — and it is the same render-time
  // reset Header uses for its own overlays, rather than a second, differently
  // -shaped route watcher. Add-to-cart still opens the drawer: that path
  // (useQuickAdd → openDrawer/showAddedToast) changes no route.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (isDrawerOpen) setIsDrawerOpen(false);
  }

  return (
    <CartUIContext.Provider
      value={{ isDrawerOpen, openDrawer, closeDrawer, toast, showAddedToast, dismissToast, cart, receiveCart, patchCart }}
    >
      {children}
    </CartUIContext.Provider>
  );
}

export function useCartUI(): CartUIContextValue {
  const ctx = useContext(CartUIContext);
  if (!ctx) throw new Error("useCartUI must be used within a CartUIProvider");
  return ctx;
}
