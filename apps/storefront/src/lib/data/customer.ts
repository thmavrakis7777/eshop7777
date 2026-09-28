import { cookies } from "next/headers";
import { CUSTOMER_SESSION_COOKIE, resolveCustomerSession } from "@/lib/auth/session";
import { getCustomerById, listCustomerAddresses, listCustomerLoyaltyCoupons, type LoyaltyCoupon } from "@/lib/db/customer";
import { listCustomerOrders } from "@/lib/db/orders";
import type { Customer, CustomerAddress, Order } from "@/lib/types";

/**
 * Customer session reads.
 *
 * The cookie is an opaque session token now, not a JWT — see lib/auth/session.ts
 * for why. It is deliberately renamed from `_medusa_jwt`: a stale cookie of
 * the old name would be meaningless anyway, and leaving a vendor's name on a
 * cookie after removing that vendor is exactly the kind of debris this
 * migration is meant to avoid.
 */

export { CUSTOMER_SESSION_COOKIE };

/** The signed-in customer's id, or null. Never throws. */
export async function getCustomerId(): Promise<string | null> {
  try {
    const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
    return await resolveCustomerSession(token);
  } catch {
    return null;
  }
}

/**
 * Read-only — safe from Server Components. Same "never throws" discipline as
 * getCart(): an expired or invalid session means "not logged in", not a crash
 * on every page that checks auth state.
 */
export async function getCustomer(): Promise<Customer | null> {
  const customerId = await getCustomerId();
  if (!customerId) return null;
  try {
    return await getCustomerById(customerId);
  } catch {
    return null;
  }
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const customerId = await getCustomerId();
  if (!customerId) return [];
  return listCustomerAddresses(customerId);
}

/**
 * The signed-in customer and their address book, for pre-filling checkout
 * (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.1) — one session lookup instead of the
 * two getCustomer() + getCustomerAddresses() would make. Null when signed
 * out. Never throws: a failed read only means the form starts empty, exactly
 * as it does for a guest, never a broken checkout page.
 */
export async function getCheckoutAccount(): Promise<{ customer: Customer; addresses: CustomerAddress[] } | null> {
  const customerId = await getCustomerId();
  if (!customerId) return null;
  try {
    const [customer, addresses] = await Promise.all([getCustomerById(customerId), listCustomerAddresses(customerId)]);
    return customer ? { customer, addresses } : null;
  } catch (err) {
    console.error("[checkout] ACCOUNT_PREFILL_READ_FAILED", { error: String(err) });
    return null;
  }
}

export async function getCustomerOrders(): Promise<Order[]> {
  const customerId = await getCustomerId();
  if (!customerId) return [];
  return listCustomerOrders(customerId);
}

export async function getCustomerLoyaltyCoupons(): Promise<LoyaltyCoupon[]> {
  const customerId = await getCustomerId();
  if (!customerId) return [];
  return listCustomerLoyaltyCoupons(customerId);
}
