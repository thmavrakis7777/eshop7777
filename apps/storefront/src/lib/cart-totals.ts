import { highestOversizedFeeCents } from "@/lib/shipping";
import type { Cart, Money } from "@/lib/types";

/**
 * The cart's money arithmetic, shared by the server and the browser.
 *
 * Lived in lib/db/cart.ts until SPD-09 (CART_TOTALS_SPEC.md). It never
 * touched the database, only that file is server-only, so moving it here
 * lets the browser run the exact function that prices the order instead of
 * a copy of it: the shared cart recomputes its totals the moment a quantity
 * changes, and the server's answer to the same edit still replaces them.
 *
 * Money is VAT-INCLUSIVE integer cents throughout (Greek B2C law). `vatTotal`
 * is a derived breakdown line, never added on top.
 */

// Standard Greek ΦΠΑ. Overridable per-store in shop.site_setting and
// per-product via shop.product.vat_rate; both default to this.
const DEFAULT_VAT_RATE = 24;

export const eur = (cents: number): Money => ({ amount: cents / 100, currencyCode: "EUR" });

/** The applied discount's rule, as computeTotals reads it. */
export type TotalsDiscount = { type: "percentage" | "fixed"; value: number; min_subtotal_cents: number };

/** The saved shipping method's rule, as computeTotals reads it. */
export type TotalsShipping = {
  price_cents: number;
  free_over_cents: number | null;
  is_pickup: boolean;
  /** Heraklion's own free-shipping threshold overrides the oversized surcharge — see below. */
  heraklion_only?: boolean;
};

/**
 * The single money calculation for a cart. Order completion
 * (lib/db/checkout.ts) must produce byte-identical figures — the customer is
 * charged what the cart showed, so there is exactly one implementation of
 * this arithmetic.
 */
export function computeTotals(input: {
  items: Array<{
    unit_price_cents: number;
    quantity: number;
    /** Per-product override. NULL/0 = ships under the standard method. */
    shipping_cost_cents?: number | null;
  }>;
  discount: TotalsDiscount | null;
  shipping: TotalsShipping | null;
  vatRate?: number;
}) {
  const subtotalCents = input.items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);

  let discountCents = 0;
  if (input.discount && subtotalCents >= input.discount.min_subtotal_cents) {
    discountCents =
      input.discount.type === "percentage"
        ? Math.round((subtotalCents * input.discount.value) / 100)
        : input.discount.value;
    // Never discount below zero, and never turn a discount into a refund.
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const afterDiscount = subtotalCents - discountCents;

  // Shipping. Two regimes, never mixed:
  //
  //   * All-standard cart  → the chosen method's price, once, waived above
  //     the free-shipping threshold.
  //   * Any oversized item → shipping is the HIGHEST single oversized item's
  //     own cost (see lib/shipping.ts's highestOversizedFeeCents, shared
  //     with ShippingSection's checkout-UI preview so the two can never
  //     disagree) — never summed across multiple oversized lines, never
  //     multiplied by quantity. Standard items in the same cart ride along
  //     free rather than adding the method price on top.
  //
  // So 1 normal = 3.50, 1 heavy (€8) + 1 normal = 8.00, 2 heavy (€8 each) +
  // 1 normal = 8.00 (not 16.00), a €7 item + a €12 item = 12.00 (not 19.00).
  // Reversed from an earlier "sum every oversized line × its quantity"
  // design per an explicit later business decision — see git history for
  // that rule if it's ever needed again.
  //
  // The free-shipping threshold deliberately does NOT waive oversized costs
  // for the nationwide method: that parcel genuinely costs more to send, and
  // a large order does not make a bathtub cheaper to ship. Heraklion's own
  // method is the one deliberate exception — its threshold is a flat "free
  // delivery in the city" promise that covers the whole order, heavy/bulky
  // included, per the approved Heraklion free-shipping spec. Store pickup
  // skips all of it either way, oversized included — nothing is being sent.
  let shippingCents = 0;
  if (input.shipping && !input.shipping.is_pickup) {
    const oversizedCents = highestOversizedFeeCents(input.items.map((i) => i.shipping_cost_cents));
    const qualifiesFree =
      input.shipping.free_over_cents != null && afterDiscount >= input.shipping.free_over_cents;

    if (oversizedCents > 0 && !(input.shipping.heraklion_only && qualifiesFree)) {
      shippingCents = oversizedCents;
    } else {
      shippingCents = qualifiesFree ? 0 : input.shipping.price_cents;
    }
  }

  const totalCents = afterDiscount + shippingCents;

  // Prices already include VAT, so this extracts the embedded tax rather than
  // adding to it: gross × rate ÷ (100 + rate).
  const rate = input.vatRate ?? DEFAULT_VAT_RATE;
  const vatCents = Math.round((totalCents * rate) / (100 + rate));

  return { subtotalCents, discountCents, shippingCents, totalCents, vatCents, vatRate: rate };
}

/**
 * The browser's prediction of what the server will answer after an
 * optimistic edit (useCartController's quantity change or removal): every
 * money field and the item count, rebuilt from the cart's current lines and
 * the rules it was last priced with (`cart.pricing`), through the same
 * computeTotals as above.
 *
 * A prediction, not a decision. The server re-reads the discount, the
 * shipping method and each product's shipping cost live, and its returned
 * Cart replaces this one (newer fetchedAt, lib/cart-snapshot.ts). The two
 * differ only if one of those changed since the last snapshot, or stock
 * refused the edit — CART_TOTALS_SPEC.md §4.
 *
 * Unit prices come back to cents with Math.round: toDomainCart built each
 * amount as integer cents ÷ 100, so the rounding recovers the exact integer.
 */
export function recomputeTotals(cart: Cart): Cart {
  const items = cart.items.map((i) => ({ line: i, unitCents: Math.round(i.unitPrice.amount * 100) }));
  const t = computeTotals({
    items: items.map(({ line, unitCents }) => ({
      unit_price_cents: unitCents,
      quantity: line.quantity,
      shipping_cost_cents: line.shippingCostCents,
    })),
    discount: cart.pricing.discount,
    shipping: cart.pricing.shipping,
    vatRate: cart.vatRate,
  });

  return {
    ...cart,
    items: items.map(({ line, unitCents }) => ({ ...line, lineTotal: eur(unitCents * line.quantity) })),
    itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: eur(t.subtotalCents),
    discountTotal: eur(t.discountCents),
    shippingTotal: eur(t.shippingCents),
    vatTotal: eur(t.vatCents),
    total: eur(t.totalCents),
  };
}
