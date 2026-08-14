// Concurrency test for order completion (MIGRATION_AUDIT.md §6.1).
//
// The failure this guards against is overselling: N customers checking out
// the last unit simultaneously must produce exactly ONE order, and stock must
// never go negative. A read-then-write implementation passes a sequential
// test and fails this one, which is the entire point of running it.
//
// Operates only on shop.* tables and reverts everything it creates.
//
//   node db/concurrency-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(dir, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim();

// A pool, not a single connection: concurrent transactions need concurrent
// connections or they serialise in the client and prove nothing.
const sql = postgres(url, { ssl: "require", max: 10 });

const CONTENDERS = 8;
const STOCK = 3; // 8 buyers, 3 units, 1 unit each → exactly 3 must succeed

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// Mirrors lib/db/checkout.ts's transaction exactly. Kept in this script rather
// than importing the TypeScript module (which is `server-only` and needs the
// Next build pipeline) — the decrement's WHERE clause is the thing under test.
async function completeOrder(cartId) {
  return sql.begin(async (tx) => {
    const [cart] = await tx`SELECT * FROM shop.cart WHERE id = ${cartId} FOR UPDATE`;
    if (!cart) throw new Error("not_found");
    if (cart.status === "completed") throw new Error("already_completed");

    const items = await tx`
      SELECT i.variant_id, i.quantity, p.title, v.price_cents, v.product_id, v.sku, p.slug
        FROM shop.cart_item i
        JOIN shop.product_variant v ON v.id = i.variant_id
        JOIN shop.product p ON p.id = v.product_id
       WHERE i.cart_id = ${cartId}`;

    for (const item of items) {
      const updated = await tx`
        UPDATE shop.product_variant
           SET stock_quantity = stock_quantity - ${item.quantity}
         WHERE id = ${item.variant_id}
           AND (allow_backorder OR stock_quantity >= ${item.quantity})`;
      if (updated.count === 0) throw new Error("insufficient_inventory");
    }

    const subtotal = items.reduce((s, i) => s + i.price_cents * i.quantity, 0);
    const [order] = await tx`
      INSERT INTO shop.orders (email, subtotal_cents, total_cents, vat_cents, shipping_method_name)
      VALUES (${cart.email}, ${subtotal}, ${subtotal}, ${Math.round((subtotal * 24) / 124)}, 'Test')
      RETURNING id, order_number`;

    for (const item of items) {
      await tx`
        INSERT INTO shop.order_item (order_id, variant_id, product_id, title, sku, product_slug,
                                     quantity, unit_price_cents, line_total_cents)
        VALUES (${order.id}, ${item.variant_id}, ${item.product_id}, ${item.title}, ${item.sku},
                ${item.slug}, ${item.quantity}, ${item.price_cents}, ${item.price_cents * item.quantity})`;
    }
    await tx`UPDATE shop.cart SET status = 'completed' WHERE id = ${cartId}`;
    return order;
  });
}

const [variant] = await sql`
  SELECT v.id, v.sku, v.stock_quantity, v.price_cents, p.title, p.slug
    FROM shop.product_variant v JOIN shop.product p ON p.id = v.product_id
   ORDER BY v.sku LIMIT 1`;

const originalStock = variant.stock_quantity;
const createdCarts = [];
const createdOrders = [];

try {
  console.log(`\nVariant under test: ${variant.sku}  (real stock ${originalStock}, temporarily set to ${STOCK})\n`);
  await sql`UPDATE shop.product_variant SET stock_quantity = ${STOCK} WHERE id = ${variant.id}`;

  for (let i = 0; i < CONTENDERS; i++) {
    const [cart] = await sql`
      INSERT INTO shop.cart (email, shipping_address, shipping_method_id)
      VALUES (${`race${i}@example.test`}, ${sql.json({ city: "Αθήνα" })},
              (SELECT id FROM shop.shipping_method LIMIT 1))
      RETURNING id`;
    await sql`
      INSERT INTO shop.cart_item (cart_id, variant_id, quantity, title, sku, product_slug, unit_price_cents)
      VALUES (${cart.id}, ${variant.id}, 1, ${variant.title}, ${variant.sku}, ${variant.slug}, ${variant.price_cents})`;
    createdCarts.push(cart.id);
  }

  console.log(`Firing ${CONTENDERS} simultaneous checkouts for ${STOCK} units...\n`);
  const results = await Promise.allSettled(createdCarts.map((id) => completeOrder(id)));

  const ok = results.filter((r) => r.status === "fulfilled");
  const oversold = results.filter((r) => r.status === "rejected" && r.reason.message === "insufficient_inventory");
  const other = results.filter((r) => r.status === "rejected" && r.reason.message !== "insufficient_inventory");
  ok.forEach((r) => createdOrders.push(r.value.id));

  const [{ stock_quantity: finalStock }] =
    await sql`SELECT stock_quantity FROM shop.product_variant WHERE id = ${variant.id}`;
  const orderNumbers = ok.map((r) => r.value.order_number);

  console.log(`Succeeded: ${ok.length}   rejected (no stock): ${oversold.length}   other errors: ${other.length}`);
  other.forEach((r) => console.log(`    unexpected: ${r.reason.message}`));
  console.log(`Stock after: ${finalStock}\n`);

  check(`exactly ${STOCK} checkouts succeeded`, ok.length === STOCK, `got ${ok.length}`);
  check(`${CONTENDERS - STOCK} rejected for insufficient stock`, oversold.length === CONTENDERS - STOCK, `got ${oversold.length}`);
  check("no unexpected errors", other.length === 0, `got ${other.length}`);
  check("stock landed at exactly 0", finalStock === 0, `got ${finalStock}`);
  check("stock never went negative", finalStock >= 0, `got ${finalStock}`);
  check("order numbers are unique", new Set(orderNumbers).size === orderNumbers.length, orderNumbers.join(","));
  check("one order row per success", createdOrders.length === ok.length);
} finally {
  // Revert everything, in FK-safe order.
  if (createdOrders.length) {
    await sql`DELETE FROM shop.order_item WHERE order_id = ANY(${createdOrders})`;
    await sql`DELETE FROM shop.orders WHERE id = ANY(${createdOrders})`;
  }
  if (createdCarts.length) {
    await sql`DELETE FROM shop.cart_item WHERE cart_id = ANY(${createdCarts})`;
    await sql`DELETE FROM shop.cart WHERE id = ANY(${createdCarts})`;
  }
  await sql`UPDATE shop.product_variant SET stock_quantity = ${originalStock} WHERE id = ${variant.id}`;
  const [v] = await sql`SELECT stock_quantity FROM shop.product_variant WHERE id = ${variant.id}`;
  console.log(`\nReverted. ${variant.sku} stock restored to ${v.stock_quantity}.`);
  await sql.end();
  process.exit(failures === 0 ? 0 : 1);
}
