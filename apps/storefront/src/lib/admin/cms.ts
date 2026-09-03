import "server-only";
import { sql, transaction } from "@/lib/db/client";
import type { HomepageSectionConfig, HomepageSectionKind } from "@/lib/content-types";
import { listCategoryTree } from "@/lib/admin/taxonomy";
import { LOYALTY_REWARD_DEFAULT_EXPIRY_DAYS } from "@/lib/loyalty";

/**
 * Storefront content management.
 *
 * The point of this module is that the store owner never needs a developer to
 * change what the shop says. Everything the storefront renders as copy —
 * hero, banners, announcement, footer, contact details, static pages, SEO —
 * is a row here rather than a string in a component.
 */

// The fixed set of static pages. Deliberately not open-ended: each slug has a
// literal route folder on the storefront, so inventing a twelfth here would
// produce a page that is editable but unreachable. Adding one is a real
// change in two places, and that friction is the point.
export const CONTENT_PAGE_SLUGS: Array<{ slug: string; label: string }> = [
  { slug: "sxetika", label: "Σχετικά με εμάς" },
  { slug: "apostoles", label: "Αποστολές & Παράδοση" },
  { slug: "epistrofes", label: "Επιστροφές & Υπαναχώρηση" },
  { slug: "pliromes", label: "Τρόποι Πληρωμής" },
  { slug: "eggyisi", label: "Εγγυήσεις" },
  { slug: "aporrito", label: "Πολιτική Απορρήτου" },
  { slug: "oroi-xrisis", label: "Όροι Χρήσης" },
  { slug: "cookies", label: "Πολιτική Cookies" },
  { slug: "faq", label: "Συχνές Ερωτήσεις" },
  { slug: "epikoinonia", label: "Επικοινωνία" },
  { slug: "paraggelia", label: "Παρακολούθηση Παραγγελίας" },
  { slug: "odigoi-agoron", label: "Οδηγοί Αγορών" },
  { slug: "karieres", label: "Καριέρα" },
];

// The subset that are genuinely legal/compliance pages, not general content
// (Σχετικά, FAQ, Καριέρα, order tracking, buying guides are informational,
// not legal) — used to build the footer's ΝΟΜΙΚΑ section and to decide which
// pages get the fuller legal-template treatment. Order here is the footer's
// display order.
export const LEGAL_PAGE_SLUGS = [
  "oroi-xrisis",
  "aporrito",
  "cookies",
  "epistrofes",
  "apostoles",
  "pliromes",
  "eggyisi",
] as const;

// ---------------------------------------------------------------------------
// Homepage blocks
// ---------------------------------------------------------------------------

export type AdminHomepageBlock = {
  id: string;
  kind: HomepageSectionKind;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imagePath: string | null;
  tabletImagePath: string | null;
  mobileImagePath: string | null;
  imageAlt: string | null;
  config: HomepageSectionConfig;
  sortOrder: number;
  isPublished: boolean;
};

type BlockRow = {
  id: string; kind: HomepageSectionKind; eyebrow: string | null; heading: string | null;
  body: string | null; cta_label: string | null; cta_href: string | null;
  image_path: string | null; tablet_image_path: string | null; mobile_image_path: string | null;
  image_alt: string | null;
  config: HomepageSectionConfig | null; sort_order: number; is_published: boolean;
};

const toAdminBlock = (r: BlockRow): AdminHomepageBlock => ({
  id: r.id, kind: r.kind, eyebrow: r.eyebrow, heading: r.heading, body: r.body,
  ctaLabel: r.cta_label, ctaHref: r.cta_href, imagePath: r.image_path,
  tabletImagePath: r.tablet_image_path,
  mobileImagePath: r.mobile_image_path, imageAlt: r.image_alt, config: r.config ?? {},
  sortOrder: r.sort_order, isPublished: r.is_published,
});

// Ordered exactly as the storefront renders them — the admin list IS the
// page order now, so sorting by kind here would misrepresent the result.
export async function listHomepageBlocks(): Promise<AdminHomepageBlock[]> {
  const rows = await sql<BlockRow[]>`
    SELECT id, kind, eyebrow, heading, body, cta_label, cta_href, image_path,
           tablet_image_path, mobile_image_path, image_alt, config, sort_order, is_published
      FROM shop.homepage_block ORDER BY sort_order, created_at`;
  return rows.map(toAdminBlock);
}

