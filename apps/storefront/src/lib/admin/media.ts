import "server-only";
import { sql } from "@/lib/db/client";
import { PRODUCT_IMAGE_BUCKET, publicImageUrl } from "@/lib/storage/urls";
import { mediaKey, referencedKeys } from "@/lib/admin/media-paths";

/**
 * The media library (Admin → Πολυμέσα): every image file in the bucket, and
 * where each one is used.
 *
 * Built from Storage's own object table, not shop.media_asset: media_asset
 * only has rows for uploads made since it existed, and it keeps its row when
 * a file is gone. The bucket is what is really there and really costs space.
 *
 * One upload is several files: the pipeline writes WebP plus AVIF and/or
 * JPEG under one name (lib/storage/upload.ts, lib/images/names.ts), and the
 * storefront and the Meta feed pick the format they need from beside the
 * stored path. So an IMAGE here is a folder/stem group: shown once, counted
 * once, in use if any of its files is, and deleted all together — deleting
 * only the WebP would leave the Meta feed's JPEG pointing at a photo that no
 * longer exists anywhere else, and vice versa.
 */

export type MediaUsage = { label: string; href: string | null };

export type MediaFile = { name: string; format: string; bytes: number };

export type MediaItem = {
  /** folder/stem — the group's id, and what delete takes. */
  key: string;
  folder: string;
  name: string;
  files: MediaFile[];
  bytes: number;
  /** The smallest browser-readable file, for the thumbnail. */
  previewUrl: string | null;
  /** The main file (WebP when there is one) — what "Άνοιγμα" opens. */
  originalUrl: string | null;
  createdAt: string;
  altText: string | null;
  usages: MediaUsage[];
};

const DISPLAYABLE = new Set(["avif", "webp", "jpg", "jpeg", "png", "gif"]);

/**
 * Every place the shop can point at an image, with a label the owner
 * recognises and a link to where it is edited. Text columns (bodies, the
 * homepage config JSON) are scanned whole, so an image placed inside an
 * article counts as used too. Add a row here whenever a new column starts
 * holding an image path — anything missing from this list would show up as
 * "unused" and could be deleted.
 */
async function loadReferences(): Promise<Array<{ text: string; label: string; href: string | null }>> {
  return sql<{ text: string; label: string; href: string | null }[]>`
    SELECT i.storage_path AS text, 'Προϊόν: ' || p.title AS label, '/admin/products/' || p.id AS href
      FROM shop.product_image i JOIN shop.product p ON p.id = i.product_id
    UNION ALL
    SELECT c.image_path, 'Κατηγορία: ' || c.name, '/admin/categories' FROM shop.category c
     WHERE c.image_path IS NOT NULL
    UNION ALL
    SELECT cp.image_path, 'Promo κατηγορίας: ' || c.name, '/admin/categories'
      FROM shop.category_promo cp JOIN shop.category c ON c.id = cp.category_id
     WHERE cp.image_path IS NOT NULL
    UNION ALL
    SELECT co.image_path, 'Συλλογή: ' || co.title, '/admin/collections' FROM shop.collection co
     WHERE co.image_path IS NOT NULL
    UNION ALL
    SELECT concat_ws(' ', b.image_path, b.tablet_image_path, b.mobile_image_path, b.body, b.config::text),
           'Αρχική: ' || COALESCE(NULLIF(b.heading, ''), b.kind), '/admin/content/homepage'
      FROM shop.homepage_block b
    UNION ALL
    SELECT concat_ws(' ', pg.image_path, pg.body), 'Σελίδα: ' || pg.title, '/admin/content/pages'
      FROM shop.content_page pg
    UNION ALL
    SELECT concat_ws(' ', j.hero_image_path, j.body), 'Journal: ' || j.title, '/admin/journal/' || j.id
      FROM shop.journal_article j
    UNION ALL
    SELECT pb.body, 'Banner: ' || COALESCE(pb.headline, ''), '/admin/content/layout' FROM shop.promo_banner pb
    UNION ALL
    SELECT concat_ws(' ', s.social_image_path, s.structured_data_override::text), 'SEO (εικόνα κοινοποίησης)',
           '/admin/content/seo'
      FROM shop.seo_meta s
     WHERE s.social_image_path IS NOT NULL OR s.structured_data_override IS NOT NULL
    UNION ALL
    SELECT concat_ws(' ', st.logo_path, st.favicon_path, st.og_image_path), 'Ρυθμίσεις: λογότυπο / favicon / εικόνα κοινοποίησης',
           '/admin/settings'
      FROM shop.site_setting st`;
}

