import "server-only";
import { sql } from "@/lib/db/client";

/**
 * Discount codes.
 *
 * Deliberately one simple model — percentage or fixed amount, optional
 * minimum, optional window, optional redemption cap. Medusa's promotion
 * engine (campaigns, budgets, buy-rules, target-rules, allocations) was
 * capable of far more than this shop has ever used, and every unused branch
 * of it was a thing that could behave unexpectedly at checkout.
 */

export class DiscountError extends Error {
  constructor(message: string, public readonly code: "duplicate_code" | "not_found" | "in_use") {
    super(message);
  }
}

export type AdminDiscount = {
  id: string;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: number;
  minSubtotalCents: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  createdAt: string;
  /** Derived, not stored — so it can never drift from the dates behind it. */
  state: "active" | "scheduled" | "expired" | "exhausted" | "disabled";
};

function deriveState(d: {
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  max_redemptions: number | null;
  redemption_count: number;
}): AdminDiscount["state"] {
  if (!d.is_active) return "disabled";
  const now = Date.now();
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return "scheduled";
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return "expired";
  if (d.max_redemptions != null && d.redemption_count >= d.max_redemptions) return "exhausted";
  return "active";
}

export async function listDiscounts(): Promise<AdminDiscount[]> {
  const rows = await sql<
    {
      id: string; code: string; description: string | null; type: "percentage" | "fixed";
      value: number; min_subtotal_cents: number; starts_at: Date | null; ends_at: Date | null;
      max_redemptions: number | null; redemption_count: number; is_active: boolean; created_at: Date;
    }[]
  >`SELECT id, code, description, type, value, min_subtotal_cents, starts_at, ends_at,
           max_redemptions, redemption_count, is_active, created_at
      FROM shop.discount ORDER BY is_active DESC, created_at DESC`;

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    type: r.type,
    value: r.value,
    minSubtotalCents: r.min_subtotal_cents,
    startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
    endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null,
    maxRedemptions: r.max_redemptions,
    redemptionCount: r.redemption_count,
    isActive: r.is_active,
    createdAt: new Date(r.created_at).toISOString(),
    state: deriveState(r),
  }));
}

export async function saveDiscount(input: {
  id?: string;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: number;
  minSubtotalCents: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  isActive: boolean;
}): Promise<string> {
  const code = input.code.trim().toUpperCase();
  const dupe = await sql<{ id: string }[]>`
    SELECT id FROM shop.discount
     WHERE lower(code) = lower(${code}) ${input.id ? sql`AND id <> ${input.id}` : sql``}`;
  if (dupe.length > 0) throw new DiscountError("Code already exists", "duplicate_code");

  if (input.id) {
    await sql`
      UPDATE shop.discount SET
        code = ${code}, description = ${input.description}, type = ${input.type},
        value = ${input.value}, min_subtotal_cents = ${input.minSubtotalCents},
        starts_at = ${input.startsAt}, ends_at = ${input.endsAt},
        max_redemptions = ${input.maxRedemptions}, is_active = ${input.isActive}
      WHERE id = ${input.id}`;
    return input.id;
  }

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.discount (code, description, type, value, min_subtotal_cents,
                               starts_at, ends_at, max_redemptions, is_active)
    VALUES (${code}, ${input.description}, ${input.type}, ${input.value},
            ${input.minSubtotalCents}, ${input.startsAt}, ${input.endsAt},
            ${input.maxRedemptions}, ${input.isActive})
    RETURNING id`;
  return row.id;
}

/**
 * A redeemed code is disabled, not deleted: orders record which code was
 * used, and deleting the row would erase that from the shop's own history.
 * Unused codes are removed outright.
 */
export async function deleteDiscount(id: string): Promise<"deleted" | "disabled"> {
  const [{ redeemed }] = await sql<{ redeemed: number }[]>`
    SELECT COUNT(*)::int AS redeemed FROM shop.discount_redemption WHERE discount_id = ${id}`;
  if (redeemed > 0) {
    await sql`UPDATE shop.discount SET is_active = false WHERE id = ${id}`;
    return "disabled";
  }
  await sql`DELETE FROM shop.discount WHERE id = ${id}`;
  return "deleted";
}

export type DiscountUsage = {
  orderNumber: number;
  orderId: string;
  customerEmail: string;
  totalCents: number;
  createdAt: string;
};

export async function getDiscountUsage(id: string, limit = 20): Promise<DiscountUsage[]> {
  const rows = await sql<
    { order_number: number; order_id: string; email: string; total_cents: number; created_at: Date }[]
  >`SELECT o.order_number, o.id AS order_id, o.email, o.total_cents, r.created_at
      FROM shop.discount_redemption r
      JOIN shop.orders o ON o.id = r.order_id
     WHERE r.discount_id = ${id}
     ORDER BY r.created_at DESC LIMIT ${limit}`;

  return rows.map((r) => ({
    orderNumber: r.order_number,
    orderId: r.order_id,
    customerEmail: r.email,
    totalCents: r.total_cents,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
