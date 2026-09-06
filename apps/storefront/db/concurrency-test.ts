// Concurrency test for order completion (MIGRATION_AUDIT.md §6.1).
//
// The failure this guards against is overselling: N customers checking out
// the last unit simultaneously must produce exactly ONE order per available
// unit, and stock must never go negative. A read-then-write implementation
// passes a sequential test and fails this one, which is the entire point of
// running it.
//
// Unlike the original db/concurrency-test.mjs, this imports and calls the
// REAL production completeOrder (lib/db/checkout.ts) — it used to hand-copy
// that function's transaction SQL here instead, because completeOrder is
// `import "server-only"` and the plain-Node script had no way to resolve the
// `@/` path alias or transpile TypeScript. Vitest already solves both (esbuild
// transform + the same alias as tsconfig.json, wired below), and `server-only`
// itself is a no-op outside a bundler's browser-condition resolution — so the
// real function can be imported directly instead of re-implemented.
//
// Deliberately NOT under src/ and NOT matched by vitest.config.ts's default
// `src/**/*.test.ts` include: this needs a real Postgres connection and this
// project has no separate staging/test database (DEPLOYMENT.md), so it must
// never run as part of `pnpm test`/CI against production. Invoke explicitly:
//
//   pnpm db:test-concurrency
//
// Operates only on shop.* tables and reverts everything it creates.
import { describe, it, expect } from "vitest";
import { sql } from "../src/lib/db/client";
import { completeOrder, CheckoutError } from "../src/lib/db/checkout";

const CONTENDERS = 8;
const STOCK = 3; // 8 buyers, 3 units, 1 unit each → exactly 3 must succeed

describe("completeOrder concurrency", () => {
  it(`allows exactly ${STOCK} of ${CONTENDERS} simultaneous checkouts to succeed, never oversells`, async () => {
    const [variant] = await sql<
      { id: string; sku: string | null; stock_quantity: number; price_cents: number; title: string; slug: string }[]
    >`SELECT v.id, v.sku, v.stock_quantity, v.price_cents, p.title, p.slug
        FROM shop.product_variant v JOIN shop.product p ON p.id = v.product_id
       ORDER BY v.sku LIMIT 1`;
    expect(variant, "seed data must have at least one variant").toBeTruthy();

    const [shippingMethod] = await sql<{ id: string }[]>`
      SELECT id FROM shop.shipping_method LIMIT 1`;
    const [paymentMethod] = await sql<{ code: string }[]>`
      SELECT code FROM shop.payment_method WHERE is_active LIMIT 1`;
    expect(shippingMethod, "seed data must have a shipping method").toBeTruthy();
    expect(paymentMethod, "seed data must have an active payment method").toBeTruthy();

    const originalStock = variant.stock_quantity;
    const createdCarts: string[] = [];
    const createdOrders: string[] = [];

    try {
      await sql`UPDATE shop.product_variant SET stock_quantity = ${STOCK} WHERE id = ${variant.id}`;

      for (let i = 0; i < CONTENDERS; i++) {
        const [cart] = await sql<{ id: string }[]>`
          INSERT INTO shop.cart (email, shipping_address, shipping_method_id)
          VALUES (${`race${i}@example.test`}, ${sql.json({ city: "Αθήνα", postal_code: "10431" })}, ${shippingMethod.id})
          RETURNING id`;
        await sql`
          INSERT INTO shop.cart_item (cart_id, variant_id, quantity, title, sku, product_slug, unit_price_cents)
          VALUES (${cart.id}, ${variant.id}, 1, ${variant.title}, ${variant.sku}, ${variant.slug}, ${variant.price_cents})`;
        createdCarts.push(cart.id);
      }

      const results = await Promise.allSettled(
        createdCarts.map((cartId) => completeOrder(cartId, null, paymentMethod.code))
      );

      const ok = results.filter((r) => r.status === "fulfilled");
      const oversold = results.filter(
        (r) => r.status === "rejected" && r.reason instanceof CheckoutError && r.reason.code === "insufficient_inventory"
      );
      const other = results.filter(
        (r) => r.status === "rejected" && !(r.reason instanceof CheckoutError && r.reason.code === "insufficient_inventory")
      );
      for (const r of ok) if (r.status === "fulfilled") createdOrders.push(r.value.id);

      const [{ stock_quantity: finalStock }] =
        await sql<{ stock_quantity: number }[]>`SELECT stock_quantity FROM shop.product_variant WHERE id = ${variant.id}`;
      const orderNumbers = ok.map((r) => (r.status === "fulfilled" ? r.value.orderNumber : -1));

      if (other.length > 0) {
        console.error(
          "[concurrency-test] unexpected rejection reasons:",
          other.map((r) => (r.status === "rejected" ? String(r.reason) : ""))
        );
      }

      expect(ok.length, "successful checkouts").toBe(STOCK);
      expect(oversold.length, "checkouts correctly rejected for insufficient stock").toBe(CONTENDERS - STOCK);
      expect(other.length, "unexpected errors").toBe(0);
      expect(finalStock, "stock lands at exactly 0").toBe(0);
      expect(finalStock, "stock never goes negative").toBeGreaterThanOrEqual(0);
      expect(new Set(orderNumbers).size, "order numbers are unique").toBe(orderNumbers.length);
      expect(createdOrders.length, "one order row per success").toBe(ok.length);
    } finally {
      // Revert everything, in FK-safe order — same cleanup the original
      // script always ran, now also covering the extra rows completeOrder
      // itself inserts (inventory_movement, order_event) that the old
      // hand-copied transaction never created.
      if (createdOrders.length) {
        await sql`DELETE FROM shop.order_event WHERE order_id = ANY(${createdOrders})`;
        await sql`DELETE FROM shop.inventory_movement WHERE order_id = ANY(${createdOrders})`;
        await sql`DELETE FROM shop.order_item WHERE order_id = ANY(${createdOrders})`;
        await sql`DELETE FROM shop.orders WHERE id = ANY(${createdOrders})`;
      }
      if (createdCarts.length) {
        await sql`DELETE FROM shop.cart_item WHERE cart_id = ANY(${createdCarts})`;
        await sql`DELETE FROM shop.cart WHERE id = ANY(${createdCarts})`;
      }
      await sql`UPDATE shop.product_variant SET stock_quantity = ${originalStock} WHERE id = ${variant.id}`;
    }
  });
});
