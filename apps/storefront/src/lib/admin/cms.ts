import "server-only";
import { sql } from "@/lib/db/client";

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
  { slug: "epistrofes", label: "Επιστροφές & Αλλαγές" },
  { slug: "aporrito", label: "Πολιτική Απορρήτου" },
  { slug: "oroi-xrisis", label: "Όροι Χρήσης" },
  { slug: "cookies", label: "Πολιτική Cookies" },
  { slug: "faq", label: "Συχνές Ερωτήσεις" },
  { slug: "epikoinonia", label: "Επικοινωνία" },
  { slug: "paraggelia", label: "Παρακολούθηση Παραγγελίας" },
  { slug: "odigoi-agoron", label: "Οδηγοί Αγορών" },
  { slug: "karieres", label: "Καριέρα" },
];

// ---------------------------------------------------------------------------
// Homepage blocks
// ---------------------------------------------------------------------------

export type AdminHomepageBlock = {
  id: string;
  kind: "hero" | "promo";
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imagePath: string | null;
  sortOrder: number;
  isPublished: boolean;
};

export async function listHomepageBlocks(): Promise<AdminHomepageBlock[]> {
  const rows = await sql<
    {
      id: string; kind: "hero" | "promo"; eyebrow: string | null; heading: string | null;
      body: string | null; cta_label: string | null; cta_href: string | null;
      image_path: string | null; sort_order: number; is_published: boolean;
    }[]
  >`SELECT id, kind, eyebrow, heading, body, cta_label, cta_href, image_path,
           sort_order, is_published
      FROM shop.homepage_block ORDER BY kind, sort_order, created_at`;

  return rows.map((r) => ({
    id: r.id, kind: r.kind, eyebrow: r.eyebrow, heading: r.heading, body: r.body,
    ctaLabel: r.cta_label, ctaHref: r.cta_href, imagePath: r.image_path,
    sortOrder: r.sort_order, isPublished: r.is_published,
  }));
}

export async function saveHomepageBlock(input: {
  id?: string;
  kind: "hero" | "promo";
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imagePath: string | null;
  sortOrder: number;
  isPublished: boolean;
}): Promise<string> {
  if (input.id) {
    await sql`
      UPDATE shop.homepage_block SET
        kind = ${input.kind}, eyebrow = ${input.eyebrow}, heading = ${input.heading},
        body = ${input.body}, cta_label = ${input.ctaLabel}, cta_href = ${input.ctaHref},
        image_path = ${input.imagePath}, sort_order = ${input.sortOrder},
        is_published = ${input.isPublished}
      WHERE id = ${input.id}`;
    return input.id;
  }
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.homepage_block (kind, eyebrow, heading, body, cta_label, cta_href,
                                     image_path, sort_order, is_published)
    VALUES (${input.kind}, ${input.eyebrow}, ${input.heading}, ${input.body},
            ${input.ctaLabel}, ${input.ctaHref}, ${input.imagePath},
            ${input.sortOrder}, ${input.isPublished})
    RETURNING id`;
  return row.id;
}

export async function deleteHomepageBlock(id: string): Promise<void> {
  await sql`DELETE FROM shop.homepage_block WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Site settings (header, footer, contact, social)
// ---------------------------------------------------------------------------

export type AdminSiteSettings = {
  storeName: string | null;
  logoPath: string | null;
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
  freeShippingThresholdCents: number | null;
  defaultVatRate: number;
};

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const rows = await sql<
    {
      store_name: string | null; logo_path: string | null; footer_tagline: string | null;
      contact_phone: string | null; contact_email: string | null; contact_address: string | null;
      business_hours: string | null; facebook_url: string | null; instagram_url: string | null;
      tiktok_url: string | null; announcement_text: string | null; cart_message: string | null;
      free_shipping_threshold_cents: number | null; default_vat_rate: number;
    }[]
  >`SELECT store_name, logo_path, footer_tagline, contact_phone, contact_email,
           contact_address, business_hours, facebook_url, instagram_url, tiktok_url,
           announcement_text, cart_message, free_shipping_threshold_cents, default_vat_rate
      FROM shop.site_setting LIMIT 1`;

  const s = rows[0];
  // The singleton is created by the migration, but a fresh database (or a
  // deleted row) must not crash the settings screen.
  if (!s) {
    return {
      storeName: null, logoPath: null, footerTagline: null, contactPhone: null,
      contactEmail: null, contactAddress: null, businessHours: null, facebookUrl: null,
      instagramUrl: null, tiktokUrl: null, announcementText: null, cartMessage: null,
      freeShippingThresholdCents: null, defaultVatRate: 24,
    };
  }

  return {
    storeName: s.store_name, logoPath: s.logo_path, footerTagline: s.footer_tagline,
    contactPhone: s.contact_phone, contactEmail: s.contact_email,
    contactAddress: s.contact_address, businessHours: s.business_hours,
    facebookUrl: s.facebook_url, instagramUrl: s.instagram_url, tiktokUrl: s.tiktok_url,
    announcementText: s.announcement_text, cartMessage: s.cart_message,
    freeShippingThresholdCents: s.free_shipping_threshold_cents,
    defaultVatRate: Number(s.default_vat_rate),
  };
}

