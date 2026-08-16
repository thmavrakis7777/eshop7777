"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireOwner, auditLog } from "@/lib/admin/auth";
import { CACHE_TAGS } from "@/lib/db/content";
import {
  deleteHomepageBlock,
  saveCategorySeo,
  saveContentPage,
  saveHomepageBlock,
  saveHomepageSeo,
  savePromoBanner,
  saveSiteSettings,
} from "@/lib/admin/cms";
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

export async function saveHomepageBlockAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const kind = formData.get("kind") === "promo" ? "promo" : "hero";
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
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      isPublished: formData.get("isPublished") === "on",
    });
    await auditLog(admin.id, id ? "homepage_block.update" : "homepage_block.create", "homepage_block", savedId);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  updateTag(CACHE_TAGS.homepageBlocks);
  revalidatePath("/admin/content/homepage");
  revalidatePath("/");
  return { ok: true, message: id ? "Το μπλοκ ενημερώθηκε." : "Το μπλοκ δημιουργήθηκε." };
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
  updateTag(CACHE_TAGS.homepageBlocks);
  revalidatePath("/admin/content/homepage");
  revalidatePath("/");
  return { ok: true, message: "Το μπλοκ διαγράφηκε." };
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
      freeShippingThresholdCents: toCents(formData.get("freeShippingThreshold")),
      defaultVatRate: vat,
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