export type SaveHomepageBlockInput = {
  id?: string;
  kind: HomepageSectionKind;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imagePath: string | null;
  tabletImagePath: string | null;
  mobileImagePath: string | null;
  imageAlt: string | null;
  config: HomepageSectionConfig;
  sortOrder: number;
  isPublished: boolean;
};

export async function saveHomepageBlock(input: SaveHomepageBlockInput): Promise<string> {
  // postgres.js's JSONValue type doesn't accept an arbitrary object shape;
  // the config really is plain JSON, so this cast is the honest narrowing.
  const config = sql.json(input.config as Parameters<typeof sql.json>[0]);
  if (input.id) {
    await sql`
      UPDATE shop.homepage_block SET
        kind = ${input.kind}, eyebrow = ${input.eyebrow}, heading = ${input.heading},
        body = ${input.body}, cta_label = ${input.ctaLabel}, cta_href = ${input.ctaHref},
        image_path = ${input.imagePath}, tablet_image_path = ${input.tabletImagePath},
        mobile_image_path = ${input.mobileImagePath},
        image_alt = ${input.imageAlt}, config = ${config},
        sort_order = ${input.sortOrder}, is_published = ${input.isPublished},
        updated_at = now()
      WHERE id = ${input.id}`;
    return input.id;
  }
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.homepage_block (kind, eyebrow, heading, body, cta_label, cta_href,
                                     image_path, tablet_image_path, mobile_image_path, image_alt, config,
                                     sort_order, is_published)
    VALUES (${input.kind}, ${input.eyebrow}, ${input.heading}, ${input.body},
            ${input.ctaLabel}, ${input.ctaHref}, ${input.imagePath}, ${input.tabletImagePath},
            ${input.mobileImagePath}, ${input.imageAlt}, ${config},
            ${input.sortOrder}, ${input.isPublished})
    RETURNING id`;
  return row.id;
}

export async function deleteHomepageBlock(id: string): Promise<void> {
  await sql`DELETE FROM shop.homepage_block WHERE id = ${id}`;
}

/** Show/hide without opening the editor — the list's most-used control. */
export async function setHomepageBlockPublished(id: string, isPublished: boolean): Promise<void> {
  await sql`
    UPDATE shop.homepage_block SET is_published = ${isPublished}, updated_at = now()
     WHERE id = ${id}`;
}

/**
 * Swaps a section with its neighbour. Same approach as category reordering:
 * two rows change, in a transaction, rather than renumbering the whole list
 * — so two admins reordering at once can't interleave into a broken order.
 */
export async function moveHomepageBlock(id: string, direction: "up" | "down"): Promise<void> {
  await transaction(async (tx) => {
    const [current] = await tx<{ sort_order: number; created_at: Date }[]>`
      SELECT sort_order, created_at FROM shop.homepage_block WHERE id = ${id}`;
    if (!current) return;

    // `id <> ${id}` is load-bearing, not belt-and-braces: a JS Date carries
    // millisecond precision while timestamptz stores microseconds, so the
    // round-tripped created_at parameter is fractionally EARLIER than the
    // stored value and the row satisfies its own `>` comparison — every
    // section found itself as its own neighbour and reordering silently
    // did nothing (caught live, not in review).
    const [neighbour] = direction === "up"
      ? await tx<{ id: string; sort_order: number }[]>`
          SELECT id, sort_order FROM shop.homepage_block
           WHERE id <> ${id}
             AND (sort_order, created_at) < (${current.sort_order}, ${current.created_at})
           ORDER BY sort_order DESC, created_at DESC LIMIT 1`
      : await tx<{ id: string; sort_order: number }[]>`
          SELECT id, sort_order FROM shop.homepage_block
           WHERE id <> ${id}
             AND (sort_order, created_at) > (${current.sort_order}, ${current.created_at})
           ORDER BY sort_order, created_at LIMIT 1`;
    if (!neighbour) return; // already at the end — a no-op, not an error

    // Equal sort_order values (possible after an import) would make a plain
    // swap a no-op, so give the pair distinct values around the neighbour's.
    const a = neighbour.sort_order;
    const b = current.sort_order === a ? (direction === "up" ? a - 1 : a + 1) : current.sort_order;
    await tx`UPDATE shop.homepage_block SET sort_order = ${a} WHERE id = ${id}`;
    await tx`UPDATE shop.homepage_block SET sort_order = ${b} WHERE id = ${neighbour.id}`;
  });
}

/** Duplicate a section, unpublished, immediately after the original. */
export async function duplicateHomepageBlock(id: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.homepage_block (
      kind, eyebrow, heading, body, cta_label, cta_href, image_path,
      tablet_image_path, mobile_image_path, image_alt, config, sort_order, is_published)
    SELECT kind, eyebrow, heading, body, cta_label, cta_href, image_path,
           tablet_image_path, mobile_image_path, image_alt, config, sort_order + 1, false
      FROM shop.homepage_block WHERE id = ${id}
    RETURNING id`;
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Site settings (header, footer, contact, social)
// ---------------------------------------------------------------------------

export type AdminSiteSettings = {
  storeName: string | null;
  logoPath: string | null;
  faviconPath: string | null;
  ogImagePath: string | null;
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
  footerTagline: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  businessHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  announcementText: string | null;
  cartMessage: string | null;
  phoneOrdersEnabled: boolean;
  phoneOrdersLabel: string | null;
  freeShippingThresholdCents: number | null;
  defaultVatRate: number;
  legalCompanyName: string | null;
  vatNumber: string | null;
  gemiNumber: string | null;
  // NULL = the €5 loyalty coupon never expires. Read by completeOrder
  // (lib/db/checkout.ts) at issuance time — a later change here only
  // affects coupons issued after the change, never rewrites one already
  // credited to a customer.
  loyaltyRewardExpiryDays: number | null;
  // Global stock-quantity-limit + direct-inquiry feature — see
  // lib/content-types.ts's SiteSettings for the same two fields on the
  // public read side.
  stockInquiryMessage: string | null;
  whatsappPhone: string | null;
};

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const rows = await sql<
    {
      store_name: string | null; logo_path: string | null; footer_tagline: string | null;
      favicon_path: string | null; og_image_path: string | null;
      default_seo_title: string | null; default_seo_description: string | null;
      contact_phone: string | null; contact_email: string | null; contact_address: string | null;
      business_hours: string | null; facebook_url: string | null; instagram_url: string | null;
      tiktok_url: string | null; announcement_text: string | null; cart_message: string | null;
      phone_orders_enabled: boolean | null; phone_orders_label: string | null;
      free_shipping_threshold_cents: number | null; default_vat_rate: number;
      legal_company_name: string | null; vat_number: string | null; gemi_number: string | null;
      loyalty_reward_expiry_days: number | null;
      stock_inquiry_message: string | null; whatsapp_phone: string | null;
    }[]
  >`SELECT store_name, logo_path, favicon_path, og_image_path,
           default_seo_title, default_seo_description,
           footer_tagline, contact_phone, contact_email,
           contact_address, business_hours, facebook_url, instagram_url, tiktok_url,
           announcement_text, cart_message, phone_orders_enabled, phone_orders_label,
           free_shipping_threshold_cents, default_vat_rate,
           legal_company_name, vat_number, gemi_number, loyalty_reward_expiry_days,
           stock_inquiry_message, whatsapp_phone
      FROM shop.site_setting LIMIT 1`;

  const s = rows[0];
  // The singleton is created by the migration, but a fresh database (or a
  // deleted row) must not crash the settings screen.
  if (!s) {
    return {
      storeName: null, logoPath: null, faviconPath: null, ogImagePath: null,
      defaultSeoTitle: null, defaultSeoDescription: null,
      footerTagline: null, contactPhone: null,
      contactEmail: null, contactAddress: null, businessHours: null, facebookUrl: null,
      instagramUrl: null, tiktokUrl: null, announcementText: null, cartMessage: null,
      phoneOrdersEnabled: false, phoneOrdersLabel: null,
      freeShippingThresholdCents: null, defaultVatRate: 24,
      legalCompanyName: null, vatNumber: null, gemiNumber: null,
      loyaltyRewardExpiryDays: LOYALTY_REWARD_DEFAULT_EXPIRY_DAYS,
      stockInquiryMessage: null, whatsappPhone: null,
    };
  }

  return {
    storeName: s.store_name, logoPath: s.logo_path,
    faviconPath: s.favicon_path, ogImagePath: s.og_image_path,
    defaultSeoTitle: s.default_seo_title, defaultSeoDescription: s.default_seo_description,
    footerTagline: s.footer_tagline,
    contactPhone: s.contact_phone, contactEmail: s.contact_email,
    contactAddress: s.contact_address, businessHours: s.business_hours,
    facebookUrl: s.facebook_url, instagramUrl: s.instagram_url, tiktokUrl: s.tiktok_url,
    announcementText: s.announcement_text, cartMessage: s.cart_message,
    phoneOrdersEnabled: s.phone_orders_enabled ?? false,
    phoneOrdersLabel: s.phone_orders_label,
    freeShippingThresholdCents: s.free_shipping_threshold_cents,
    defaultVatRate: Number(s.default_vat_rate),
    legalCompanyName: s.legal_company_name, vatNumber: s.vat_number, gemiNumber: s.gemi_number,
    loyaltyRewardExpiryDays: s.loyalty_reward_expiry_days,
    stockInquiryMessage: s.stock_inquiry_message, whatsappPhone: s.whatsapp_phone,
  };
}

