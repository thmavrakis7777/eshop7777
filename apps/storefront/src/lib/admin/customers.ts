import "server-only";
import { sql } from "@/lib/db/client";

/**
 * Customer management.
 *
 * Written with GDPR in mind, which here means concrete restraint rather than
 * a banner: the list shows only what is needed to find someone, the detail
 * page never renders a password hash or session token, and there is no
 * "export all customers" button — bulk personal data leaving the system
 * should be a deliberate act, not a click.
 *
 * Admins can deactivate an account but not delete it: orders reference the
 * customer, and a real erasure request needs a decision about that history,
 * not a cascade.
 */

export type AdminCustomerRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  hasAccount: boolean;
  marketingConsent: boolean;
  isActive: boolean;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  createdAt: string;
};

export async function listCustomers(filters: { q?: string; page?: number; perPage?: number } = {}): Promise<{
  customers: AdminCustomerRow[];
  total: number;
  page: number;
  perPage: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(10, filters.perPage ?? 25));
  const offset = (page - 1) * perPage;
  const q = filters.q?.trim();

  const rows = (await sql`
    SELECT c.id, c.email, c.first_name, c.last_name, c.phone,
           (c.password_hash IS NOT NULL) AS has_account,
           c.marketing_consent, c.is_active, c.created_at,
           (SELECT COUNT(*) FROM shop.orders o
             WHERE o.customer_id = c.id AND o.status <> 'cancelled')::int AS order_count,
           COALESCE((SELECT SUM(o.total_cents) FROM shop.orders o
             WHERE o.customer_id = c.id AND o.status <> 'cancelled'), 0)::int AS total_spent,
           (SELECT MAX(o.created_at) FROM shop.orders o WHERE o.customer_id = c.id) AS last_order_at,
           COUNT(*) OVER () AS total_count
      FROM shop.customer c
     WHERE TRUE
       ${q
         ? sql`AND (c.email ILIKE ${"%" + q + "%"}
                    OR c.first_name ILIKE ${"%" + q + "%"}
                    OR c.last_name ILIKE ${"%" + q + "%"}
                    OR c.phone ILIKE ${"%" + q + "%"})`
         : sql``}
     ORDER BY c.created_at DESC
     LIMIT ${perPage} OFFSET ${offset}`) as unknown as Array<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    phone: string | null; has_account: boolean; marketing_consent: boolean;
    is_active: boolean; created_at: Date; order_count: number; total_spent: number;
    last_order_at: Date | null; total_count: string;
  }>;

  return {
    customers: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      phone: r.phone,
      hasAccount: r.has_account,
      marketingConsent: r.marketing_consent,
      isActive: r.is_active,
      orderCount: r.order_count,
      totalSpentCents: r.total_spent,
      lastOrderAt: r.last_order_at ? new Date(r.last_order_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    perPage,
  };
}

export type AdminCustomerDetail = AdminCustomerRow & {
  addresses: Array<{
    id: string;
    label: string | null;
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    postalCode: string;
    phone: string | null;
    isDefaultShipping: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    totalCents: number;
    createdAt: string;
  }>;
};

export async function getCustomerDetail(id: string): Promise<AdminCustomerDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  // Note the explicit column list — `SELECT *` here would pull password_hash
  // into the render tree, where it has no business being even if unused.
  const rows = (await sql`
    SELECT c.id, c.email, c.first_name, c.last_name, c.phone,
           (c.password_hash IS NOT NULL) AS has_account,
           c.marketing_consent, c.is_active, c.created_at,
           (SELECT COUNT(*) FROM shop.orders o
             WHERE o.customer_id = c.id AND o.status <> 'cancelled')::int AS order_count,
           COALESCE((SELECT SUM(o.total_cents) FROM shop.orders o
             WHERE o.customer_id = c.id AND o.status <> 'cancelled'), 0)::int AS total_spent,
           (SELECT MAX(o.created_at) FROM shop.orders o WHERE o.customer_id = c.id) AS last_order_at,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', a.id, 'label', a.label,
               'name', TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')),
               'address1', a.address_1, 'address2', a.address_2, 'city', a.city,
               'postalCode', a.postal_code, 'phone', a.phone,
               'isDefaultShipping', a.is_default_shipping) ORDER BY a.created_at)
             FROM shop.customer_address a WHERE a.customer_id = c.id), '[]'::json) AS addresses,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', o.id, 'orderNumber', o.order_number, 'status', o.status,
               'totalCents', o.total_cents, 'createdAt', o.created_at) ORDER BY o.created_at DESC)
             FROM shop.orders o WHERE o.customer_id = c.id), '[]'::json) AS orders
      FROM shop.customer c WHERE c.id = ${id}`) as unknown as Array<Record<string, unknown>>;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id as string,
    email: r.email as string,
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    phone: (r.phone as string) ?? null,
    hasAccount: r.has_account as boolean,
    marketingConsent: r.marketing_consent as boolean,
    isActive: r.is_active as boolean,
    orderCount: r.order_count as number,
    totalSpentCents: r.total_spent as number,
    lastOrderAt: r.last_order_at ? new Date(r.last_order_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    addresses: r.addresses as AdminCustomerDetail["addresses"],
    orders: (r.orders as AdminCustomerDetail["orders"]).map((o) => ({
      ...o,
      createdAt: new Date(o.createdAt).toISOString(),
    })),
  };
}

/** Deactivating blocks login and ends every session immediately. */
export async function setCustomerActive(id: string, isActive: boolean): Promise<void> {
  await sql`UPDATE shop.customer SET is_active = ${isActive} WHERE id = ${id}`;
  if (!isActive) await sql`DELETE FROM shop.customer_session WHERE customer_id = ${id}`;
}

/**
 * Consent can be withdrawn here but never granted — an admin ticking a
 * marketing-consent box on a customer's behalf is precisely what consent
 * rules exist to prevent. Granting happens only through the customer's own
 * action on the storefront.
 */
export async function withdrawMarketingConsent(id: string): Promise<void> {
  await sql`UPDATE shop.customer SET marketing_consent = false WHERE id = ${id}`;
}

export async function getMarketingConsentCount(): Promise<{ consented: number; total: number }> {
  const [r] = await sql<{ consented: number; total: number }[]>`
    SELECT COUNT(*) FILTER (WHERE marketing_consent)::int AS consented,
           COUNT(*)::int AS total
      FROM shop.customer`;
  return r;
}
