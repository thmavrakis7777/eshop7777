-- 0001_init.sql — the custom commerce schema.
--
-- Lives in its own `shop` schema, NOT `public`, for three reasons documented
-- in MIGRATION_AUDIT.md §8.3:
--   1. Medusa already owns public.product / customer / order / cart / image /
--      product_category / seo / site_setting / content_page / homepage_block /
--      media_asset. Every one of those names collides with a table we need.
--   2. Both systems can therefore run side by side through the whole
--      migration, with the new code never writing to a Medusa table.
--   3. Supabase's PostgREST only exposes schemas on its configured list
--      (`public` by default), so `shop` is not reachable via the Data API at
--      all — strictly stronger than the current zero-policy RLS lockdown,
--      which we also apply here as defence in depth.
--
-- Conventions:
--   * Money is ALWAYS integer cents (`*_cents int`). Never float, never numeric.
--     Prices are VAT-INCLUSIVE (Greek B2C law) — see `vat_rate` below.
--   * Timestamps are `timestamptz`, defaulted to now(), with an updated_at
--     trigger where the column exists.
--   * Status columns are `text` + CHECK rather than PG enums: adding a value
--     to an enum needs a migration and locks, a CHECK is a cheap swap.
--   * Tables are singular, with ONE exception: `orders`. "order" is a reserved
--     SQL word and would need quoting in every single query it appears in —
--     a permanent syntax-error trap for a purely cosmetic gain.

CREATE SCHEMA IF NOT EXISTS shop;

-- gen_random_uuid() comes from pgcrypto, already installed on this database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION shop.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Human-facing order numbers. A SEQUENCE, never MAX(id)+1: concurrent
-- checkouts must never be able to mint the same number (MIGRATION_AUDIT §6.1).
-- Starts at 1000 so the first real order doesn't read as a test.
CREATE SEQUENCE IF NOT EXISTS shop.order_number_seq START 1000;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  name          text NOT NULL,
  description   text,
  parent_id     uuid REFERENCES shop.category(id) ON DELETE RESTRICT,
  image_path    text,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS category_slug_key ON shop.category (slug);
