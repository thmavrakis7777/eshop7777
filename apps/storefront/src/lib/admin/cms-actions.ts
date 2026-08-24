"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireOwner, auditLog } from "@/lib/admin/auth";
import { isValidEmail } from "@/lib/checkout-validation";
import { CACHE_TAGS } from "@/lib/db/content";
import {
  deleteHomepageBlock,
  duplicateHomepageBlock,
  moveHomepageBlock,
  saveCategorySeo,
  saveContentPage,
  saveHomepageBlock,
  saveHomepageSeo,
  savePromoBanner,
  getEmailSettings,
  saveEmailSettings,
  saveSiteSettings,
  setHomepageBlockPublished,
} from "@/lib/admin/cms";
import type { EmailSettings } from "@/lib/admin/cms";
import type {
  HomepageSectionConfig,
  HomepageSectionKind,
  TrustIconName,
  TrustItem,
} from "@/lib/content-types";
import type { ActionResult } from "@/lib/admin/catalog-actions";

/**
 * CMS writes.
 *
 * Every one of these invalidates BOTH the admin route and the storefront
 * cache tag the corresponding read declared (lib/db/content.ts). Without the
 * tag, an edit would sit invisible behind a 30-60 second revalidate window
 * and read as "the save didn't work" — the single most confusing thing a CMS
 * can do to the person using it.
 */

const text = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

