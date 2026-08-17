"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { auditLog, getCurrentAdminTokenHash, requireAdmin, requireOwner } from "@/lib/admin/auth";
import { CACHE_TAGS } from "@/lib/db/content";
import { SEARCH_CACHE_TAG } from "@/lib/db/catalog";
import {
  SettingsError,
  changeOwnPassword,
  createAdmin,
  deleteShippingMethod,
  deleteSynonym,
  saveAnalytics,
  saveShippingMethod,
  saveSynonym,
  setAdminActive,
  setAdminRole,
  updateOwnProfile,
} from "@/lib/admin/settings";
import type { ActionResult } from "@/lib/admin/catalog-actions";

function mapError(err: unknown): string {
  if (err instanceof SettingsError) {
    switch (err.code) {
      case "duplicate_email": return "Υπάρχει ήδη διαχειριστής με αυτό το email.";
      case "wrong_password": return "Ο τρέχων κωδικός δεν είναι σωστός.";
      case "last_owner": return "Δεν μπορείς να αφαιρέσεις τον τελευταίο ιδιοκτήτη — θα κλείδωνες το κατάστημα έξω από τη διαχείρισή του.";
      case "not_found": return "Δεν βρέθηκε.";
    }
  }
  if (err instanceof Error && err.message === "Insufficient permissions") {
    return "Δεν έχεις δικαίωμα για αυτή την ενέργεια.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

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

const EXPIRED: ActionResult = { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------

// Shipping prices are revenue-affecting, store-wide values — owner-only,
// same tier as the admin-account actions below.
export async function saveShippingMethodAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Το όνομα είναι υποχρεωτικό." };

  const id = text(formData.get("id")) ?? undefined;
  try {
    await saveShippingMethod({
      id,
      name,
      description: text(formData.get("description")),
      priceCents: toCents(formData.get("price")) ?? 0,
      freeOverCents: toCents(formData.get("freeOver")),
      isPickup: formData.get("isPickup") === "on",
      isActive: formData.get("isActive") === "on",
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    });
    await auditLog(admin.id, id ? "shipping.update" : "shipping.create", "shipping_method", id ?? name);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/settings/shipping");
  // Checkout reads these live, so the storefront must see the change.
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Η μέθοδος ενημερώθηκε." : "Η μέθοδος δημιουργήθηκε." };
}

export async function deleteShippingMethodAction(id: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  try {
    const outcome = await deleteShippingMethod(id);
    await auditLog(admin.id, `shipping.${outcome}`, "shipping_method", id);
    revalidatePath("/admin/settings/shipping");
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        outcome === "deleted"
          ? "Η μέθοδος διαγράφηκε."
          : "Η μέθοδος απενεργοποιήθηκε — χρησιμοποιείται σε ενεργά καλάθια.",
    };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

// These four values are interpolated directly into executing inline <script>
// tags (AnalyticsScripts.tsx) that carry the page's CSP nonce — an
// unvalidated value here is stored XSS on every storefront page for every
// consenting visitor. Every real tracking-service ID is plain alphanumeric
// plus hyphens, so reject anything else rather than trying to escape it
// later — AnalyticsScripts.tsx also JSON.stringifies at the interpolation
// site as a second layer, but this is the one that stops it from ever being
// saved. Owner-only (store-wide config, same tier as shipping/site
// settings), not just a defense against the XSS risk above.
const TRACKING_ID = /^[A-Za-z0-9-]{1,40}$/;

function validTrackingId(v: string | null): string | null {
  if (v === null) return null;
  return TRACKING_ID.test(v) ? v : "__invalid__";
}

export async function saveAnalyticsAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  const fields = {
    ga4MeasurementId: validTrackingId(text(formData.get("ga4MeasurementId"))),
    gtmContainerId: validTrackingId(text(formData.get("gtmContainerId"))),
    metaPixelId: validTrackingId(text(formData.get("metaPixelId"))),
    clarityProjectId: validTrackingId(text(formData.get("clarityProjectId"))),
  };
  if (Object.values(fields).includes("__invalid__")) {
    return {
      ok: false,
      error: "Μη έγκυρο αναγνωριστικό — επιτρέπονται μόνο γράμματα, αριθμοί και παύλες.",
    };
  }

  try {
    await saveAnalytics(fields);
    await auditLog(admin.id, "analytics.update", "analytics_setting", "singleton");
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  updateTag(CACHE_TAGS.analytics);
  revalidatePath("/admin/settings/analytics");
  revalidatePath("/", "layout");
  return { ok: true, message: "Οι ρυθμίσεις analytics αποθηκεύτηκαν." };
}

// ---------------------------------------------------------------------------
// Search synonyms
// ---------------------------------------------------------------------------

export async function saveSynonymAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return EXPIRED;
  }

  const terms = String(formData.get("terms") ?? "").trim();
  // A single term is not a synonym group — it would silently do nothing,
  // which is worse than refusing it.
  if (terms.split(",").map((t) => t.trim()).filter(Boolean).length < 2) {
    return { ok: false, error: "Χρειάζονται τουλάχιστον δύο όροι, χωρισμένοι με κόμμα." };
  }

  try {
    await saveSynonym(text(formData.get("id")) ?? undefined, terms);
    await auditLog(admin.id, "synonym.save", "search_synonym", terms);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/settings/search");
  revalidatePath("/", "layout");
  updateTag(SEARCH_CACHE_TAG);
  return { ok: true, message: "Η ομάδα συνωνύμων αποθηκεύτηκε." };
}

export async function deleteSynonymAction(id: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return EXPIRED;
  }
  try {
    await deleteSynonym(id);
    await auditLog(admin.id, "synonym.delete", "search_synonym", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/settings/search");
  revalidatePath("/", "layout");
  updateTag(SEARCH_CACHE_TAG);
  return { ok: true, message: "Η ομάδα διαγράφηκε." };
}

// ---------------------------------------------------------------------------
// Admin users — owner only
// ---------------------------------------------------------------------------

const newAdminSchema = z.object({
  email: z.string().trim().email("Μη έγκυρη διεύθυνση email."),
  name: z.string().trim().min(1, "Το όνομα είναι υποχρεωτικό."),
  // Stricter than the storefront's 8: this account can edit every price and
  // read every order.
  password: z.string().min(12, "Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες."),
  role: z.enum(["owner", "staff"]),
});

export async function createAdminAction(formData: FormData): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  const parsed = newAdminSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await createAdmin(parsed.data);
    await auditLog(owner.id, "admin.create", "admin_user", parsed.data.email, { role: parsed.data.role });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/settings/users");
  return { ok: true, message: "Ο διαχειριστής δημιουργήθηκε." };
}

export async function setAdminActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  try {
    await setAdminActive(id, isActive);
    await auditLog(owner.id, isActive ? "admin.activate" : "admin.deactivate", "admin_user", id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/settings/users");
  return { ok: true, message: isActive ? "Ο λογαριασμός ενεργοποιήθηκε." : "Ο λογαριασμός απενεργοποιήθηκε." };
}

export async function setAdminRoleAction(id: string, role: "owner" | "staff"): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  try {
    await setAdminRole(id, role);
    await auditLog(owner.id, "admin.role", "admin_user", id, { role });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/settings/users");
  return { ok: true, message: "Ο ρόλος ενημερώθηκε." };
}

// ---------------------------------------------------------------------------
// Own account
// ---------------------------------------------------------------------------

export async function changeOwnPasswordAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return EXPIRED;
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 12) return { ok: false, error: "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες." };
  if (next !== confirm) return { ok: false, error: "Οι δύο κωδικοί δεν ταιριάζουν." };
  if (next === current) return { ok: false, error: "Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα." };

  const tokenHash = await getCurrentAdminTokenHash();
  if (!tokenHash) return EXPIRED;

  try {
    await changeOwnPassword(admin.id, current, next, tokenHash);
    await auditLog(admin.id, "admin.password.change", "admin_user", admin.id);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return {
    ok: true,
    message: "Ο κωδικός άλλαξε. Όλες οι άλλες συνεδρίες σου τερματίστηκαν.",
  };
}

export async function updateOwnProfileAction(formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return EXPIRED;
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Το όνομα είναι υποχρεωτικό." };
  try {
    await updateOwnProfile(admin.id, name);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Το προφίλ ενημερώθηκε." };
}
