"use client";

import { getConsentSnapshot } from "@/lib/consent-storage";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Centralized Meta Pixel ecommerce event tracking — the one place any
 * component fires a tracking event, so events can't drift out of sync or
 * get duplicated by being wired ad hoc into five different components (the
 * task's own instruction: "do not scatter tracking code").
 *
 * Consent-gated the same way AnalyticsScripts.tsx gates the Pixel init
 * script itself (the `marketing` category — see consent-storage.ts). If
 * consent hasn't been granted, `window.fbq` was never injected in the first
 * place, so every call here is already a safe no-op by construction; the
 * explicit check below is a second layer, matching the "never trust one
 * guard" pattern the rest of this codebase already uses for tracking IDs.
 *
 * Every event carries a stable, content-derived `eventID`. Unused today —
 * no server-side Conversions API call exists yet, see lib/analytics/capi.ts
 * — but this is exactly the field CAPI needs for browser/server event
 * deduplication, so it is threaded through now rather than retrofitted
 * later once CAPI goes live.
 */
function track(event: string, params: Record<string, unknown>, eventId: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (!getConsentSnapshot()?.marketing) return;
  window.fbq("track", event, params, { eventID: eventId });
}

export function trackViewContent(product: {
  id: string;
  title: string;
  price: { amount: number };
}): void {
  track(
    "ViewContent",
    {
      content_ids: [product.id],
      content_name: product.title,
      content_type: "product",
      value: product.price.amount,
      currency: "EUR",
    },
    `view-${product.id}`
  );
}

export function trackAddToCart(item: {
  variantId: string;
  title: string;
  unitPriceAmount: number;
  quantity: number;
}): void {
  track(
    "AddToCart",
    {
      content_ids: [item.variantId],
      content_name: item.title,
      content_type: "product",
      value: item.unitPriceAmount * item.quantity,
      currency: "EUR",
    },
    // Deliberately not time-based: two identical quick-adds in the same
    // render are two real AddToCart events, not a duplicate to suppress.
    `addtocart-${item.variantId}-${item.quantity}`
  );
}

export function trackInitiateCheckout(cart: {
  id: string;
  itemIds: string[];
  totalAmount: number;
}): void {
  track(
    "InitiateCheckout",
    {
      content_ids: cart.itemIds,
      content_type: "product",
      num_items: cart.itemIds.length,
      value: cart.totalAmount,
      currency: "EUR",
    },
    `checkout-${cart.id}`
  );
}

export function trackPurchase(order: { id: string; totalAmount: number }): void {
  track("Purchase", { value: order.totalAmount, currency: "EUR" }, `purchase-${order.id}`);
}