/** group key → where it's used (deduplicated by label). */
async function usageIndex(): Promise<Map<string, MediaUsage[]>> {
  const index = new Map<string, MediaUsage[]>();
  for (const ref of await loadReferences()) {
    for (const key of new Set(referencedKeys(ref.text))) {
      const list = index.get(key) ?? [];
      if (!list.some((u) => u.label === ref.label)) list.push({ label: ref.label, href: ref.href });
      index.set(key, list);
    }
  }
  return index;
}

type ObjectRow = { name: string; bytes: string | null; created_at: Date };

async function loadObjects(keys?: string[]): Promise<ObjectRow[]> {
  return sql<ObjectRow[]>`
    SELECT o.name, o.metadata->>'size' AS bytes, o.created_at
      FROM storage.objects o
     WHERE o.bucket_id = ${PRODUCT_IMAGE_BUCKET}
       ${keys ? sql`AND regexp_replace(o.name, '\\.[A-Za-z0-9]+$', '') = ANY(${keys})` : sql``}
     ORDER BY o.created_at DESC`;
}

// "etazera-metalliki-3-orofon-goniaki.1oudh46jr0" → "etazera-metalliki-3-orofon-goniaki":
// the random part (lib/images/names.ts) tells the owner nothing.
function readableName(key: string): string {
  const stem = key.slice(key.indexOf("/") + 1);
  return stem.replace(/\.[a-z0-9]{6,}$/i, "");
}

export async function listMediaLibrary(): Promise<MediaItem[]> {
  const [objects, usages, assets] = await Promise.all([
    loadObjects(),
    usageIndex(),
    sql<{ storage_path: string; label: string | null; alt_text: string | null }[]>`
      SELECT storage_path, label, alt_text FROM shop.media_asset`,
  ]);

  const assetByKey = new Map(assets.map((a) => [mediaKey(a.storage_path), a]));
  const groups = new Map<string, { files: MediaFile[]; createdAt: Date }>();
  for (const o of objects) {
    const key = mediaKey(o.name);
    const format = (o.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
    const group = groups.get(key) ?? { files: [], createdAt: new Date(o.created_at) };
    group.files.push({ name: o.name, format, bytes: Number(o.bytes ?? 0) });
    if (new Date(o.created_at) < group.createdAt) group.createdAt = new Date(o.created_at);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, g]) => {
    const shown = g.files.filter((f) => DISPLAYABLE.has(f.format));
    const preview = [...shown].sort((a, b) => a.bytes - b.bytes)[0];
    const main = shown.find((f) => f.format === "webp") ?? shown[0];
    const asset = assetByKey.get(key);
    return {
      key,
      folder: key.split("/")[0],
      name: readableName(key),
      files: g.files,
      bytes: g.files.reduce((n, f) => n + f.bytes, 0),
      previewUrl: preview ? publicImageUrl(preview.name) : null,
      originalUrl: main ? publicImageUrl(main.name) : null,
      createdAt: g.createdAt.toISOString(),
      altText: asset?.alt_text ?? null,
      usages: usages.get(key) ?? [],
    };
  });
}

/**
 * The files of the requested images that are NOT used anywhere, checked
 * again now — never trusting what the browser saw when the page loaded (a
 * photo may have been attached to a product since). Used images are
 * returned separately so the caller can say what was skipped.
 */
export async function resolveDeletableMedia(
  keys: string[]
): Promise<{ deletable: Array<{ key: string; files: string[] }>; inUse: string[] }> {
  const [objects, usages] = await Promise.all([loadObjects(keys), usageIndex()]);
  const filesByKey = new Map<string, string[]>();
  for (const o of objects) {
    const key = mediaKey(o.name);
    filesByKey.set(key, [...(filesByKey.get(key) ?? []), o.name]);
  }
  const deletable: Array<{ key: string; files: string[] }> = [];
  const inUse: string[] = [];
  for (const [key, files] of filesByKey) {
    if (usages.has(key)) inUse.push(key);
    else deletable.push({ key, files });
  }
  return { deletable, inUse };
}

/** media_asset rows for files that no longer exist. */
export async function deleteMediaAssetRows(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await sql`DELETE FROM shop.media_asset WHERE ltrim(storage_path, '/') = ANY(${paths})`;
}