export async function saveSiteSettings(input: AdminSiteSettings): Promise<void> {
  await sql`
    INSERT INTO shop.site_setting (
      id, store_name, logo_path, footer_tagline, contact_phone, contact_email,
      contact_address, business_hours, facebook_url, instagram_url, tiktok_url,
      announcement_text, cart_message, free_shipping_threshold_cents, default_vat_rate, updated_at)
    VALUES (
      true, ${input.storeName}, ${input.logoPath}, ${input.footerTagline},
      ${input.contactPhone}, ${input.contactEmail}, ${input.contactAddress},
      ${input.businessHours}, ${input.facebookUrl}, ${input.instagramUrl},
      ${input.tiktokUrl}, ${input.announcementText}, ${input.cartMessage},
      ${input.freeShippingThresholdCents}, ${input.defaultVatRate}, now())
    ON CONFLICT (id) DO UPDATE SET
      store_name = EXCLUDED.store_name, logo_path = EXCLUDED.logo_path,
      footer_tagline = EXCLUDED.footer_tagline, contact_phone = EXCLUDED.contact_phone,
      contact_email = EXCLUDED.contact_email, contact_address = EXCLUDED.contact_address,
      business_hours = EXCLUDED.business_hours, facebook_url = EXCLUDED.facebook_url,
      instagram_url = EXCLUDED.instagram_url, tiktok_url = EXCLUDED.tiktok_url,
      announcement_text = EXCLUDED.announcement_text, cart_message = EXCLUDED.cart_message,
      free_shipping_threshold_cents = EXCLUDED.free_shipping_threshold_cents,
      default_vat_rate = EXCLUDED.default_vat_rate, updated_at = now()`;
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
};

/**
 * Returns one entry per known slug, whether or not a row exists yet — so the
 * editor always shows the full set of pages the storefront can render, and an
 * unwritten page reads as "empty" rather than being missing from the list.
 */
export async function listContentPages(): Promise<AdminContentPage[]> {
  const rows = await sql<{ slug: string; title: string; body: string | null; is_published: boolean }[]>`
    SELECT slug, title, body, is_published FROM shop.content_page`;
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
    };
  });
}

export async function saveContentPage(input: {
  slug: string;
  title: string;
  body: string | null;
  isPublished: boolean;
}): Promise<void> {
  // Guards against a crafted request writing a slug with no storefront route.
  if (!CONTENT_PAGE_SLUGS.some((p) => p.slug === input.slug)) {
    throw new Error(`Unknown content page slug: ${input.slug}`);
  }
  await sql`
    INSERT INTO shop.content_page (slug, title, body, is_published)
    VALUES (${input.slug}, ${input.title}, ${input.body}, ${input.isPublished})
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, body = EXCLUDED.body,
      is_published = EXCLUDED.is_published, updated_at = now()`;
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export type AdminSeoRow = {
  resourceType: "product" | "category" | "collection" | "page" | "homepage";
  resourceId: string;
  label: string;
  seoTitle: string | null;
  metaDescription: string | null;
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
 * Every category, with its SEO override if one exists. Categories are listed
 * whether or not they have overrides, because "which pages have I customised"
 * is the question this screen answers.
 */
export async function listCategorySeo(): Promise<AdminSeoRow[]> {
  const rows = await sql<
    {
      id: string; name: string; slug: string; seo_title: string | null;
      meta_description: string | null; robots: "index" | "noindex" | null;
    }[]
  >`SELECT c.id, c.name, c.slug, s.seo_title, s.meta_description, s.robots
      FROM shop.category c
      LEFT JOIN shop.seo_meta s
        ON s.resource_type = 'category' AND s.resource_id = c.id::text
     ORDER BY c.sort_order, c.name COLLATE "el-GR-x-icu"`;

  return rows.map((r) => ({
    resourceType: "category" as const,
    resourceId: r.id,
    label: r.name,
    seoTitle: r.seo_title,
    metaDescription: r.meta_description,
    robots: r.robots ?? "index",
  }));
}

export async function saveCategorySeo(
  categoryId: string,
  input: { seoTitle: string | null; metaDescription: string | null; robots: "index" | "noindex" }
): Promise<void> {
  const hasContent = input.seoTitle || input.metaDescription || input.robots === "noindex";
  if (!hasContent) {
    // An override with every field cleared would shadow the page's own
    // metadata with nothing. Removing the row restores the default.
    await sql`DELETE FROM shop.seo_meta WHERE resource_type = 'category' AND resource_id = ${categoryId}`;
    return;
  }
  await sql`
    INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description, robots)
    VALUES ('category', ${categoryId}, ${input.seoTitle}, ${input.metaDescription}, ${input.robots})
    ON CONFLICT (resource_type, resource_id) DO UPDATE SET
      seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
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
