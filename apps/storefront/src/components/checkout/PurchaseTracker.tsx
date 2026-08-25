"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics/track";

/**
 * Fires once per order, ever — not once per page view. The confirmation
 * page has a real, bookmarkable URL (see checkout/epibebaiosi/page.tsx's
 * own comment on why) and can be reloaded or revisited, but a reload must
 * never count as a second sale. sessionStorage (not a ref/state) is the
 * dedup key precisely because it has to survive a hard refresh, not just a
 * re-render.
 */
export function PurchaseTracker({ orderId, totalAmount }: { orderId: string; totalAmount: number }) {
  useEffect(() => {
    const key = `mavrakishome:purchase-tracked:${orderId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — fall through and track anyway rather than
      // silently dropping a real purchase event over a non-critical guard.
    }
    trackPurchase({ id: orderId, totalAmount });
  }, [orderId, totalAmount]);

  return null;
}
