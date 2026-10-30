import { siteUrl } from "@/lib/site-config";

/**
 * The address to give search engines and social crawlers for a stored photo.
 *
 * Supabase Storage answers every public file with `x-robots-tag: none`
 * (measured 2026-10-30, all 89 product photos), so Google may fetch those URLs
 * but not index them, and Google requires indexable image URLs in Product
 * data. The same photo through this site's image optimizer has no such header.
 *
 * This is exactly the `src` next/image renders for these photos: width 3840
 * (the largest in the default srcset; a 1254 px original is never enlarged) at
 * quality 75. Reusing that one URL means crawlers read the file the page
 * itself shows, and it adds no second cached copy per photo. indexable.test.ts
 * fails if a Next upgrade changes it.
 *
 * Anything the optimizer wouldn't accept (next.config.ts remotePatterns: only
 * our Supabase project's public files) is returned unchanged, since sending it
 * through would answer 400.
 */
export function indexableImageUrl(url: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== new URL(base).hostname) return url;
  if (!parsed.pathname.startsWith("/storage/v1/object/public/")) return url;
  return `${siteUrl}/_next/image?url=${encodeURIComponent(url)}&w=3840&q=75`;
}
