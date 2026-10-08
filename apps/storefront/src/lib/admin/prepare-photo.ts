/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A phone photo is typically 3000–4000 px and 2–5 MB; the product page never
 * shows one larger than ~665 px (see IMAGE_SIZE_HINTS.product), and uploads
 * are capped at 4 MB (lib/storage/upload.ts). Re-encoding to 1600 px WebP
 * brings a 4 MB photo to roughly 0.3–0.6 MB with no visible difference at
 * the sizes it is shown, and uploads it several times faster. Free — it
 * runs on the admin's own device, nothing new server-side.
 *
 * Re-drawing also drops the photo's EXIF data (camera, GPS location), with
 * the phone's rotation applied first so nothing comes out sideways.
 *
 * Returns the original file whenever shrinking wouldn't help or can't be
 * done: already small, a GIF (may be animated), a browser that can't decode
 * or encode it, or a result that isn't actually smaller. The server still
 * checks type and size either way.
 */

type PrepareOptions = { maxEdge: number; keepBelowBytes: number; quality: number };

// Product photos: shrunk to their final size here (1600 px, see
// IMAGE_SIZE_HINTS.product). A photo this small and already within 1600 px
// is uploaded untouched — re-encoding it would only cost quality.
const PRODUCT: PrepareOptions = { maxEdge: 1600, keepBelowBytes: 600 * 1024, quality: 0.85 };

/**
 * Every other image field (ImageUploadField): the server's image pipeline
 * does the real resizing for each slot (lib/images/optimize.ts), so this
 * only has to get a phone photo under the 4 MB upload limit
 * (lib/storage/upload.ts) — 2560 px is above every slot's size, and 0.92
 * keeps the detail the server's own encode starts from. Files already under
 * 3.5 MB and 2560 px go up exactly as picked.
 */
export const UPLOAD_ONLY: PrepareOptions = { maxEdge: 2560, keepBelowBytes: 3.5 * 1024 * 1024, quality: 0.92 };

export async function preparePhoto(file: File, { maxEdge, keepBelowBytes, quality }: PrepareOptions = PRODUCT): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation a phone stores instead of
    // turning the pixels (the spec default, spelled out on purpose).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= keepBelowBytes) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // WebP keeps a PNG's transparency. A browser without a WebP encoder
    // hands back a PNG instead — then JPEG for photos, and the original
    // file for a PNG (JPEG would turn transparency black).
    let blob = await toBlob(canvas, "image/webp", quality);
    if (blob?.type !== "image/webp") {
      blob = file.type === "image/png" ? null : await toBlob(canvas, "image/jpeg", quality);
    }
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
