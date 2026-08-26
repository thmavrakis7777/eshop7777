"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  CartError,
  isCartId,
  setCartAddresses,
  setCartEmail,
  setShippingMethod,
  setTaxDocument,
} from "@/lib/db/cart";
import { CheckoutError, completeOrder } from "@/lib/db/checkout";
import { CART_ID_COOKIE, getCart } from "@/lib/data/cart";
import { getCustomerId } from "@/lib/data/customer";
import { getShippingOptionsForCart } from "@/lib/data/checkout";
import { sendOrderConfirmationEmail, sendOwnerOrderNotificationEmail } from "@/lib/email/send";
import { getOrderForEmail, markConfirmationEmailSent } from "@/lib/db/order-email";
import { isValidEmail } from "@/lib/checkout-validation";
import type { Cart, ShippingOption } from "@/lib/types";

// Maps real failure codes to the Greek copy table in CHECKOUT_UX_SPEC.md §12.
// Never let a raw database message reach a customer.
function mapCheckoutError(err: unknown): string {
  if (err instanceof CheckoutError) {
    switch (err.code) {
      case "insufficient_inventory":
        return "Ένα προϊόν στο καλάθι σου δεν είναι πλέον διαθέσιμο στην ποσότητα που ζήτησες.";
      case "empty_cart":
        return "Το καλάθι σου είναι άδειο.";
      case "missing_details":
        return "Συμπλήρωσε όλα τα απαραίτητα στοιχεία πριν ολοκληρώσεις την παραγγελία.";
      case "already_completed":
        return "Αυτή η παραγγελία έχει ήδη καταχωρηθεί.";
      case "not_found":
        return "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.";
    }
  }
  if (err instanceof CartError) {
    if (err.code === "insufficient_inventory") {
      return "Ένα προϊόν στο καλάθι σου δεν είναι πλέον διαθέσιμο στην ποσότητα που ζήτησες.";
    }
    if (err.code === "not_found") return "Δεν είναι διαθέσιμη αυτή η μέθοδος αποστολής. Δοκίμασε ξανά.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

async function requireCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_ID_COOKIE)?.value;
  return isCartId(id) ? id : null;
}

export type CheckoutActionResult = { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart | null };

const EXPIRED = "Το καλάθι σου έληξε. Ξεκίνα ξανά από το καλάθι.";

async function cartResultFrom(run: (cartId: string) => Promise<unknown>): Promise<CheckoutActionResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: EXPIRED, cart: null };
  try {
    await run(cartId);
    revalidatePath("/checkout");
    const cart = await getCart();
    return cart ? { ok: true, cart } : { ok: false, error: EXPIRED, cart: null };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err), cart: await getCart() };
  }
}

// Server-side format check, not just the client's — this is what ends up as
// Resend's `to` address for the order-confirmation email, and a Server
// Action is a public endpoint the browser's own validation never protects.
export async function updateCheckoutEmailAction(email: string): Promise<CheckoutActionResult> {
  if (!isValidEmail(email)) {
    return { ok: false, error: "Μη έγκυρη διεύθυνση email.", cart: await getCart() };
  }
  return cartResultFrom((cartId) => setCartEmail(cartId, email));
}

export type CheckoutDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  number: string;
  area?: string;
  postalCode: string;
  city: string;
  billingDiffers: boolean;
  billing?: { street: string; number: string; area?: string; postalCode: string; city: string };
};

export type CheckoutDetailsResult =
  | { ok: true; cart: Cart; shippingOptions: ShippingOption[] }
  | { ok: false; error: string; cart: Cart | null };

/**
 * One write for both visual sections ("Στοιχεία παραλήπτη" + "Διεύθυνση
 * παράδοσης") — they are a single address object, so splitting this would be
 * two partial writes to the same row for no benefit. Country is always "gr",
 * not a form field, per the approved checkout spec.
 */
