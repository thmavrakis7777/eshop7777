import { addProductImageAction } from "@/lib/admin/catalog-actions";
import { preparePhoto } from "@/lib/admin/prepare-photo";

/**
 * Uploads several photos to one product — shared by the "new product" form
 * and the editor's photo panel. Browser-only (preparePhoto draws on a
 * canvas).
 *
 * One after another, never in parallel: addProductImage gives each photo
 * the position after the current last one, which two simultaneous uploads
 * would both read as the same number. So the photos keep the order they
 * were picked in, and the first becomes the main one on a product that has
 * none yet.
 *
 * A failed photo doesn't stop the rest. Returns one "file: reason" line per
 * failure, empty when every photo went up.
 */
export async function uploadProductPhotos(
  productId: string,
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const failures: string[] = [];
  for (const [i, file] of files.entries()) {
    onProgress?.(i + 1, files.length);
    const data = new FormData();
    data.append("file", await preparePhoto(file));
    const result = await addProductImageAction(productId, data).catch(() => ({
      ok: false as const,
      error: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    }));
    if (!result.ok) failures.push(`${file.name}: ${result.error}`);
  }
  return failures;
}
