/**
 * Path matching for the media library (lib/admin/media.ts), kept free of
 * the database so it can be unit-tested — it is what decides whether an
 * image counts as "in use", which is the only thing standing between an
 * image and the delete button.
 */

/** "products/etazera-metalliki.1oudh46jr0.webp" → "products/etazera-metalliki.1oudh46jr0" */
export function mediaKey(path: string): string {
  return path.replace(/^\/+/, "").replace(/\.[a-z0-9]+$/i, "");
}

/**
 * Every storage path mentioned in a piece of text — a bare path
 * ("products/x.webp"), a full public URL, or an image inside an article's
 * body — as group keys. The file part never contains "/", so a full URL
 * yields its last folder/file pair, which is the bucket-relative path.
 */
export function referencedKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const re = /([a-z0-9_-]+\/[^\s"'()<>?#/\\]+)\.(?:webp|avif|jpe?g|png|gif)/gi;
  for (const m of text.matchAll(re)) keys.push(m[1]);
  return keys;
}
