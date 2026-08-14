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

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path.replace(/^\//, "")}`;
}
