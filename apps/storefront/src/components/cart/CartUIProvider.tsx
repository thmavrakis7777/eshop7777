"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

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
