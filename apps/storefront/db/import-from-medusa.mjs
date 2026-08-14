// Copies real business data out of Medusa's `public` tables into `shop`.
//
// READ-ONLY against every Medusa table — it never writes to `public`. Medusa
// stays the source of truth until the final cutover, so this is safe to run
// repeatedly: every insert is an upsert keyed on the natural key (slug/sku),
// so re-running re-syncs rather than duplicating.
//
//   node db/import-from-medusa.mjs
//   node db/import-from-medusa.mjs --verify   assert counts only, no writes
//
// Deliberately NOT migrated (MIGRATION_AUDIT.md §12.5): the 4 soft-deleted
// Medusa demo products and 4 demo categories, USD prices, regions/countries,
// test promo codes, the 4 development orders, customer password hashes, and
// every Medusa infrastructure table.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.dirname(fileURLToPath(import.meta.url));
const verifyOnly = process.argv.includes("--verify");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; })
  );
}
const url =
  process.env.DATABASE_URL ||
  readEnvFile(path.join(dir, "../.env.local")).DATABASE_URL ||
  readEnvFile(path.join(dir, "../../backend/apps/backend/.env")).DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not found");

const sql = postgres(url, { ssl: "require", max: 1 });
const eur = (amount) => Math.round(Number(amount) * 100); // Medusa stores decimal euros

const report = [];
function log(label, value) {
  report.push([label, value]);
  console.log(`  ${String(value).padStart(6)}  ${label}`);
}