const toCents = (v: FormDataEntryValue | null): number | null => {
  const raw = String(v ?? "").replace(/\s/g, "").replace(",", ".").trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

async function guard(): Promise<{ id: string } | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

// Site settings carry the VAT rate and the free-shipping threshold —
// revenue-affecting, store-wide values, unlike the rest of this file's
// content/marketing writes. Owner-only, same tier as the admin-account
// actions in settings-actions.ts. Distinguishes "not signed in" from "signed
// in but not an owner" so a staff admin sees the real reason, not a
// misleading "session expired".
async function ownerGuard(): Promise<{ admin: { id: string } | null; insufficientRole: boolean }> {
  try {
    return { admin: await requireOwner(), insufficientRole: false };
  } catch (err) {
    if (err instanceof Error && err.message === "Insufficient permissions") {
      return { admin: null, insufficientRole: true };
    }
    return { admin: null, insufficientRole: false };
  }
}

const EXPIRED: ActionResult = { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };

// ---------------------------------------------------------------------------
// Homepage blocks
// ---------------------------------------------------------------------------

const SECTION_KINDS: HomepageSectionKind[] = [
  "hero",
  "promo",
  "category_grid",
  "product_rail",
  "content",
  "trust",
  "newsletter",
];

// Mirrors TrustIconName. Duplicated as a runtime value because a TS union
// cannot be checked at runtime, and form input must be validated against the
// real set rather than trusted.
const TRUST_ICONS = [
  "truck",
  "returns",
  "payment",
  "support",
  "shield",
  "phone",
  "gift",
  "leaf",
] as const;

// A guarantee strip longer than this stops being a strip. Also bounds the
// parse loop against a crafted form post.
const MAX_TRUST_ITEMS = 8;

const RAIL_SOURCE_TYPES = [
  "newest",
  "featured",
  "sale",
  "category",
  "collection",
  "manual",
] as const;

/**
 * Validates the per-kind `config` before it reaches the jsonb column.
 *
 * This is where the JSONB-over-columns trade-off gets paid: the database
 * only knows `config` is valid JSON, so a malformed source here would
 * surface as a broken homepage section rather than a constraint violation.
 * Everything is parsed from known keys and clamped — nothing from the form
 * is passed through verbatim.
 */
function parseConfig(kind: HomepageSectionKind, formData: FormData): HomepageSectionConfig {
  const config: HomepageSectionConfig = {};

  // Applies to every kind that can render a button.
  if (kind === "hero" || kind === "promo" || kind === "content") {
    config.showButton = formData.get("showButton") === "on";
  }

  if (kind === "category_grid") {
    // Comma- or newline-separated slugs, in the owner's chosen order.
    const raw = String(formData.get("categorySlugs") ?? "");
    config.categorySlugs = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (kind === "trust") {
    // Rows arrive as parallel indexed fields (item-0-title, item-0-icon, ...).
    // Anything without a title is dropped rather than saved as a blank tile.
    const items: TrustItem[] = [];
    for (let i = 0; i < MAX_TRUST_ITEMS; i++) {
      const title = String(formData.get(`item-${i}-title`) ?? "").trim();
      if (!title) continue;
      const rawIcon = String(formData.get(`item-${i}-icon`) ?? "truck");
      items.push({
        icon: (TRUST_ICONS as readonly string[]).includes(rawIcon)
          ? (rawIcon as TrustIconName)
          : "truck",
        title,
        description: String(formData.get(`item-${i}-description`) ?? "").trim(),
        visible: formData.get(`item-${i}-visible`) === "on",
      });
    }
    config.items = items;
  }

  if (kind === "product_rail") {
    const rawType = String(formData.get("sourceType") ?? "newest");
    const type = (RAIL_SOURCE_TYPES as readonly string[]).includes(rawType)
      ? (rawType as (typeof RAIL_SOURCE_TYPES)[number])
      : "newest";
    const limit = Math.min(Math.max(1, Number(formData.get("limit") ?? 12) || 12), 24);

    switch (type) {
      case "category":
        config.source = { type, categorySlug: String(formData.get("categorySlug") ?? "").trim(), limit };
        break;
      case "collection":
        config.source = {
          type,
          collectionSlug: String(formData.get("collectionSlug") ?? "").trim(),
          limit,
        };
        break;
      case "manual":
        config.source = {
          type,
          productSlugs: String(formData.get("productSlugs") ?? "")
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 24),
        };
        break;
      default:
        config.source = { type, limit };
    }
    config.viewAllHref = text(formData.get("viewAllHref"));
  }

  return config;
}

export async function saveHomepageBlockAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const rawKind = String(formData.get("kind") ?? "hero") as HomepageSectionKind;
  const kind = SECTION_KINDS.includes(rawKind) ? rawKind : "hero";
  const id = text(formData.get("id")) ?? undefined;

  try {
    const savedId = await saveHomepageBlock({
      id,
      kind,
      eyebrow: text(formData.get("eyebrow")),
      heading: text(formData.get("heading")),
      body: text(formData.get("body")),
      ctaLabel: text(formData.get("ctaLabel")),
      ctaHref: text(formData.get("ctaHref")),
      imagePath: text(formData.get("imagePath")),
      mobileImagePath: text(formData.get("mobileImagePath")),
      imageAlt: text(formData.get("imageAlt")),
      config: parseConfig(kind, formData),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      isPublished: formData.get("isPublished") === "on",
    });
    await auditLog(admin.id, id ? "homepage_block.update" : "homepage_block.create", "homepage_block", savedId);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  revalidateHomepage();
  return { ok: true, message: id ? "Η ενότητα ενημερώθηκε." : "Η ενότητα δημιουργήθηκε." };
}

export async function deleteHomepageBlockAction(id: string): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await deleteHomepageBlock(id);
    await auditLog(admin.id, "homepage_block.delete", "homepage_block", id);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateHomepage();
  return { ok: true, message: "Η ενότητα διαγράφηκε." };
}

export async function setHomepageBlockPublishedAction(
  id: string,
  isPublished: boolean
): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await setHomepageBlockPublished(id, isPublished);
    await auditLog(admin.id, `homepage_block.${isPublished ? "show" : "hide"}`, "homepage_block", id);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateHomepage();
  return { ok: true, message: isPublished ? "Η ενότητα εμφανίζεται." : "Η ενότητα κρύφτηκε." };
}

export async function moveHomepageBlockAction(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await moveHomepageBlock(id, direction);
    await auditLog(admin.id, "homepage_block.move", "homepage_block", id, { direction });
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateHomepage();
  return { ok: true };
}