export async function updateCheckoutDetailsAction(details: CheckoutDetails): Promise<CheckoutDetailsResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: EXPIRED, cart: null };

  const shippingAddress = {
    first_name: details.firstName,
    last_name: details.lastName,
    phone: details.phone,
    address_1: `${details.street} ${details.number}`.trim(),
    address_2: details.area || null,
    postal_code: details.postalCode,
    city: details.city,
    country_code: "gr",
  };
  const billingAddress =
    details.billingDiffers && details.billing
      ? {
          first_name: details.firstName,
          last_name: details.lastName,
          phone: details.phone,
          address_1: `${details.billing.street} ${details.billing.number}`.trim(),
          address_2: details.billing.area || null,
          postal_code: details.billing.postalCode,
          city: details.billing.city,
          country_code: "gr",
        }
      : shippingAddress;

  try {
    await setCartAddresses(cartId, shippingAddress, billingAddress);
    const [cart, shippingOptions] = await Promise.all([getCart(), getShippingOptionsForCart(cartId)]);
    revalidatePath("/checkout");
    return cart ? { ok: true, cart, shippingOptions } : { ok: false, error: EXPIRED, cart: null };
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err), cart: await getCart() };
  }
}

export type TaxDocumentDetails =
  | { type: "receipt" }
  | { type: "invoice"; companyName: string; afm: string; doy: string; activity: string };

/**
 * Tax-document details are real columns now. Under Medusa they lived in
 * cart.metadata, where a write MERGED rather than replaced — so switching
 * back to "receipt" had to send explicit nulls or the stale ΑΦΜ survived,
 * a real bug that storage shape invited. A plain UPDATE cannot do that.
 */
export async function updateTaxDocumentAction(details: TaxDocumentDetails): Promise<CheckoutActionResult> {
  return cartResultFrom((cartId) => setTaxDocument(cartId, details));
}

export async function setShippingMethodAction(optionId: string): Promise<CheckoutActionResult> {
  return cartResultFrom((cartId) => setShippingMethod(cartId, optionId));
}

export type CheckoutCompleteResult =
  | { ok: true; orderId: string; displayId: number }
  | { ok: false; error: string };

/**
 * Places the order.
 *
 * Everything that must be atomic happens inside completeOrder's single
 * transaction (lib/db/checkout.ts). Medusa required creating a payment
 * collection and opening a payment session against a provider before a cart
 * could complete — pure ceremony for cash on delivery, and all of it is gone.
 *
 * The confirmation email is sent AFTER the transaction commits, and
 * sendOrderConfirmationEmail never throws: an email outage must not cost the
 * customer an order that is already placed and whose stock is already
 * deducted.
 */
export async function completeCheckoutAction(paymentMethodCode: string): Promise<CheckoutCompleteResult> {
  const cartId = await requireCartId();
  if (!cartId) return { ok: false, error: EXPIRED };

  let order;
  try {
    order = await completeOrder(cartId, await getCustomerId(), paymentMethodCode);
  } catch (err) {
    return { ok: false, error: mapCheckoutError(err) };
  }

  (await cookies()).delete(CART_ID_COOKIE);
  revalidatePath("/", "layout");

  // The order is already committed above — nothing from here on may throw
  // back to the customer. sendOrderConfirmationEmail itself never throws,
  // but the read that gathers its data is a real query and must be guarded
  // the same way, or a transient DB hiccup on this one read would turn an
  // already-successful order into a customer-facing error page.
  //
  // Fetched once, used for both emails — one query, two independent sends.
  // Each send is its own try/catch: the owner not getting notified must
  // never affect whether the customer's own confirmation went out, and
  // vice versa. Neither can double-fire on a retry — completeOrder above
  // already flips the cart to 'completed' inside its own transaction, so a
  // second call for the same cart fails at that step, before either send
  // is ever reached.
  try {
    const emailData = await getOrderForEmail(order.id);
    if (emailData) {
      try {
        const sent = await sendOrderConfirmationEmail(emailData);
        if (sent) await markConfirmationEmailSent(order.id);
      } catch (err) {
        console.error("[checkout] ORDER_CONFIRMATION_EMAIL_FAILED", { orderId: order.id, error: String(err) });
      }
      try {
        await sendOwnerOrderNotificationEmail(emailData);
      } catch (err) {
        console.error("[checkout] OWNER_NOTIFICATION_EMAIL_FAILED", { orderId: order.id, error: String(err) });
      }
    }
  } catch (err) {
    console.error("[checkout] ORDER_EMAIL_DATA_FAILED", { orderId: order.id, error: String(err) });
  }

  return { ok: true, orderId: order.id, displayId: order.orderNumber };
}
