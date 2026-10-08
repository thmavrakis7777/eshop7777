/**
 * Every place in the dashboard where an image is uploaded, and what the
 * upload pipeline (lib/images/optimize.ts) turns it into — the one table both
 * the processing and the admin's hint text read, so the two can never drift
 * apart again (IMAGE_UPLOAD_SPEC.md §2.2).
 *
 * `width` × `height` is the box the image has to *cover*: about 2× the
 * largest place it appears on common screens, from measuring the storefront
 * (28 Σεπ 2026, at 390×844, 768×1024 and 1440×900 — the numbers behind
 * lib/admin/image-size-hints.ts). Almost everywhere the site crops the image
 * to its box with CSS (object-cover), so the pipeline shrinks a photo only
 * as far as it still covers that box — never fitting it *inside* the box,
 * which would leave a portrait photo shown as a wide strip (the «ΠΡΟΣΦΟΡΕΣ»
 * Hero: 1280×1920 in a 1425×512 strip) too narrow and visibly soft. It never
 * crops, never enlarges, and never keeps more than MAX_EDGE on the long side.
 *
 * Budgets are the most a single file should weigh. The pipeline steps
 * quality down to meet them, but never below a floor that would show
 * (optimize.ts), so a very detailed photo can end up a little over — the
 * admin is told when that happens rather than shown a smeared image.
 *
 * Pure data, no imports: read by Client Components (the upload field), by
 * the server (the upload action) and by the one-off backfill script.
 */

export type ImageFormat = "webp" | "avif" | "jpg" | "png";

export type ImageSlot = {
  /** Storage folder inside the product-images bucket. */
  folder: "homepage" | "categories" | "pages" | "journal" | "branding" | "products";
  /** The box the stored image must still cover after shrinking. */
  width: number;
  height: number;
  /** The first one is the file whose path is stored in the database. */
  formats: readonly ImageFormat[];
  budgetKB: number;
};

/** Longest side ever stored, whatever the box — an extreme panorama in a
 *  square box would otherwise keep thousands of pixels nobody sees. Same as
 *  the browser's pre-shrink (lib/admin/prepare-photo.ts UPLOAD_ONLY). */
export const MAX_EDGE = 2560;

export const IMAGE_SLOTS = {
  // The opening Hero fills the screen (1425×868 at 1440×900); a later Hero
  // is a 1425×512 strip.
  "hero-desktop": { folder: "homepage", width: 1920, height: 1080, formats: ["webp", "avif"], budgetKB: 250 },
  // Up to 753×968 on a tablet, 390×796 on a phone.
  "hero-mobile": { folder: "homepage", width: 1200, height: 1800, formats: ["webp", "avif"], budgetKB: 200 },
  // Promo banners 1 and 2, every device: 4:3 cards (701×525 at 1440) or,
  // alone, a square on phones.
  promo: { folder: "homepage", width: 1200, height: 1200, formats: ["webp", "avif"], budgetKB: 120 },
  // Content section: a 4:3 box, half width from 768 px.
  content: { folder: "homepage", width: 1200, height: 900, formats: ["webp", "avif"], budgetKB: 150 },
  // Full-width background (~3:1) under a 70% dark overlay.
  newsletter: { folder: "homepage", width: 1920, height: 640, formats: ["webp", "avif"], budgetKB: 200 },
  // Homepage grid (square), subcategory tiles (4:3, 326×245 at 1440),
  // Landing banner (≤ ~700 px wide).
  category: { folder: "categories", width: 1000, height: 1000, formats: ["webp", "avif"], budgetKB: 120 },
  // Mega-menu tile, 442×548 at 1440.
  "mega-menu": { folder: "categories", width: 800, height: 1000, formats: ["webp", "avif"], budgetKB: 150 },
  // Content page header, 16:9 at ~704 px wide.
  page: { folder: "pages", width: 1600, height: 900, formats: ["webp", "avif"], budgetKB: 150 },
  // Article banner up to 1361×907 at 1440, 4:3 cards in the list.
  "journal-hero": { folder: "journal", width: 1800, height: 1200, formats: ["webp", "avif"], budgetKB: 200 },
  // Link previews (Facebook, WhatsApp, Viber): JPEG is the format every one
  // of them reliably shows. Not cropped to 1200×630 — the owner's framing is
  // kept and the apps trim the edges themselves (IMAGE_UPLOAD_SPEC.md D4).
  "journal-social": { folder: "journal", width: 1200, height: 630, formats: ["jpg"], budgetKB: 300 },
  // Product photos are shown through next/image, which already serves
  // visitors AVIF/WebP at the right width; the JPEG copy is for Meta's
  // catalog, which accepts only JPEG/PNG (IMAGE_UPLOAD_SPEC.md D3). It is
  // never shown on the site, hence the looser budget.
  product: { folder: "products", width: 1600, height: 1600, formats: ["webp", "jpg"], budgetKB: 500 },
} as const satisfies Record<string, ImageSlot>;

export type ImageSlotId = keyof typeof IMAGE_SLOTS;

export function isImageSlotId(value: string): value is ImageSlotId {
  return Object.prototype.hasOwnProperty.call(IMAGE_SLOTS, value);
}

/**
 * The size a `sourceWidth` × `sourceHeight` image (already rotated upright)
 * is stored at for a slot: the smallest that still covers the slot's box,
 * never larger than the source, never longer than MAX_EDGE.
 */
export function storedSize(slot: ImageSlot, sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const cover = Math.max(slot.width / sourceWidth, slot.height / sourceHeight);
  const scale = Math.min(1, cover, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

const FORMAT_LABEL: Record<ImageFormat, string> = { webp: "WebP", avif: "AVIF", jpg: "JPEG", png: "PNG" };

/**
 * The admin-facing sentence for a slot, shown under each upload field: what
 * happens to the file, so the owner knows any photo will do.
 */
export function slotProcessingNote(id: ImageSlotId): string {
  const s: ImageSlot = IMAGE_SLOTS[id];
  const formats = s.formats.filter((f) => !(id === "product" && f === "jpg")).map((f) => FORMAT_LABEL[f]).join(" + ");
  return `Ανέβασε όποια φωτογραφία έχεις (JPEG, PNG, WebP, ακόμα και από κινητό): μετατρέπεται αυτόματα σε ${formats}, στο μέγεθος που χρειάζεται εδώ (περίπου ${s.width}×${s.height} px) και γύρω στα ${s.budgetKB} KB, χωρίς να κοπεί.`;
}