export async function duplicateHomepageBlockAction(id: string): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    const newId = await duplicateHomepageBlock(id);
    if (!newId) return { ok: false, error: "Δεν βρέθηκε η ενότητα." };
    await auditLog(admin.id, "homepage_block.duplicate", "homepage_block", newId);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateHomepage();
  // Created hidden on purpose: a duplicate is a starting point to edit, not
  // something that should appear on the live homepage the instant it's made.
  return { ok: true, message: "Η ενότητα αντιγράφηκε (κρυφή)." };
}

function revalidateHomepage() {
  updateTag(CACHE_TAGS.homepageBlocks);
  revalidatePath("/admin/content/homepage");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Site settings + promo banner
// ---------------------------------------------------------------------------

export async function saveSiteSettingsAction(formData: FormData): Promise<ActionResult> {
  const { admin, insufficientRole } = await ownerGuard();
  if (insufficientRole) return { ok: false, error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  if (!admin) return EXPIRED;

  const vatRaw = String(formData.get("defaultVatRate") ?? "24").replace(",", ".");
  const vat = Number.parseFloat(vatRaw);
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    return { ok: false, error: "Ο συντελεστής ΦΠΑ πρέπει να είναι μεταξύ 0 και 100." };
  }

  try {
    await saveSiteSettings({
      storeName: text(formData.get("storeName")),
      logoPath: text(formData.get("logoPath")),
      faviconPath: text(formData.get("faviconPath")),
      ogImagePath: text(formData.get("ogImagePath")),
      defaultSeoTitle: text(formData.get("defaultSeoTitle")),
      defaultSeoDescription: text(formData.get("defaultSeoDescription")),
      footerTagline: text(formData.get("footerTagline")),
      contactPhone: text(formData.get("contactPhone")),
      contactEmail: text(formData.get("contactEmail")),
      contactAddress: text(formData.get("contactAddress")),
      businessHours: text(formData.get("businessHours")),
      facebookUrl: text(formData.get("facebookUrl")),
      instagramUrl: text(formData.get("instagramUrl")),
      tiktokUrl: text(formData.get("tiktokUrl")),
      announcementText: text(formData.get("announcementText")),
      cartMessage: text(formData.get("cartMessage")),
      phoneOrdersEnabled: formData.get("phoneOrdersEnabled") === "on",
      phoneOrdersLabel: text(formData.get("phoneOrdersLabel")),
      freeShippingThresholdCents: toCents(formData.get("freeShippingThreshold")),
      defaultVatRate: vat,
      legalCompanyName: text(formData.get("legalCompanyName")),
      vatNumber: text(formData.get("vatNumber")),
      gemiNumber: text(formData.get("gemiNumber")),
    });
    await auditLog(admin.id, "site_settings.update", "site_setting", "singleton");
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.siteSettings);
  revalidatePath("/admin/content/layout");
  // Header, footer and announcement bar render on every page.
  revalidatePath("/", "layout");
  return { ok: true, message: "Οι ρυθμίσεις αποθηκεύτηκαν." };
}

export async function saveEmailSettingsAction(formData: FormData): Promise<ActionResult> {
  const { admin, insufficientRole } = await ownerGuard();
  if (insufficientRole) return { ok: false, error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  if (!admin) return EXPIRED;

  for (const [field, label] of [
    ["ownerNotificationEmail", "Email ειδοποίησης νέων παραγγελιών"],
    ["newsletterNotificationEmail", "Email ειδοποίησης νέων εγγραφών newsletter"],
    ["newsletterFromEmail", "Email αποστολέα newsletter"],
  ] as const) {
    if (!formData.has(field)) continue;
    const v = text(formData.get(field));
    if (v && !isValidEmail(v)) return { ok: false, error: `${label}: μη έγκυρη διεύθυνση email.` };
  }

  const buttonUrl = formData.has("newsletterButtonUrl") ? text(formData.get("newsletterButtonUrl")) : undefined;
  if (buttonUrl && !/^https?:\/\//i.test(buttonUrl) && !buttonUrl.startsWith("/")) {
    return { ok: false, error: "Ο σύνδεσμος κουμπιού πρέπει να ξεκινά με / ή https://." };
  }

  try {
    // The Email settings screen is two separate forms in two cards
    // (notifications vs. confirmation-email copy). Each <form> only submits
    // its own fields, so a field this specific submission doesn't carry
    // must keep its current value, not get nulled out by the other card's
    // absence — hence reading current settings first and only overriding
    // what formData.has() actually.
    const current = await getEmailSettings();
    const field = (name: keyof EmailSettings) => (formData.has(name) ? text(formData.get(name)) : current[name]);

    await saveEmailSettings({
      ownerNotificationEmail: field("ownerNotificationEmail"),
      newsletterNotificationEmail: field("newsletterNotificationEmail"),
      newsletterFromEmail: field("newsletterFromEmail"),
      newsletterSubject: field("newsletterSubject"),
      newsletterHeading: field("newsletterHeading"),
      newsletterBody: field("newsletterBody"),
      newsletterButtonText: field("newsletterButtonText"),
      newsletterButtonUrl: field("newsletterButtonUrl"),
      newsletterFooter: field("newsletterFooter"),
    });
    await auditLog(admin.id, "email_settings.update", "site_setting", "singleton");
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.siteSettings);
  revalidatePath("/admin/settings/email");
  return { ok: true, message: "Οι ρυθμίσεις email αποθηκεύτηκαν." };
}

export async function savePromoBannerAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  try {
    await savePromoBanner({
      headline: text(formData.get("headline")),
      body: text(formData.get("body")),
      ctaLabel: text(formData.get("ctaLabel")),
      ctaHref: text(formData.get("ctaHref")),
      endsAt: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      isPublished: formData.get("isPublished") === "on",
    });
    await auditLog(admin.id, "promo_banner.update", "promo_banner", "singleton");
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.promoBanner);
  revalidatePath("/admin/content/layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Το banner αποθηκεύτηκε." };
}

// ---------------------------------------------------------------------------
// Content pages
// ---------------------------------------------------------------------------

export async function saveContentPageAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Ο τίτλος είναι υποχρεωτικός." };

  try {
    await saveContentPage({
      slug,
      title,
      body: text(formData.get("body")),
      isPublished: formData.get("isPublished") === "on",
      seoTitle: text(formData.get("seoTitle")),
      metaDescription: text(formData.get("metaDescription")),
      imagePath: text(formData.get("imagePath")),
      imageAlt: text(formData.get("imageAlt")),
    });
    await auditLog(admin.id, "content_page.update", "content_page", slug);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.contentPages);
  revalidatePath("/admin/content/pages");
  revalidatePath(`/${slug}`);
  return { ok: true, message: "Η σελίδα αποθηκεύτηκε." };
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export async function saveHomepageSeoAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await saveHomepageSeo({
      seoTitle: text(formData.get("seoTitle")),
      metaDescription: text(formData.get("metaDescription")),
      ogTitle: text(formData.get("ogTitle")),
      ogDescription: text(formData.get("ogDescription")),
      socialImagePath: text(formData.get("socialImagePath")),
      keywords: text(formData.get("keywords")),
      robots: formData.get("robots") === "noindex" ? "noindex" : "index",
    });
    await auditLog(admin.id, "seo.homepage.update", "seo_meta", "homepage");
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.seo);
  revalidatePath("/admin/content/seo");
  revalidatePath("/");
  return { ok: true, message: "Το SEO της αρχικής αποθηκεύτηκε." };
}

export async function saveCategorySeoAction(categoryId: string, formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await saveCategorySeo(categoryId, {
      seoTitle: text(formData.get("seoTitle")),
      metaDescription: text(formData.get("metaDescription")),
      robots: formData.get("robots") === "noindex" ? "noindex" : "index",
    });
    await auditLog(admin.id, "seo.category.update", "seo_meta", categoryId);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.seo);
  revalidatePath("/admin/content/seo");
  revalidatePath("/", "layout");
  return { ok: true, message: "Το SEO της κατηγορίας αποθηκεύτηκε." };
}
