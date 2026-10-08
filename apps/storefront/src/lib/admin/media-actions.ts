"use server";

import { requireAdmin, auditLog } from "@/lib/admin/auth";
import { createMediaAsset } from "@/lib/admin/cms";
import { uploadOptimizedImage, UploadError, type UploadedImage } from "@/lib/storage/upload";
import { isImageSlotId } from "@/lib/images/slots";
import type { ActionResult } from "@/lib/admin/catalog-actions";

/**
 * Generic single-image upload for a form field that holds one path/URL
 * (category image, homepage block image, page and journal images) — runs the
 * file through the image pipeline for its slot (lib/images/slots.ts: size,
 * formats, budget) and hands the main file's bucket-relative path back to
 * the caller, which fills its own text field with it. Saving that field is
 * still the surrounding form's own submit, exactly as if the admin had
 * pasted a URL.
 *
 * The slot is validated rather than trusted: it decides the storage folder,
 * so a direct call to this action can't write to an arbitrary path prefix.
 * Product photos are different (a list, not one field) — see
 * addProductImageAction in catalog-actions.ts.
 */
export async function uploadMediaAction(
  formData: FormData
): Promise<ActionResult & { path?: string; result?: Omit<UploadedImage, "path"> }> {
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
  const slot = String(formData.get("slot") ?? "");
  if (!isImageSlotId(slot) || slot === "product") {
    return { ok: false, error: "Άγνωστο πεδίο εικόνας." };
  }
  // What the file is named after (alt text / heading / title from the same
  // form, else the original file name) — see ImageUploadField.
  const label = String(formData.get("label") ?? "").trim() || file.name;

  try {
    const { path, ...result } = await uploadOptimizedImage(file, slot, label);
    await createMediaAsset({ storagePath: path, label: file.name, bytes: result.bytes });
    await auditLog(admin.id, "media.upload", "media_asset", path);
    return { ok: true, path, result };
  } catch (err) {
    // UploadError is a known, already-actionable rejection (wrong type, too
    // large, storage not configured) whose message goes straight to the
    // admin — nothing silent to log there. The generic fallback below is the
    // actual gap this closes: an unexpected failure (network, Supabase
    // outage) previously returned a generic error with zero server-side
    // trace of what happened or to which upload.
    if (err instanceof UploadError) return { ok: false, error: err.message };
    console.error("[admin] IMAGE_UPLOAD_FAILED", { slot, fileName: file.name, error: String(err) });
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
}
