"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ToastState = { message: string } | null;

type CartUIContextValue = {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toast: ToastState;
  showAddedToast: () => void;
  dismissToast: () => void;
};

const CartUIContext = createContext<CartUIContextValue | null>(null);

const TOAST_AUTO_DISMISS_MS = 4000;

export function CartUIProvider({ children }: { children: React.ReactNode }) {
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
      value={{ isDrawerOpen, openDrawer, closeDrawer, toast, showAddedToast, dismissToast }}
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
