// Creates or removes a single test order, for verifying the admin's order
// screens without walking the storefront checkout by hand each time.
//
//   node db/seed-test-order.mjs create
//   node db/seed-test-order.mjs remove
//
// Everything it creates is tagged with an @example.test email so `remove`
// can find it precisely and never touch a real order.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(dir, "../.env.local"), "utf8");
const sql = postgres(env.match(/^DATABASE_URL=(.*)$/m)[1].trim(), { ssl: "require", max: 1 });

const TEST_EMAIL = "admin-verify@example.test";
const mode = process.argv[2] ?? "create";

try {
  if (mode === "remove") {
    const ids = (await sql`SELECT id FROM shop.orders WHERE email = ${TEST_EMAIL}`).map((r) => r.id);
    if (ids.length) {
      // Stock restoration is the admin's job to prove, so this only undoes
      // the rows — it deliberately does NOT re-add stock, or a failed cancel
      // would be masked by the cleanup.
      await sql`DELETE FROM shop.inventory_movement WHERE order_id = ANY(${ids})`;
      await sql`DELETE FROM shop.discount_redemption WHERE order_id = ANY(${ids})`;
      await sql`DELETE FROM shop.order_event WHERE order_id = ANY(${ids})`;
      await sql`DELETE FROM shop.order_item WHERE order_id = ANY(${ids})`;
      await sql`DELETE FROM shop.orders WHERE id = ANY(${ids})`;
    }
    console.log(`Removed ${ids.length} test order(s).`);
  } else {
    const [variant] = await sql`
      SELECT v.id, v.sku, v.price_cents, v.stock_quantity, v.product_id, p.title, p.slug
        FROM shop.product_variant v JOIN shop.product p ON p.id = v.product_id
       WHERE v.sku = 'SET-KATSAROLES-5TEM'`;

    const quantity = 2;
    const subtotal = variant.price_cents * quantity;
    const shipping = 1000;
    const total = subtotal + shipping;
    const vat = Math.round((total * 24) / 124);

    const order = await sql.begin(async (tx) => {
      await tx`
        UPDATE shop.product_variant SET stock_quantity = stock_quantity - ${quantity}
         WHERE id = ${variant.id} AND stock_quantity >= ${quantity}`;

      const [o] = await tx`
        INSERT INTO shop.orders (
          email, phone, status, payment_status, fulfillment_status,
          subtotal_cents, discount_cents, shipping_cents, vat_cents, total_cents,
          shipping_address, billing_address, shipping_method_name, tax_document_type)
        VALUES (
          ${TEST_EMAIL}, '2101234567', 'pending', 'unpaid', 'unfulfilled',
          ${subtotal}, 0, ${shipping}, ${vat}, ${total},
          ${sql.json({ first_name: "Δοκιμαστική", last_name: "Παραγγελία", address_1: "Ερμού 12",
                       city: "Αθήνα", postal_code: "10563", country_code: "gr", phone: "2101234567" })},
          ${sql.json({ first_name: "Δοκιμαστική", last_name: "Παραγγελία", address_1: "Ερμού 12",
                       city: "Αθήνα", postal_code: "10563", country_code: "gr" })},
          'Standard Shipping', 'receipt')
        RETURNING id, order_number`;

      await tx`
        INSERT INTO shop.order_item (order_id, variant_id, product_id, title, variant_title, sku,
                                     product_slug, quantity, unit_price_cents, line_total_cents)
        VALUES (${o.id}, ${variant.id}, ${variant.product_id}, ${variant.title}, 'Default',
                ${variant.sku}, ${variant.slug}, ${quantity}, ${variant.price_cents}, ${subtotal})`;

      await tx`
        INSERT INTO shop.inventory_movement (variant_id, delta, reason, order_id)
        VALUES (${variant.id}, ${-quantity}, 'order', ${o.id})`;

      await tx`
        INSERT INTO shop.order_event (order_id, type, to_status, note)
        VALUES (${o.id}, 'created', 'pending', 'Δοκιμαστική παραγγελία επαλήθευσης')`;

      return o;
    });

    const [after] = await sql`SELECT stock_quantity FROM shop.product_variant WHERE id = ${variant.id}`;
    console.log(`Created order #${order.order_number} (${TEST_EMAIL})`);
    console.log(`  ${variant.sku}: stock ${variant.stock_quantity} → ${after.stock_quantity}`);
    console.log(`  total ${(total / 100).toFixed(2)} €  (VAT ${(vat / 100).toFixed(2)} €)`);
  }
} finally {
  await sql.end();
}
