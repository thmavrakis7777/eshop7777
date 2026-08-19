/**
 * Supabase Storage URL helpers.
 *
 * The database stores a bucket-relative PATH, never a full URL, so moving
 * bucket or putting a CDN in front never means rewriting rows. The public
 * URL is derived here, at render time.
 *
 * Safe to import from Client Components — it only reads a public env var and
 * builds a string. No credentials involved: reads go straight to the bucket's
 * public URL, uploads happen server-side with the service key (lib/storage/upload).
 */

export const PRODUCT_IMAGE_BUCKET = "product-images";

/**
 * Returns null when the path is empty or storage isn't configured yet, which
 * is what every image consumer already handles — ProductCard and friends fall
 * back to PlaceholderTile. No product photography exists yet, so today this
 * legitimately returns null for the entire catalog.
 */
export function publicImageUrl(
  path: string | null | undefined,
  bucket: string = PRODUCT_IMAGE_BUCKET
): string | null {
  if (!path) return null;
  // Already a full URL (a legacy or externally-hosted image) — pass through.
  if (/^https?:\/\//i.test(path)) return path;

  // .trim(): a pasted env var with a trailing newline is a real failure mode
  // (confirmed live — Vercel's dashboard doesn't strip one), and NEXT_PUBLIC_
  // vars are inlined at build time, so a bad paste breaks every image on
  // every deploy until someone notices and redeploys. Trimming here means a
  // stray newline in the dashboard value can never break rendering again.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path.replace(/^\//, "")}`;
}
