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

/** Longest signature checked below (WebP needs bytes 0–11). */
const SNIFF_BYTES = 12;

export class UploadError extends Error {}

/**
 * Identifies an image format from its leading bytes, or null if the bytes
 * are not one of the four formats CONTENT_TYPES allows.
 *
 * A File's `type` is set by the browser from the OS's filename→MIME mapping
 * and is trivially forged by anything posting the multipart body directly —
 * it is a hint, not evidence. These byte prefixes are the evidence.
 *
 * Deliberately not a full decode: this proves a file is the format it claims
 * to be, not that it is a well-formed image. That is the property that
 * actually matters here, because the stored object is later served back to
 * every visitor under the Content-Type recorded at upload time — the step
 * where a mislabelled file becomes a stored-XSS vector rather than a broken
 * thumbnail. Rejecting an HTML or SVG payload wearing an `image/png` label
 * is the whole job; validating that a real PNG decodes cleanly is not, and
 * would need an image library this app has no other reason to carry.
 *
 * Exported for its unit test (lib/storage/upload.test.ts) — not used
 * elsewhere.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) =>
    sig.length <= bytes.length && sig.every((b, i) => bytes[i] === b);

  // JPEG: SOI marker, plus the 0xFF that opens the following marker.
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";

  // PNG: the full 8-byte signature. The trailing CRLF/EOF/LF bytes are part
  // of the spec's own defence against naive text-mode transfers mangling the
  // file, so checking all eight costs nothing and catches more.
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";

  // GIF: "GIF8" then either "7a" or "9a" — the only two versions that exist.
  if (
    startsWith(0x47, 0x49, 0x46, 0x38) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: a RIFF container whose form type at bytes 8–11 is "WEBP". Bytes
  // 4–7 are the chunk length — file-specific, deliberately not checked.
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function uploadImage(file: File, folder: string): Promise<{ path: string; bytes: number }> {
  // .trim(): confirmed live that a pasted dashboard value can carry a
  // trailing newline — see the matching note in lib/storage/urls.ts. Here it
  // would land in a URL and an Authorization header, so it's worth guarding
  // even though this env var isn't NEXT_PUBLIC_-inlined.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new UploadError("Το Supabase Storage δεν έχει ρυθμιστεί.");
  }

  // Cheap rejections first, both before the file is read into memory: an
  // unsupported declared type never needs sniffing, and the size cap is what
  // bounds the allocation on the next line.
  if (!CONTENT_TYPES[file.type]) {
    throw new UploadError("Επιτρέπονται μόνο εικόνες JPEG, PNG, WebP ή GIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Η εικόνα είναι πολύ μεγάλη (μέγιστο 5MB).");
  }

  // Read once, reuse for both the signature check and the request body — the
  // cap above bounds this at 5MB, and a File's stream cannot be read twice.
  const buffer = await file.arrayBuffer();
  const sniffed = sniffImageType(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, SNIFF_BYTES)));

  // Two separate failures, one message: the bytes are not a supported image
  // at all, or they are but disagree with what the client declared. Neither
  // is a case an honest admin upload produces, and distinguishing them for
  // the user would only tell an attacker which half of the check they beat.
  if (!sniffed || sniffed !== file.type) {
    throw new UploadError("Το αρχείο δεν είναι έγκυρη εικόνα JPEG, PNG, WebP ή GIF.");
  }

  // Extension and Content-Type both come from the sniffed type, never the
  // declared one. With the equality check above they are identical today;
  // deriving them from the bytes keeps that true by construction rather than
  // by that check continuing to be correct.
  const ext = CONTENT_TYPES[sniffed];

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
        "Content-Type": sniffed,
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UploadError(`Η μεταφόρτωση απέτυχε (${res.status}). ${body.slice(0, 200)}`);
  }

  return { path, bytes: file.size };
}