export async function saveSiteSettings(input: AdminSiteSettings): Promise<void> {
  await sql`
    INSERT INTO shop.site_setting (
      id, store_name, logo_path, favicon_path, og_image_path,
      default_seo_title, default_seo_description,
      footer_tagline, contact_phone, contact_email,
      contact_address, business_hours, facebook_url, instagram_url, tiktok_url,
      announcement_text, cart_message, phone_orders_enabled, phone_orders_label,
      free_shipping_threshold_cents, default_vat_rate,
      legal_company_name, vat_number, gemi_number, loyalty_reward_expiry_days,
      stock_inquiry_message, whatsapp_phone, updated_at)
    VALUES (
      true, ${input.storeName}, ${input.logoPath}, ${input.faviconPath},
      ${input.ogImagePath}, ${input.defaultSeoTitle}, ${input.defaultSeoDescription},
      ${input.footerTagline},
      ${input.contactPhone}, ${input.contactEmail}, ${input.contactAddress},
      ${input.businessHours}, ${input.facebookUrl}, ${input.instagramUrl}, ${input.tiktokUrl},
      ${input.announcementText}, ${input.cartMessage}, ${input.phoneOrdersEnabled}, ${input.phoneOrdersLabel},
      ${input.freeShippingThresholdCents}, ${input.defaultVatRate},
      ${input.legalCompanyName}, ${input.vatNumber}, ${input.gemiNumber},
      ${input.loyaltyRewardExpiryDays},
      ${input.stockInquiryMessage}, ${input.whatsappPhone}, now())
    ON CONFLICT (id) DO UPDATE SET
      store_name = EXCLUDED.store_name, logo_path = EXCLUDED.logo_path,
      favicon_path = EXCLUDED.favicon_path, og_image_path = EXCLUDED.og_image_path,
      default_seo_title = EXCLUDED.default_seo_title,
      default_seo_description = EXCLUDED.default_seo_description,
      footer_tagline = EXCLUDED.footer_tagline, contact_phone = EXCLUDED.contact_phone,
      contact_email = EXCLUDED.contact_email, contact_address = EXCLUDED.contact_address,
      business_hours = EXCLUDED.business_hours, facebook_url = EXCLUDED.facebook_url,
      instagram_url = EXCLUDED.instagram_url, tiktok_url = EXCLUDED.tiktok_url,
      announcement_text = EXCLUDED.announcement_text, cart_message = EXCLUDED.cart_message,
      phone_orders_enabled = EXCLUDED.phone_orders_enabled,
      phone_orders_label = EXCLUDED.phone_orders_label,
      free_shipping_threshold_cents = EXCLUDED.free_shipping_threshold_cents,
      default_vat_rate = EXCLUDED.default_vat_rate,
      legal_company_name = EXCLUDED.legal_company_name, vat_number = EXCLUDED.vat_number,
      gemi_number = EXCLUDED.gemi_number,
      loyalty_reward_expiry_days = EXCLUDED.loyalty_reward_expiry_days,
      stock_inquiry_message = EXCLUDED.stock_inquiry_message,
      whatsapp_phone = EXCLUDED.whatsapp_phone, updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Email settings — deliberately its own read/write pair, not folded into
// AdminSiteSettings/saveSiteSettings above. That upsert writes every column
// on the singleton from one form's fields; a second form pointed at it that
// didn't also carry all ~25 other fields would blank them the moment
// anyone saved just the email settings. A narrow, separately-scoped
// UPDATE/read here can't do that by construction.
// ---------------------------------------------------------------------------

export type EmailSettings = {
  ownerNotificationEmail: string | null;
  newsletterNotificationEmail: string | null;
  newsletterFromEmail: string | null;
  newsletterSubject: string | null;
  newsletterHeading: string | null;
  newsletterBody: string | null;
  newsletterButtonText: string | null;
  newsletterButtonUrl: string | null;
  newsletterFooter: string | null;
};

export async function getEmailSettings(): Promise<EmailSettings> {
  const rows = await sql<
    {
      owner_notification_email: string | null; newsletter_notification_email: string | null;
      newsletter_from_email: string | null; newsletter_subject: string | null;
      newsletter_heading: string | null; newsletter_body: string | null;
      newsletter_button_text: string | null; newsletter_button_url: string | null;
      newsletter_footer: string | null;
    }[]
  >`SELECT owner_notification_email, newsletter_notification_email, newsletter_from_email,
           newsletter_subject, newsletter_heading, newsletter_body,
           newsletter_button_text, newsletter_button_url, newsletter_footer
      FROM shop.site_setting LIMIT 1`;
  const s = rows[0];
  return {
    ownerNotificationEmail: s?.owner_notification_email ?? null,
    newsletterNotificationEmail: s?.newsletter_notification_email ?? null,
    newsletterFromEmail: s?.newsletter_from_email ?? null,
    newsletterSubject: s?.newsletter_subject ?? null,
    newsletterHeading: s?.newsletter_heading ?? null,
    newsletterBody: s?.newsletter_body ?? null,
    newsletterButtonText: s?.newsletter_button_text ?? null,
    newsletterButtonUrl: s?.newsletter_button_url ?? null,
    newsletterFooter: s?.newsletter_footer ?? null,
  };
}

/**
 * A narrow UPDATE, not saveSiteSettings' upsert-every-column — this is its
 * own admin screen so an owner editing email copy isn't also holding every
 * storefront-content field hostage in the same submission (and vice versa:
 * saving the Header & Footer form must not blank these).
 */
export async function saveEmailSettings(input: EmailSettings): Promise<void> {
  // Upsert, not a bare UPDATE: no migration seeds the site_setting singleton
  // row, so on a database where the Header & Footer form has never been
  // saved yet, an UPDATE alone would silently affect zero rows.
  await sql`
    INSERT INTO shop.site_setting (
      id, owner_notification_email, newsletter_notification_email, newsletter_from_email,
      newsletter_subject, newsletter_heading, newsletter_body,
      newsletter_button_text, newsletter_button_url, newsletter_footer, updated_at)
    VALUES (
      true, ${input.ownerNotificationEmail}, ${input.newsletterNotificationEmail}, ${input.newsletterFromEmail},
      ${input.newsletterSubject}, ${input.newsletterHeading}, ${input.newsletterBody},
      ${input.newsletterButtonText}, ${input.newsletterButtonUrl}, ${input.newsletterFooter}, now())
    ON CONFLICT (id) DO UPDATE SET
      owner_notification_email = EXCLUDED.owner_notification_email,
      newsletter_notification_email = EXCLUDED.newsletter_notification_email,
      newsletter_from_email = EXCLUDED.newsletter_from_email,
      newsletter_subject = EXCLUDED.newsletter_subject,
      newsletter_heading = EXCLUDED.newsletter_heading,
      newsletter_body = EXCLUDED.newsletter_body,
      newsletter_button_text = EXCLUDED.newsletter_button_text,
      newsletter_button_url = EXCLUDED.newsletter_button_url,
      newsletter_footer = EXCLUDED.newsletter_footer,
      updated_at = now()`;
}

// ---------------------------------------------------------------------------
// PDP content defaults — same deliberately-separate narrow read/write pair
// as EmailSettings above, for the same reason: a form here must not carry
// (and risk blanking) the ~25 other Header & Footer fields.
// ---------------------------------------------------------------------------

export type PdpContentDefaults = {
  pdpDeliveryText: string | null;
  pdpReturnsText: string | null;
  pdpPaymentText: string | null;
};

export async function getPdpContentDefaults(): Promise<PdpContentDefaults> {
  const rows = await sql<
    { pdp_delivery_text: string | null; pdp_returns_text: string | null; pdp_payment_text: string | null }[]
  >`SELECT pdp_delivery_text, pdp_returns_text, pdp_payment_text FROM shop.site_setting LIMIT 1`;
  const s = rows[0];
  return {
    pdpDeliveryText: s?.pdp_delivery_text ?? null,
    pdpReturnsText: s?.pdp_returns_text ?? null,
    pdpPaymentText: s?.pdp_payment_text ?? null,
  };
}

export async function savePdpContentDefaults(input: PdpContentDefaults): Promise<void> {
  await sql`
    INSERT INTO shop.site_setting (id, pdp_delivery_text, pdp_returns_text, pdp_payment_text, updated_at)
    VALUES (true, ${input.pdpDeliveryText}, ${input.pdpReturnsText}, ${input.pdpPaymentText}, now())
    ON CONFLICT (id) DO UPDATE SET
      pdp_delivery_text = EXCLUDED.pdp_delivery_text,
      pdp_returns_text = EXCLUDED.pdp_returns_text,
      pdp_payment_text = EXCLUDED.pdp_payment_text,
      updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Promo banner
// ---------------------------------------------------------------------------

export type AdminPromoBanner = {
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string | null;
  isPublished: boolean;
};

export async function getAdminPromoBanner(): Promise<AdminPromoBanner> {
  const rows = await sql<
    {
      headline: string | null; body: string | null; cta_label: string | null;
      cta_href: string | null; ends_at: Date | null; is_published: boolean;
    }[]
  >`SELECT headline, body, cta_label, cta_href, ends_at, is_published
      FROM shop.promo_banner LIMIT 1`;
  const b = rows[0];
  if (!b) return { headline: null, body: null, ctaLabel: null, ctaHref: null, endsAt: null, isPublished: false };
  return {
    headline: b.headline, body: b.body, ctaLabel: b.cta_label, ctaHref: b.cta_href,
    endsAt: b.ends_at ? new Date(b.ends_at).toISOString() : null,
    isPublished: b.is_published,
  };
}

export async function savePromoBanner(input: AdminPromoBanner): Promise<void> {
  await sql`
    INSERT INTO shop.promo_banner (id, headline, body, cta_label, cta_href, ends_at, is_published, updated_at)
    VALUES (true, ${input.headline}, ${input.body}, ${input.ctaLabel}, ${input.ctaHref},
            ${input.endsAt}, ${input.isPublished}, now())
    ON CONFLICT (id) DO UPDATE SET
      headline = EXCLUDED.headline, body = EXCLUDED.body, cta_label = EXCLUDED.cta_label,
      cta_href = EXCLUDED.cta_href, ends_at = EXCLUDED.ends_at,
      is_published = EXCLUDED.is_published, updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Content pages
// ---------------------------------------------------------------------------

export type AdminContentPage = {
  slug: string;
  label: string;
  title: string;
  body: string | null;
  isPublished: boolean;
  exists: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  imagePath: string | null;
  imageAlt: string | null;
};

/**
 * Returns one entry per known slug, whether or not a row exists yet — so the
 * editor always shows the full set of pages the storefront can render, and an
 * unwritten page reads as "empty" rather than being missing from the list.
 * LEFT JOINs shop.seo_meta the same way products/categories do (resource_type
 * = 'page', resource_id = the page's own uuid) rather than adding seo_title/
 * meta_description columns to content_page — one SEO storage shape, not two.
 */
export async function listContentPages(): Promise<AdminContentPage[]> {
  const rows = await sql<
    {
      slug: string; title: string; body: string | null; is_published: boolean;
      image_path: string | null; image_alt: string | null;
      seo_title: string | null; meta_description: string | null;
    }[]
  >`
    SELECT p.slug, p.title, p.body, p.is_published, p.image_path, p.image_alt,
           s.seo_title, s.meta_description
      FROM shop.content_page p
      LEFT JOIN shop.seo_meta s ON s.resource_type = 'page' AND s.resource_id = p.id::text`;
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return CONTENT_PAGE_SLUGS.map(({ slug, label }) => {
    const row = bySlug.get(slug);
    return {
      slug,
      label,
      // `||` not `??`: rows imported from Medusa carry EMPTY STRINGS rather
      // than nulls for every unfilled field, and `??` would happily accept
      // "" as a title — leaving the editor blank and the storefront heading
      // showing the raw slug. The same trap has appeared in site settings and
      // homepage SEO; empty string is this data's real "unset".
      title: row?.title || label,
      body: row?.body || null,
      isPublished: row?.is_published ?? false,
      exists: Boolean(row),
      seoTitle: row?.seo_title || null,
      metaDescription: row?.meta_description || null,
      imagePath: row?.image_path || null,
      imageAlt: row?.image_alt || null,
    };
  });
}

export async function saveContentPage(input: {
  slug: string;
  title: string;
  body: string | null;
  isPublished: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  imagePath: string | null;
  imageAlt: string | null;
}): Promise<void> {
  // Guards against a crafted request writing a slug with no storefront route.
  if (!CONTENT_PAGE_SLUGS.some((p) => p.slug === input.slug)) {
    throw new Error(`Unknown content page slug: ${input.slug}`);
  }
  await transaction(async (tx) => {
    const [page] = await tx<{ id: string }[]>`
      INSERT INTO shop.content_page (slug, title, body, is_published, image_path, image_alt)
      VALUES (${input.slug}, ${input.title}, ${input.body}, ${input.isPublished}, ${input.imagePath}, ${input.imageAlt})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title, body = EXCLUDED.body,
        is_published = EXCLUDED.is_published,
        image_path = EXCLUDED.image_path, image_alt = EXCLUDED.image_alt, updated_at = now()
      RETURNING id`;

    // Same "empty override deletes the row" rule as product/category SEO
    // (products.ts updateProduct): a page with no SEO fields set should fall
    // through to its own title/derived description, not leave a blank
    // override shadowing them forever.
    if (input.seoTitle || input.metaDescription) {
      await tx`
        INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description)
        VALUES ('page', ${page.id}, ${input.seoTitle}, ${input.metaDescription})
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET
          seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
          updated_at = now()`;
    } else {
      await tx`DELETE FROM shop.seo_meta WHERE resource_type = 'page' AND resource_id = ${page.id}`;
    }
  });
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export type AdminSeoRow = {
  resourceType: "product" | "category" | "collection" | "page" | "homepage";
  resourceId: string;
  label: string;
  // Category rows only — the same parent/depth/slug/description shop.category
  // already has, so the SEO list can render the real tree (instead of a flat
  // list) and the AI generator can use real facts (instead of fabricating).
  parentId: string | null;
  depth: number;
  slug: string;
  description: string | null;
  isActive: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robots: "index" | "noindex";
};

export type HomepageSeo = {
  seoTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  socialImagePath: string | null;
  keywords: string | null;
  robots: "index" | "noindex";
};

export async function getHomepageSeo(): Promise<HomepageSeo> {
  const rows = await sql<
    {
      seo_title: string | null; meta_description: string | null; og_title: string | null;
      og_description: string | null; social_image_path: string | null;
      keywords: string | null; robots: "index" | "noindex";
    }[]
  >`SELECT seo_title, meta_description, og_title, og_description, social_image_path,
           keywords, robots
      FROM shop.seo_meta WHERE resource_type = 'homepage' AND resource_id = 'homepage'`;
  const s = rows[0];
  if (!s) {
    return {
      seoTitle: null, metaDescription: null, ogTitle: null, ogDescription: null,
      socialImagePath: null, keywords: null, robots: "index",
    };
  }
  return {
    seoTitle: s.seo_title, metaDescription: s.meta_description, ogTitle: s.og_title,
    ogDescription: s.og_description, socialImagePath: s.social_image_path,
    keywords: s.keywords, robots: s.robots,
  };
}

export async function saveHomepageSeo(input: HomepageSeo): Promise<void> {
  await sql`
    INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description,
                               og_title, og_description, social_image_path, keywords, robots)
    VALUES ('homepage', 'homepage', ${input.seoTitle}, ${input.metaDescription},
            ${input.ogTitle}, ${input.ogDescription}, ${input.socialImagePath},
            ${input.keywords}, ${input.robots})
    ON CONFLICT (resource_type, resource_id) DO UPDATE SET
      seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
      og_title = EXCLUDED.og_title, og_description = EXCLUDED.og_description,
      social_image_path = EXCLUDED.social_image_path, keywords = EXCLUDED.keywords,
      robots = EXCLUDED.robots, updated_at = now()`;
}

/**
 * Every category at every depth, with its SEO override if one exists.
 * Categories are listed whether or not they have overrides, because "which
 * pages have I customised" is the question this screen answers — and a
 * category must not disappear from here just because no one has touched its
 * SEO yet.
 *
 * Deliberately built on `listCategoryTree()` (the same recursive-CTE tree
 * `CategoryManager` renders) rather than a second, separately-ordered query —
 * one tree, one source of order/depth, so this list can never drift from the
 * real category structure. `seo_meta` is looked up by category id (never
 * name), so a rename never orphans the association.
 */
export async function listCategorySeo(): Promise<AdminSeoRow[]> {
  const [tree, seoRows] = await Promise.all([
    listCategoryTree(),
    sql<
      {
        resource_id: string; seo_title: string | null; meta_description: string | null;
        keywords: string | null; og_title: string | null; og_description: string | null;
        robots: "index" | "noindex" | null;
      }[]
    >`SELECT resource_id, seo_title, meta_description, keywords, og_title, og_description, robots
        FROM shop.seo_meta WHERE resource_type = 'category'`,
  ]);
  const seoById = new Map(seoRows.map((r) => [r.resource_id, r]));

  return tree.map((c) => {
    const seo = seoById.get(c.id);
    return {
      resourceType: "category" as const,
      resourceId: c.id,
      label: c.name,
      parentId: c.parentId,
      depth: c.depth,
      slug: c.slug,
      description: c.description,
      isActive: c.isActive,
      seoTitle: seo?.seo_title ?? null,
      metaDescription: seo?.meta_description ?? null,
      keywords: seo?.keywords ?? null,
      ogTitle: seo?.og_title ?? null,
      ogDescription: seo?.og_description ?? null,
      robots: seo?.robots ?? "index",
    };
  });
}

/**
 * One category's current SEO override, if any — for callers (the AI SEO-GEO
 * save action, and the manual editor's own preserve-what-isn't-being-changed
 * logic) that need a merge base without the whole tree. Deliberately not
 * `listCategorySeo()` filtered down: that rebuilds all 157 categories via
 * `listCategoryTree()`'s recursive CTE (with a per-row product/child count
 * subquery) just to read one row — real, avoidable load on a save path, and
 * a real reliability risk (a single unrelated failure there was silently
 * dropping the whole save before this existed — see
 * ai-category-seo-actions.ts).
 */
export async function getCategorySeoState(categoryId: string): Promise<{
  seoTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robots: "index" | "noindex";
} | null> {
  const rows = await sql<
    {
      seo_title: string | null; meta_description: string | null; keywords: string | null;
      og_title: string | null; og_description: string | null; robots: "index" | "noindex" | null;
    }[]
  >`SELECT s.seo_title, s.meta_description, s.keywords, s.og_title, s.og_description, s.robots
      FROM shop.category c
      LEFT JOIN shop.seo_meta s ON s.resource_type = 'category' AND s.resource_id = c.id::text
     WHERE c.id = ${categoryId}`;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    seoTitle: r.seo_title,
    metaDescription: r.meta_description,
    keywords: r.keywords,
    ogTitle: r.og_title,
    ogDescription: r.og_description,
    robots: r.robots ?? "index",
  };
}

export async function saveCategorySeo(
  categoryId: string,
  input: {
    seoTitle: string | null;
    metaDescription: string | null;
    keywords: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    robots: "index" | "noindex";
  }
): Promise<void> {
  const hasContent =
    input.seoTitle || input.metaDescription || input.keywords || input.ogTitle || input.ogDescription ||
    input.robots === "noindex";
  if (!hasContent) {
    // An override with every field cleared would shadow the page's own
    // metadata with nothing. Removing the row restores the default.
    await sql`DELETE FROM shop.seo_meta WHERE resource_type = 'category' AND resource_id = ${categoryId}`;
    return;
  }
  await sql`
    INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description, keywords, og_title, og_description, robots)
    VALUES ('category', ${categoryId}, ${input.seoTitle}, ${input.metaDescription}, ${input.keywords}, ${input.ogTitle}, ${input.ogDescription}, ${input.robots})
    ON CONFLICT (resource_type, resource_id) DO UPDATE SET
      seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
      keywords = EXCLUDED.keywords, og_title = EXCLUDED.og_title, og_description = EXCLUDED.og_description,
      robots = EXCLUDED.robots, updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type AdminMediaAsset = {
  id: string;
  storagePath: string;
  label: string | null;
  altText: string | null;
  bytes: number | null;
  createdAt: string;
};

export async function listMediaAssets(): Promise<AdminMediaAsset[]> {
  const rows = await sql<
    { id: string; storage_path: string; label: string | null; alt_text: string | null; bytes: number | null; created_at: Date }[]
  >`SELECT id, storage_path, label, alt_text, bytes, created_at
      FROM shop.media_asset ORDER BY created_at DESC`;
  return rows.map((r) => ({
    id: r.id, storagePath: r.storage_path, label: r.label, altText: r.alt_text,
    bytes: r.bytes, createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** True when Supabase Storage is configured well enough for uploads to work. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Records an uploaded file in the media library. ON CONFLICT covers a
 * re-upload racing a previous row for the same path — storage_path is
 * generated as a random UUID (lib/storage/upload.ts), so this is a defensive
 * backstop rather than an expected case.
 */
export async function createMediaAsset(input: {
  storagePath: string;
  label: string | null;
  bytes: number | null;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.media_asset (storage_path, label, bytes)
    VALUES (${input.storagePath}, ${input.label}, ${input.bytes})
    ON CONFLICT (storage_path) DO UPDATE SET label = EXCLUDED.label, bytes = EXCLUDED.bytes
    RETURNING id`;
  return row.id;
}