CREATE INDEX IF NOT EXISTS category_parent_idx ON shop.category (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS shop.collection (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  title         text NOT NULL,
  description   text,
  image_path    text,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_slug_key ON shop.collection (slug);

CREATE TABLE IF NOT EXISTS shop.product (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL,
  title            text NOT NULL,
  description      text,
  category_id      uuid REFERENCES shop.category(id) ON DELETE SET NULL,
  is_active        boolean NOT NULL DEFAULT false,
  -- Admin override for New Arrivals membership. The storefront rule stays
  -- "created within the rolling window OR this flag" — preserved from
  -- lib/data/products.ts, where it was a native Medusa product tag.
  is_new_override  boolean NOT NULL DEFAULT false,
  -- NULL means "use site_setting.default_vat_rate" (24). Present only as
  -- insurance for Greece's reduced 13%/6% bands; all current stock is 24%.
  vat_rate         numeric(5,2),
  -- Real product characteristics — typed columns, not a metadata blob.
  -- Mirrors ProductCharacteristics in lib/types.ts exactly.
  material         text,
  weight_grams     int,
  length_cm        numeric(10,2),
  width_cm         numeric(10,2),
  height_cm        numeric(10,2),
  origin_country   text,
  -- Merchandising (was the `product_extra` Medusa module).
  badge_label      text,
  warranty_text    text,
  hide_from_search    boolean NOT NULL DEFAULT false,
  is_search_boosted   boolean NOT NULL DEFAULT false,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_slug_key ON shop.product (slug);
CREATE INDEX IF NOT EXISTS product_category_idx ON shop.product (category_id, is_active);
CREATE INDEX IF NOT EXISTS product_active_created_idx ON shop.product (is_active, created_at DESC);

-- Real variants (decision 2). A product with one variant has zero options —
-- the option tables stay empty and the single variant is simply the default.
CREATE TABLE IF NOT EXISTS shop.product_option (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  name        text NOT NULL,          -- e.g. "Μέγεθος"
  position    int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_option_product_idx ON shop.product_option (product_id, position);

CREATE TABLE IF NOT EXISTS shop.product_option_value (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id  uuid NOT NULL REFERENCES shop.product_option(id) ON DELETE CASCADE,
  value      text NOT NULL,           -- e.g. "28cm"
  position   int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_option_value_option_idx ON shop.product_option_value (option_id, position);

CREATE TABLE IF NOT EXISTS shop.product_variant (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  sku                     text NOT NULL,
  title                   text NOT NULL DEFAULT 'Default',
  -- VAT-INCLUSIVE price, in cents. compare_at is the pre-discount price and
  -- must be > price_cents to count as "on sale" (the storefront derives the
  -- discount percentage from the pair, never stores it).
  price_cents             int NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents  int CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0),
  stock_quantity          int NOT NULL DEFAULT 0,
  allow_backorder         boolean NOT NULL DEFAULT false,
  position                int NOT NULL DEFAULT 0,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variant_sku_key ON shop.product_variant (sku);
CREATE INDEX IF NOT EXISTS product_variant_product_idx ON shop.product_variant (product_id, position);
-- Partial index: the admin's low-stock widget only ever asks about small
-- numbers, so indexing the whole column would be wasted work.
CREATE INDEX IF NOT EXISTS product_variant_low_stock_idx
  ON shop.product_variant (stock_quantity) WHERE stock_quantity <= 5;

CREATE TABLE IF NOT EXISTS shop.product_variant_option_value (
  variant_id       uuid NOT NULL REFERENCES shop.product_variant(id) ON DELETE CASCADE,
  option_value_id  uuid NOT NULL REFERENCES shop.product_option_value(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_value_id)
);

CREATE TABLE IF NOT EXISTS shop.product_image (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  -- Path within the Supabase Storage bucket, NOT a full URL: the public URL
  -- is derived at render time, so moving buckets/CDN never rewrites rows.
  storage_path  text NOT NULL,
  alt_text      text,
  position      int NOT NULL DEFAULT 0,
  width         int,
  height        int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_image_product_idx ON shop.product_image (product_id, position);
-- The primary image is simply position 0 — one source of truth, so there is
-- no way to end up with two "primary" rows or none.

CREATE TABLE IF NOT EXISTS shop.product_collection (
  product_id     uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  collection_id  uuid NOT NULL REFERENCES shop.collection(id) ON DELETE CASCADE,
  sort_order     int NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_id)
);
CREATE INDEX IF NOT EXISTS product_collection_collection_idx
  ON shop.product_collection (collection_id, sort_order);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.customer (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  -- NULL for a guest who has ordered but never registered. Never plaintext:
  -- scrypt via node:crypto, stored as `salt:derivedKey` hex (lib/auth).
  password_hash      text,
  first_name         text,
  last_name          text,
  phone              text,
  marketing_consent  boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness without needing the citext extension.
CREATE UNIQUE INDEX IF NOT EXISTS customer_email_key ON shop.customer (lower(email));

CREATE TABLE IF NOT EXISTS shop.customer_address (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          uuid NOT NULL REFERENCES shop.customer(id) ON DELETE CASCADE,
  label                text,
  first_name           text,
  last_name            text,
  address_1            text NOT NULL,
  address_2            text,
  city                 text NOT NULL,
  postal_code          text NOT NULL,
  country_code         text NOT NULL DEFAULT 'gr',
  phone                text,
  is_default_shipping  boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_address_customer_idx ON shop.customer_address (customer_id);

-- Opaque server-side sessions, not JWTs: revocable instantly, no refresh
-- dance, no secret-rotation footgun. Only the SHA-256 of the token is stored,
-- so a database leak does not hand over live sessions.
CREATE TABLE IF NOT EXISTS shop.customer_session (
  token_hash   text PRIMARY KEY,
  customer_id  uuid NOT NULL REFERENCES shop.customer(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_session_customer_idx ON shop.customer_session (customer_id);
CREATE INDEX IF NOT EXISTS customer_session_expiry_idx ON shop.customer_session (expires_at);

CREATE TABLE IF NOT EXISTS shop.password_reset_token (
  token_hash   text PRIMARY KEY,
  customer_id  uuid NOT NULL REFERENCES shop.customer(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop.wishlist_item (
  customer_id  uuid NOT NULL REFERENCES shop.customer(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES shop.product(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_item_product_idx ON shop.wishlist_item (product_id);

-- ---------------------------------------------------------------------------
-- Commerce: shipping, discounts, cart
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.shipping_method (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  description      text,
  price_cents      int NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  -- NULL = never free. Otherwise the cart subtotal above which this method
  -- costs nothing (drives FreeShippingProgress on the storefront).
  free_over_cents  int,
  is_pickup        boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop.discount (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL,
  description        text,
  type               text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  -- Percent (0-100) when type='percentage', else cents.
  value              int NOT NULL CHECK (value >= 0),
  min_subtotal_cents int NOT NULL DEFAULT 0,
  starts_at          timestamptz,
  ends_at            timestamptz,
  max_redemptions    int,
  redemption_count   int NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_percentage_range
    CHECK (type <> 'percentage' OR value <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS discount_code_key ON shop.discount (lower(code));

CREATE TABLE IF NOT EXISTS shop.cart (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES shop.customer(id) ON DELETE SET NULL,
  email               text,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'abandoned')),
  shipping_address    jsonb,
  billing_address     jsonb,
  shipping_method_id  uuid REFERENCES shop.shipping_method(id) ON DELETE SET NULL,
  discount_id         uuid REFERENCES shop.discount(id) ON DELETE SET NULL,
  -- Real typed columns, not a metadata blob — this data was previously
  -- smuggled through Medusa's cart.metadata because the core model had
  -- nowhere to put it (CHECKOUT_PREMIUM_SPEC.md §4).
  tax_document_type   text NOT NULL DEFAULT 'receipt'
                        CHECK (tax_document_type IN ('receipt', 'invoice')),
  invoice_company_name text,
  invoice_afm          text,
  invoice_doy          text,
  invoice_activity     text,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cart_customer_idx ON shop.cart (customer_id);
CREATE INDEX IF NOT EXISTS cart_expiry_idx ON shop.cart (expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS shop.cart_item (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id                 uuid NOT NULL REFERENCES shop.cart(id) ON DELETE CASCADE,
  variant_id              uuid NOT NULL REFERENCES shop.product_variant(id) ON DELETE RESTRICT,
  quantity                int NOT NULL CHECK (quantity > 0),
  -- Snapshotted at add-to-cart time so the line stays coherent if the product
  -- is renamed or re-priced underneath the customer. Order completion still
  -- re-prices from the live variant — the snapshot is for display, never for
  -- charging (MIGRATION_AUDIT §8.6).
  title                   text NOT NULL,
  sku                     text,
  product_slug            text NOT NULL,
  unit_price_cents        int NOT NULL,
  compare_at_price_cents  int,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cart_item_unique ON shop.cart_item (cart_id, variant_id);

-- ---------------------------------------------------------------------------
-- Commerce: orders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        int NOT NULL DEFAULT nextval('shop.order_number_seq'),
  customer_id         uuid REFERENCES shop.customer(id) ON DELETE SET NULL,
  email               text NOT NULL,
  phone               text,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status      text NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid','paid','refunded','partially_refunded')),
  fulfillment_status  text NOT NULL DEFAULT 'unfulfilled'
                        CHECK (fulfillment_status IN ('unfulfilled','fulfilled','partially_fulfilled','returned')),
  -- All VAT-INCLUSIVE except vat_cents, which is the breakdown line:
  --   subtotal_cents - discount_cents + shipping_cents = total_cents
  --   vat_cents = round(total_cents * rate / (100 + rate))
  subtotal_cents      int NOT NULL,
  discount_cents      int NOT NULL DEFAULT 0,
  shipping_cents      int NOT NULL DEFAULT 0,
  vat_cents           int NOT NULL DEFAULT 0,
  total_cents         int NOT NULL,
  vat_rate            numeric(5,2) NOT NULL DEFAULT 24,
  currency_code       text NOT NULL DEFAULT 'EUR',
  shipping_address    jsonb,
  billing_address     jsonb,
  shipping_method_name text,
  payment_method      text NOT NULL DEFAULT 'cod',
  discount_code       text,
  tax_document_type   text NOT NULL DEFAULT 'receipt'
                        CHECK (tax_document_type IN ('receipt', 'invoice')),
  invoice_company_name text,
  invoice_afm          text,
  invoice_doy          text,
  invoice_activity     text,
  customer_note       text,
  admin_note          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_number_key ON shop.orders (order_number);
CREATE INDEX IF NOT EXISTS orders_created_idx ON shop.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON shop.orders (status);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON shop.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_email_idx ON shop.orders (lower(email));

CREATE TABLE IF NOT EXISTS shop.order_item (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: deleting a product must never silently rewrite
  -- financial history. The snapshot columns keep the line readable forever.
  variant_id        uuid REFERENCES shop.product_variant(id) ON DELETE SET NULL,
  product_id        uuid REFERENCES shop.product(id) ON DELETE SET NULL,
  title             text NOT NULL,
  variant_title     text,
  sku               text,
  product_slug      text,
  quantity          int NOT NULL CHECK (quantity > 0),
  unit_price_cents  int NOT NULL,
  line_total_cents  int NOT NULL
);
CREATE INDEX IF NOT EXISTS order_item_order_idx ON shop.order_item (order_id);
CREATE INDEX IF NOT EXISTS order_item_product_idx ON shop.order_item (product_id);

-- The status-history timeline shown on the admin order detail page.
CREATE TABLE IF NOT EXISTS shop.order_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
  type           text NOT NULL,
  from_status    text,
  to_status      text,
  note           text,
  admin_user_id  uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_event_order_idx ON shop.order_event (order_id, created_at);

CREATE TABLE IF NOT EXISTS shop.discount_redemption (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id  uuid NOT NULL REFERENCES shop.discount(id) ON DELETE CASCADE,
  order_id     uuid NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES shop.customer(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discount_redemption_discount_idx ON shop.discount_redemption (discount_id);

-- Audit trail for every stock change. Makes "why is this product at 3?" a
-- question with an answer, and is the debugging surface for §6.1.
CREATE TABLE IF NOT EXISTS shop.inventory_movement (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     uuid NOT NULL REFERENCES shop.product_variant(id) ON DELETE CASCADE,
  delta          int NOT NULL,
  reason         text NOT NULL CHECK (reason IN ('order','cancel','manual','import','correction')),
  order_id       uuid REFERENCES shop.orders(id) ON DELETE SET NULL,
  admin_user_id  uuid,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movement_variant_idx
  ON shop.inventory_movement (variant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop.admin_user (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  role           text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_user_email_key ON shop.admin_user (lower(email));

CREATE TABLE IF NOT EXISTS shop.admin_session (
  token_hash     text PRIMARY KEY,
  admin_user_id  uuid NOT NULL REFERENCES shop.admin_user(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_session_user_idx ON shop.admin_session (admin_user_id);

CREATE TABLE IF NOT EXISTS shop.admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid REFERENCES shop.admin_user(id) ON DELETE SET NULL,
  action         text NOT NULL,
  entity_type    text,
  entity_id      text,
  diff           jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON shop.admin_audit_log (created_at DESC);

-- Simple, durable rate limiting for login/register/reset. A table rather than
-- in-memory state because serverless instances don't share memory.
CREATE TABLE IF NOT EXISTS shop.rate_limit (
  key          text PRIMARY KEY,
  count        int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Storefront content (CMS)
-- ---------------------------------------------------------------------------

-- Singleton. Enforced by a one-row CHECK on a fixed primary key rather than
-- by convention in application code, which is what the Medusa modules did.
CREATE TABLE IF NOT EXISTS shop.site_setting (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  store_name             text,
  logo_path              text,
  footer_tagline         text,
  contact_phone          text,
  contact_email          text,
  contact_address        text,
  business_hours         text,
  facebook_url           text,
  instagram_url          text,
  tiktok_url             text,
  announcement_text      text,
  cart_message           text,
  free_shipping_threshold_cents int,
  default_vat_rate       numeric(5,2) NOT NULL DEFAULT 24,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop.promo_banner (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  headline     text,
  body         text,
  cta_label    text,
  cta_href     text,
  ends_at      timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop.analytics_setting (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  ga4_measurement_id  text,
  gtm_container_id    text,
  meta_pixel_id       text,
  clarity_project_id  text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop.homepage_block (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('hero', 'promo')),
  eyebrow       text,
  heading       text,
  body          text,
  cta_label     text,
  cta_href      text,
  image_path    text,
  sort_order    int NOT NULL DEFAULT 0,
  is_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homepage_block_kind_idx ON shop.homepage_block (kind, sort_order);

CREATE TABLE IF NOT EXISTS shop.content_page (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  title         text NOT NULL,
  body          text,
  is_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS content_page_slug_key ON shop.content_page (slug);

-- Makes header/footer navigation editable, which it is not today.
CREATE TABLE IF NOT EXISTS shop.nav_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES shop.nav_item(id) ON DELETE CASCADE,
  location    text NOT NULL CHECK (location IN ('header', 'footer')),
  label       text NOT NULL,
  href        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS nav_item_location_idx ON shop.nav_item (location, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS shop.media_asset (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path  text NOT NULL,
  label         text,
  alt_text      text,
  width         int,
  height        int,
  bytes         int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_asset_path_key ON shop.media_asset (storage_path);

CREATE TABLE IF NOT EXISTS shop.seo_meta (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type      text NOT NULL CHECK (resource_type IN ('product','category','collection','page','homepage')),
  resource_id        text NOT NULL,
  seo_title          text,
  meta_description   text,
  canonical_url      text,
  og_title           text,
  og_description     text,
  social_image_path  text,
  keywords           text,
  robots             text NOT NULL DEFAULT 'index' CHECK (robots IN ('index', 'noindex')),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seo_meta_resource_key ON shop.seo_meta (resource_type, resource_id);

CREATE TABLE IF NOT EXISTS shop.search_synonym (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terms  text NOT NULL
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'category','collection','product','product_variant','customer',
    'customer_address','discount','cart','cart_item','orders','admin_user',
    'homepage_block','content_page'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON shop.%I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON shop.%I
         FOR EACH ROW EXECUTE FUNCTION shop.touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: enabled everywhere, zero policies — defence in depth.
--
-- PostgREST does not expose the `shop` schema at all, so this is belt AND
-- braces. The app connects as the table owner and is unaffected; anything
-- arriving through Supabase's Data API sees nothing. Matches the existing
-- posture on all 152 `public` tables exactly (MIGRATION_AUDIT.md §3.3).
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'shop' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE shop.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA shop FROM anon, authenticated;
