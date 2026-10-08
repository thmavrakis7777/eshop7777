import { slugFromGreek } from "../slug";

/**
 * File names for uploads made by the image pipeline:
 *
 *   homepage/eidi-ygraeriou.k3j9x2m1qz.webp   ← the path stored in the DB
 *   homepage/eidi-ygraeriou.k3j9x2m1qz.avif   ← same name, other formats
 *
 * The readable part is the image's alt text (or heading, or file name) in
 * Latin letters — a small search signal Google Images reads, where a UUID
 * said nothing (IMAGE_UPLOAD_SPEC.md §2.4). The random part keeps every
 * upload at a new URL: the year-long `immutable` cache header the uploads
 * carry (lib/storage/upload.ts) is only safe because a URL's bytes never
 * change.
 *
 * The shape is also how the storefront knows an AVIF/JPEG sits beside a
 * WebP without asking Storage: only the pipeline writes names with a dotted
 * 10-character random part, and it always writes every format of the slot.
 * Older uploads (`<uuid>.jpg`) and pasted URLs never match, so they are
 * never pointed at a file that doesn't exist.
 *
 * No server imports: used by the storefront components, the upload action
 * and the backfill script alike.
 */

const RANDOM_LENGTH = 10;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const OPTIMIZED_FILE = /^[a-z0-9-]+\.[a-z0-9]{10}\.(webp|avif|jpg|png)$/;
// Only our own bucket — a pasted external URL that happens to look similar
// must never be rewritten.
const OWN_BUCKET = "/storage/v1/object/public/product-images/";

export function randomNamePart(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** `eidi-ygraeriou.k3j9x2m1qz` — the shared stem of every format's file. */
export function optimizedStem(label: string, random: string = randomNamePart()): string {
  const readable = slugFromGreek(label.replace(/\.[a-z0-9]{2,5}$/i, "")).slice(0, 60).replace(/-+$/, "");
  return `${readable || "eikona"}.${random}`;
}

/**
 * The same image in another format, when the pipeline made one: a WebP
 * stored by the pipeline → its AVIF (storefront `<picture>`) or JPEG (Meta
 * catalog feed). Null for anything else — older uploads, external URLs,
 * empty values — so callers simply skip the extra source.
 *
 * Accepts either a bucket-relative path or the full public URL, and returns
 * the same kind it was given.
 */
export function imageVariant(url: string | null | undefined, format: "avif" | "jpg"): string | null {
  if (!url) return null;
  const isAbsolute = /^https?:\/\//i.test(url);
  if (isAbsolute && !url.includes(OWN_BUCKET)) return null;
  const clean = url.split(/[?#]/)[0];
  const file = clean.slice(clean.lastIndexOf("/") + 1);
  if (!OPTIMIZED_FILE.test(file) || !file.endsWith(".webp")) return null;
  return `${clean.slice(0, -".webp".length)}.${format}`;
}
