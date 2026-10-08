import sharp, { type Sharp } from "sharp";
import { IMAGE_SLOTS, storedSize, type ImageFormat, type ImageSlot, type ImageSlotId } from "./slots";

/**
 * The upload pipeline's image work (IMAGE_UPLOAD_SPEC.md §2): one uploaded
 * image in, every format its slot needs out, each at the slot's size and
 * within its file-size budget where quality allows.
 *
 * Node-only (sharp is a native module) — never import this from a Client
 * Component. It deliberately has no `server-only` import and no `@/` paths,
 * so the one-off backfill of existing images can run the exact same code.
 *
 * What happens to every image:
 *   - the phone's EXIF rotation is applied, then dropped with the rest of the
 *     metadata — EXIF, GPS, camera serials (sharp writes none unless told to);
 *   - colours are converted to sRGB, what every browser assumes;
 *   - it is shrunk only as far as it still covers the slot's box (slots.ts
 *     storedSize): never cropped (the framing is the owner's, the site crops
 *     with CSS), never enlarged (that only adds bytes);
 *   - each format is encoded at a quality that looks identical to the
 *     original at the size it is shown, stepping down at most twice to meet
 *     the slot's budget and never below the last step — past that, softening
 *     shows, and a slightly heavier file is the better trade.
 *
 * Measured on this store's photos (08 Οκτ 2026): WebP ~0.3 s and AVIF
 * ~1–1.5 s per image; AVIF comes out ~30% smaller than WebP at the same
 * look (1200×1200 banner: WebP 54 KB / AVIF 39 KB).
 */

// Highest first. WebP 82 / AVIF 58 / JPEG 84 are the starting points that
// matched the originals by eye and by SSIM (≥0.98) on the store's own
// photos; the last step of each is the floor.
const QUALITY_STEPS: Record<ImageFormat, readonly number[]> = {
  webp: [82, 76, 70],
  avif: [58, 52, 46],
  jpg: [84, 78, 72],
  // Lossless — the budget can't be met by quality, only reported.
  png: [100],
};

export const IMAGE_CONTENT_TYPES: Record<ImageFormat, string> = {
  webp: "image/webp",
  avif: "image/avif",
  jpg: "image/jpeg",
  png: "image/png",
};

// sharp's names for the formats an upload can arrive in.
const SHARP_FORMAT: Partial<Record<ImageFormat, string>> = { webp: "webp", jpg: "jpeg", png: "png" };

export type OptimizedFile = {
  format: ImageFormat;
  data: Buffer;
  /** Null when the uploaded bytes were kept as they were. */
  quality: number | null;
};

export type OptimizedImage = {
  width: number;
  height: number;
  /** In the slot's format order — the first is the one stored in the DB. */
  files: OptimizedFile[];
  /** At least one file is over the slot's budget even at the floor quality. */
  overBudget: boolean;
};

export async function optimizeImage(input: Buffer, slotId: ImageSlotId): Promise<OptimizedImage> {
  const slot: ImageSlot = IMAGE_SLOTS[slotId];
  const meta = await sharp(input).metadata();
  const sourceWidth = meta.autoOrient?.width ?? meta.width ?? 0;
  const sourceHeight = meta.autoOrient?.height ?? meta.height ?? 0;

  // Decode, rotate, resize and convert once; every format is encoded from
  // this, rather than re-running the whole pipeline per encode. The size is
  // the smallest that still covers the slot's box (storedSize) — the site
  // crops to that box, so anything less would show soft.
  const target = storedSize(slot, sourceWidth, sourceHeight);
  const { data: pixels, info } = await sharp(input)
    .rotate()
    .resize({ width: target.width, height: target.height, fit: "fill" })
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const fromPixels = () => sharp(pixels, { raw: { width: info.width, height: info.height, channels: info.channels } });

  // An upload that is already in the target format, already at its stored
  // size, carries no metadata and is within budget — the browser's own
  // pre-shrink produces exactly that (lib/admin/prepare-photo.ts), and so
  // does a WebP someone already optimised — is kept byte for byte.
  // Re-compressing a compressed image only loses detail, even when the
  // result is a few KB smaller; the look comes first (IMAGE_UPLOAD_SPEC.md).
  const untouched = info.width === sourceWidth && info.height === sourceHeight;
  const noMetadata = !meta.exif && !meta.xmp && !meta.iptc && (meta.orientation ?? 1) === 1;
  const budget = slot.budgetKB * 1024;

  let overBudget = false;
  const files: OptimizedFile[] = [];
  for (const format of slot.formats) {
    if (untouched && noMetadata && meta.format === SHARP_FORMAT[format] && input.length <= budget) {
      files.push({ format, quality: null, data: input });
      continue;
    }
    let best: OptimizedFile | null = null;
    for (const quality of QUALITY_STEPS[format]) {
      best = { format, quality, data: await encode(fromPixels(), format, quality) };
      if (best.data.length <= budget) break;
    }
    if (!best) continue;
    if (best.data.length > budget) overBudget = true;
    files.push(best);
  }

  return { width: info.width, height: info.height, files, overBudget };
}

function encode(image: Sharp, format: ImageFormat, quality: number): Promise<Buffer> {
  switch (format) {
    case "webp":
      return image.webp({ quality, effort: 5, smartSubsample: true }).toBuffer();
    case "avif":
      return image.avif({ quality, effort: 4 }).toBuffer();
    case "jpg":
      // JPEG has no transparency: a transparent PNG gets white behind it,
      // the page background, rather than black.
      return image.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    case "png":
      return image.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  }
}
