"use server";

import { requireAdmin, auditLog } from "@/lib/admin/auth";
import { createMediaAsset } from "@/lib/admin/cms";
import { uploadImage, UploadError } from "@/lib/storage/upload";
import type { ActionResult } from "@/lib/admin/catalog-actions";

// Purely organisational (which folder inside the bucket) — not a security
// boundary, but validated anyway so a direct call to this action can't be
// used to write to an arbitrary path prefix.
const ALLOWED_FOLDERS = new Set(["categories", "homepage", "branding", "journal", "pages"]);

/**
 * Generic single-image upload for a form field that holds one path/URL
 * (category image, homepage block image, site branding) — uploads the file
 * and hands the resulting bucket-relative path back to the caller, which
 * fills its own text field with it. Saving that field is still the
 * surrounding form's own submit, exactly as if the admin had pasted a URL.
 *
 * Product images are different (a list, not one field) — see
 * addProductImageAction in catalog-actions.ts.
 */
export async function uploadMediaAction(formData: FormData): Promise<ActionResult & { path?: string }> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Δεν επιλέχθηκε αρχείο." };
  }
  const folderRaw = String(formData.get("folder") ?? "");
  const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : "uploads";

  try {
    const { path, bytes } = await uploadImage(file, folder);
    await createMediaAsset({ storagePath: path, label: file.name, bytes });
    await auditLog(admin.id, "media.upload", "media_asset", path);
    return { ok: true, path };
  } catch (err) {
    // UploadError is a known, already-actionable rejection (wrong type, too
    // large, storage not configured) whose message goes straight to the
    // admin — nothing silent to log there. The generic fallback below is the
    // actual gap this closes: an unexpected failure (network, Supabase
    // outage) previously returned a generic error with zero server-side
    // trace of what happened or to which upload.
    if (err instanceof UploadError) return { ok: false, error: err.message };
    console.error("[admin] IMAGE_UPLOAD_FAILED", { folder, fileName: file.name, error: String(err) });
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
}
