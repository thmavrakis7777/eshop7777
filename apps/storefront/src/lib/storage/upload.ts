import "server-only";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/storage/urls";

/**
 * Uploads a file straight to Supabase Storage's REST API. Deliberately not
 * @supabase/supabase-js — this app talks to Postgres directly rather than
 * through Supabase's client SDK (see lib/db/client.ts), and storage is no
 * different: one `fetch` is simpler than a dependency for a single POST.
 *
 * Callers must check isStorageConfigured() (lib/admin/cms.ts) before calling
 * this — it throws rather than degrading, since a Server Action calling it
 * only does so after the admin has actively picked a file to upload.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class UploadError extends Error {}

export async function uploadImage(file: File, folder: string): Promise<{ path: string; bytes: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new UploadError("Το Supabase Storage δεν έχει ρυθμιστεί.");
  }

  const ext = CONTENT_TYPES[file.type];
  if (!ext) {
    throw new UploadError("Επιτρέπονται μόνο εικόνες JPEG, PNG, WebP ή GIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Η εικόνα είναι πολύ μεγάλη (μέγιστο 5MB).");
  }

  // Random name, never the original filename: sidesteps both collisions and
  // path-injection from a hostile "../../x.jpg" upload name.
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${PRODUCT_IMAGE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": file.type,
      },
      body: await file.arrayBuffer(),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UploadError(`Η μεταφόρτωση απέτυχε (${res.status}). ${body.slice(0, 200)}`);
  }

  return { path, bytes: file.size };
}
