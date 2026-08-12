import { cookies } from "next/headers";
import { medusaFetch, MedusaApiError, type MedusaCustomer, type MedusaCustomerAddress, type MedusaOrder } from "@/lib/medusa";
import { toDomainOrder } from "@/lib/data/checkout";
import type { Customer, CustomerAddress, Order } from "@/lib/types";

// httpOnly — same reasoning as CART_ID_COOKIE (lib/data/cart.ts): the
// customer session is always resolved server-side, nothing client-side
// needs to read this token directly, so keeping it out of `document.cookie`
// removes it as an XSS target for free.
export const CUSTOMER_JWT_COOKIE = "_medusa_jwt";

export function toDomainCustomer(c: MedusaCustomer): Customer {
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    phone: c.phone ?? undefined,
  };
}

export function toDomainCustomerAddress(a: MedusaCustomerAddress): CustomerAddress {
  return {
    id: a.id,
    label: a.address_name ?? undefined,
    isDefaultShipping: a.is_default_shipping,
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    // Same address_1-splitting caveat as lib/types.ts's Address comment —
    // there's no reliable way to split a single Medusa address_1 string
    // back into street/number, so the whole thing is shown as "street" and
    // number stays blank when editing. Acceptable for a rarely-edited saved
    // address; the checkout flow itself never reads from here.
    street: a.address_1 ?? "",
    number: "",
    area: a.address_2 ?? undefined,
    city: a.city ?? "",
    postalCode: a.postal_code ?? "",
    countryCode: a.country_code ?? "gr",
    phone: a.phone ?? "",
  };
}

async function authFetch<T>(path: string, options: Parameters<typeof medusaFetch>[1] = {}): Promise<T> {
  const token = (await cookies()).get(CUSTOMER_JWT_COOKIE)?.value;
  if (!token) throw new MedusaApiError("Not authenticated", "unauthorized", "unauthorized", 401);
  return medusaFetch<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
}

// Read-only — safe to call from Server Components, same "never throws"
// discipline as getCart(): an expired/invalid token means "not logged in",
// not a crash on every page that checks auth state.
export async function getCustomer(): Promise<Customer | null> {
  const token = (await cookies()).get(CUSTOMER_JWT_COOKIE)?.value;
  if (!token) return null;

  try {
    const { customer } = await authFetch<{ customer: MedusaCustomer }>(
      "/store/customers/me?fields=id,email,first_name,last_name,phone",
      { cache: "no-store" }
    );
    return toDomainCustomer(customer);
  } catch (err) {
    if (err instanceof MedusaApiError && (err.status === 401 || err.status === 404)) return null;
    throw err;
  }
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const { addresses } = await authFetch<{ addresses: MedusaCustomerAddress[] }>(
    "/store/customers/me/addresses?fields=id,address_name,is_default_shipping,first_name,last_name,address_1,address_2,city,postal_code,country_code,phone",
    { cache: "no-store" }
  );
  return addresses.map(toDomainCustomerAddress);
}

// Same field list as lib/data/checkout.ts's getOrder — kept in sync by hand
// since the two live in different data-layer files (order-by-id for the
// guest confirmation page vs. order-list for the logged-in dashboard).
const ORDER_FIELDS =
  "id,display_id,email,total,item_subtotal,discount_total,shipping_total,created_at,metadata," +
  "*items,*shipping_address,*billing_address,*shipping_methods";

export async function getCustomerOrders(): Promise<Order[]> {
  const { orders } = await authFetch<{ orders: MedusaOrder[] }>(
    `/store/orders?fields=${ORDER_FIELDS}&order=-created_at`,
    { cache: "no-store" }
  );
  return orders.map(toDomainOrder);
}