try {
  if (verifyOnly) {
    const checks = await sql`
      SELECT
        (SELECT COUNT(*) FROM shop.category)         AS categories,
        (SELECT COUNT(*) FROM shop.product)          AS products,
        (SELECT COUNT(*) FROM shop.product_variant)  AS variants,
        (SELECT COUNT(*) FROM shop.customer)         AS customers,
        (SELECT COUNT(*) FROM shop.shipping_method)  AS shipping,
        (SELECT COUNT(*) FROM shop.seo_meta)         AS seo,
        (SELECT COUNT(*) FROM shop.product_variant WHERE compare_at_price_cents IS NOT NULL) AS on_sale,
        (SELECT COUNT(*) FROM shop.product WHERE category_id IS NULL) AS uncategorised,
        (SELECT COUNT(*) FROM shop.product_variant WHERE price_cents = 0) AS zero_priced`;
    console.log(checks[0]);
    process.exit(0);
  }

  console.log("Importing from Medusa (public) → shop\n");

  // --- Categories. Two passes: parents exist before children reference them.
  const medusaCats = await sql`
    SELECT id, handle, name, description, parent_category_id, rank, is_active
      FROM product_category WHERE deleted_at IS NULL ORDER BY parent_category_id NULLS FIRST, rank`;

  for (const c of medusaCats) {
    await sql`
      INSERT INTO shop.category (slug, name, description, sort_order, is_active)
      VALUES (${c.handle}, ${c.name}, ${c.description || null}, ${c.rank ?? 0}, ${c.is_active})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active`;
  }
  // Second pass: wire parents by slug, now that every row exists.
  const catIdBySlug = new Map((await sql`SELECT id, slug FROM shop.category`).map((r) => [r.slug, r.id]));
  const medusaCatSlugById = new Map(medusaCats.map((c) => [c.id, c.handle]));
  for (const c of medusaCats) {
    if (!c.parent_category_id) continue;
    const parentSlug = medusaCatSlugById.get(c.parent_category_id);
    const parentId = parentSlug ? catIdBySlug.get(parentSlug) : null;
    if (parentId) await sql`UPDATE shop.category SET parent_id = ${parentId} WHERE slug = ${c.handle}`;
  }
  log("categories", medusaCats.length);

  // --- Products, with their single category and native characteristics.
  const medusaProducts = await sql`
    SELECT p.id, p.handle, p.title, p.description, p.status, p.created_at,
           p.material, p.weight, p.length, p.width, p.height, p.origin_country,
           c.handle AS category_handle,
           pe.badge_label, pe.warranty_text, pe.hide_from_search, pe.is_search_boosted
      FROM product p
      LEFT JOIN product_category_product pcp ON pcp.product_id = p.id
      LEFT JOIN product_category c ON c.id = pcp.product_category_id AND c.deleted_at IS NULL
      LEFT JOIN product_extra pe ON pe.product_id = p.id
     WHERE p.deleted_at IS NULL
     ORDER BY p.created_at`;

  for (const p of medusaProducts) {
    await sql`
      INSERT INTO shop.product (
        slug, title, description, category_id, is_active, created_at,
        material, weight_grams, length_cm, width_cm, height_cm, origin_country,
        badge_label, warranty_text, hide_from_search, is_search_boosted)
      VALUES (
        ${p.handle}, ${p.title}, ${p.description || null},
        ${p.category_handle ? catIdBySlug.get(p.category_handle) ?? null : null},
        ${p.status === "published"}, ${p.created_at},
        ${p.material}, ${p.weight}, ${p.length}, ${p.width}, ${p.height}, ${p.origin_country},
        ${p.badge_label || null}, ${p.warranty_text || null},
        ${p.hide_from_search ?? false}, ${p.is_search_boosted ?? false})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description,
        category_id = EXCLUDED.category_id, is_active = EXCLUDED.is_active,
        material = EXCLUDED.material, weight_grams = EXCLUDED.weight_grams,
        length_cm = EXCLUDED.length_cm, width_cm = EXCLUDED.width_cm,
        height_cm = EXCLUDED.height_cm, origin_country = EXCLUDED.origin_country,
        badge_label = EXCLUDED.badge_label, warranty_text = EXCLUDED.warranty_text,
        hide_from_search = EXCLUDED.hide_from_search,
        is_search_boosted = EXCLUDED.is_search_boosted`;
  }
  log("products", medusaProducts.length);

  // --- Variants: flatten Medusa's price_set → price_rule → price machinery
  // and its price_list "sale" indirection into two plain integer columns.
  // A price_list price is the SALE price; the base price becomes compare_at.
  const productIdBySlug = new Map((await sql`SELECT id, slug FROM shop.product`).map((r) => [r.slug, r.id]));

  const variants = await sql`
    SELECT p.handle AS product_handle, v.id, v.sku, v.title, v.allow_backorder,
           MAX(CASE WHEN pr.price_list_id IS NULL     THEN pr.amount END) AS base_amount,
           MAX(CASE WHEN pr.price_list_id IS NOT NULL THEN pr.amount END) AS sale_amount,
           MAX(il.stocked_quantity) AS stock
      FROM product p
      JOIN product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      LEFT JOIN product_variant_price_set vps ON vps.variant_id = v.id
      LEFT JOIN price pr ON pr.price_set_id = vps.price_set_id
             AND pr.deleted_at IS NULL AND pr.currency_code = 'eur'
      LEFT JOIN product_variant_inventory_item pvii
             ON pvii.variant_id = v.id AND pvii.deleted_at IS NULL
      LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
     WHERE p.deleted_at IS NULL
     GROUP BY p.handle, v.id, v.sku, v.title, v.variant_rank
     ORDER BY p.handle, v.variant_rank`;

  let onSale = 0;
  for (const v of variants) {
    if (v.base_amount == null && v.sale_amount == null) {
      console.warn(`  !! ${v.sku}: no EUR price in Medusa — skipped`);
      continue;
    }
    const base = v.base_amount != null ? eur(v.base_amount) : null;
    const sale = v.sale_amount != null ? eur(v.sale_amount) : null;
    // On sale only when the list price is genuinely lower than the base.
    const isOnSale = sale != null && base != null && sale < base;
    if (isOnSale) onSale++;

    await sql`
      INSERT INTO shop.product_variant (
        product_id, sku, title, price_cents, compare_at_price_cents,
        stock_quantity, allow_backorder, position)
      VALUES (
        ${productIdBySlug.get(v.product_handle)}, ${v.sku},
        ${v.title || "Default"},
        ${isOnSale ? sale : base ?? sale},
        ${isOnSale ? base : null},
        ${v.stock ?? 0}, ${v.allow_backorder ?? false}, 0)
      ON CONFLICT (sku) DO UPDATE SET
        price_cents = EXCLUDED.price_cents,
        compare_at_price_cents = EXCLUDED.compare_at_price_cents,
        stock_quantity = EXCLUDED.stock_quantity,
        allow_backorder = EXCLUDED.allow_backorder`;
  }
  log("variants", variants.length);
  log("  of which on sale", onSale);

  // --- Shipping methods (Medusa fulfillment options → three flat rows).
  const shipping = await sql`
    SELECT so.name, sot.code AS type_code, so.provider_id,
           MAX(pr.amount) AS amount
      FROM shipping_option so
      LEFT JOIN shipping_option_type sot ON sot.id = so.shipping_option_type_id
      LEFT JOIN shipping_option_price_set sops ON sops.shipping_option_id = so.id
      LEFT JOIN price pr ON pr.price_set_id = sops.price_set_id
             AND pr.currency_code = 'eur' AND pr.deleted_at IS NULL
     WHERE so.deleted_at IS NULL
     GROUP BY so.name, sot.code, so.provider_id`;

  for (const [i, s] of shipping.entries()) {
    const isPickup = s.type_code === "pickup" || String(s.provider_id).includes("store-pickup");
    const existing = await sql`SELECT id FROM shop.shipping_method WHERE name = ${s.name}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO shop.shipping_method (name, price_cents, is_pickup, sort_order)
        VALUES (${s.name}, ${s.amount != null ? eur(s.amount) : 0}, ${isPickup}, ${i})`;
    } else {
      await sql`
        UPDATE shop.shipping_method
           SET price_cents = ${s.amount != null ? eur(s.amount) : 0}, is_pickup = ${isPickup}
         WHERE id = ${existing[0].id}`;
    }
  }
  log("shipping methods", shipping.length);

  // --- Customers. Password hashes are deliberately NOT carried across:
  // Medusa's scrypt parameters differ from ours and a hash cannot be
  // re-derived. All 3 account holders are test accounts (MIGRATION_AUDIT
  // §6.4) — they reset their password, or simply re-register.
  const customers = await sql`
    SELECT email, first_name, last_name, phone, has_account, created_at
      FROM customer WHERE deleted_at IS NULL AND email IS NOT NULL`;
  for (const c of customers) {
    await sql`
      INSERT INTO shop.customer (email, first_name, last_name, phone, created_at)
      VALUES (${c.email}, ${c.first_name}, ${c.last_name}, ${c.phone}, ${c.created_at})
      ON CONFLICT (lower(email)) DO UPDATE SET
        first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone`;
  }
  log("customers (no passwords)", customers.length);

  // --- CMS singletons.
  const [siteSetting] = await sql`SELECT * FROM site_setting LIMIT 1`;
  if (siteSetting) {
    await sql`
      INSERT INTO shop.site_setting (
        id, footer_tagline, contact_phone, contact_email, contact_address,
        business_hours, facebook_url, instagram_url, tiktok_url,
        announcement_text, cart_message)
      VALUES (
        true, ${siteSetting.footer_tagline}, ${siteSetting.contact_phone},
        ${siteSetting.contact_email}, ${siteSetting.contact_address},
        ${siteSetting.business_hours}, ${siteSetting.facebook_url},
        ${siteSetting.instagram_url}, ${siteSetting.tiktok_url},
        ${siteSetting.announcement_text}, ${siteSetting.cart_message})
      ON CONFLICT (id) DO UPDATE SET
        footer_tagline = EXCLUDED.footer_tagline, contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email, contact_address = EXCLUDED.contact_address,
        business_hours = EXCLUDED.business_hours, facebook_url = EXCLUDED.facebook_url,
        instagram_url = EXCLUDED.instagram_url, tiktok_url = EXCLUDED.tiktok_url,
        announcement_text = EXCLUDED.announcement_text, cart_message = EXCLUDED.cart_message`;
    log("site settings", 1);
  }

  const [promo] = await sql`SELECT * FROM promo_banner LIMIT 1`;
  if (promo) {
    await sql`
      INSERT INTO shop.promo_banner (id, headline, body, cta_label, cta_href, is_published)
      VALUES (true, ${promo.headline}, ${promo.body}, ${promo.cta_label}, ${promo.cta_href}, ${promo.is_published})
      ON CONFLICT (id) DO UPDATE SET
        headline = EXCLUDED.headline, body = EXCLUDED.body,
        cta_label = EXCLUDED.cta_label, cta_href = EXCLUDED.cta_href,
        is_published = EXCLUDED.is_published`;
    log("promo banner", 1);
  }

  const [analytics] = await sql`SELECT * FROM analytics_setting LIMIT 1`;
  if (analytics) {
    await sql`
      INSERT INTO shop.analytics_setting (id, ga4_measurement_id, gtm_container_id, meta_pixel_id, clarity_project_id)
      VALUES (true, ${analytics.ga4_measurement_id}, ${analytics.gtm_container_id},
              ${analytics.meta_pixel_id}, ${analytics.clarity_project_id})
      ON CONFLICT (id) DO UPDATE SET
        ga4_measurement_id = EXCLUDED.ga4_measurement_id,
        gtm_container_id = EXCLUDED.gtm_container_id,
        meta_pixel_id = EXCLUDED.meta_pixel_id,
        clarity_project_id = EXCLUDED.clarity_project_id`;
    log("analytics settings", 1);
  }

  const pages = await sql`SELECT slug, title, body, is_published FROM content_page`;
  for (const p of pages) {
    await sql`
      INSERT INTO shop.content_page (slug, title, body, is_published)
      VALUES (${p.slug}, ${p.title || p.slug}, ${p.body}, ${p.is_published})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title, body = EXCLUDED.body, is_published = EXCLUDED.is_published`;
  }
  log("content pages", pages.length);

  const synonyms = await sql`SELECT terms FROM search_synonym`;
  for (const s of synonyms) {
    const dup = await sql`SELECT id FROM shop.search_synonym WHERE terms = ${s.terms}`;
    if (dup.length === 0) await sql`INSERT INTO shop.search_synonym (terms) VALUES (${s.terms})`;
  }
  log("search synonyms", synonyms.length);

  // --- SEO. Medusa ids mean nothing in the new schema, so each row is
  // re-pointed at the new uuid via the stable handle/slug.
  const seoRows = await sql`SELECT * FROM seo`;
  let seoImported = 0;
  for (const s of seoRows) {
    let resourceId = s.resource_id;
    if (s.resource_type === "product") {
      const [m] = await sql`SELECT handle FROM product WHERE id = ${s.resource_id}`;
      resourceId = m ? productIdBySlug.get(m.handle) : null;
    } else if (s.resource_type === "category") {
      const [m] = await sql`SELECT handle FROM product_category WHERE id = ${s.resource_id}`;
      resourceId = m ? catIdBySlug.get(m.handle) : null;
    }
    if (!resourceId) { console.warn(`  !! seo ${s.resource_type}/${s.resource_id}: no match — skipped`); continue; }

    await sql`
      INSERT INTO shop.seo_meta (
        resource_type, resource_id, seo_title, meta_description, canonical_url,
        og_title, og_description, keywords, robots)
      VALUES (
        ${s.resource_type}, ${String(resourceId)}, ${s.seo_title}, ${s.meta_description},
        ${s.canonical_url}, ${s.og_title}, ${s.og_description}, ${s.keywords}, ${s.robots || "index"})
      ON CONFLICT (resource_type, resource_id) DO UPDATE SET
        seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
        canonical_url = EXCLUDED.canonical_url, og_title = EXCLUDED.og_title,
        og_description = EXCLUDED.og_description, keywords = EXCLUDED.keywords,
        robots = EXCLUDED.robots`;
    seoImported++;
  }
  log("seo rows", seoImported);

  console.log("\nDone. Medusa's tables were not modified.");
} finally {
  await sql.end();
}
