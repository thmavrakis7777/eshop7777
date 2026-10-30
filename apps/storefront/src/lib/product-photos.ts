import { colourVariantsOf, defaultColourVariant } from "@/lib/colour-variants";
import type { Product } from "@/lib/types";

/**
 * The photo a product page opens on, for everything that names one main photo
 * (Product data, primaryImageOfPage, og:image, twitter:image). ProductGallery
 * shows the same one first: a colour product's default colour, so a sold-out
 * colour's photo is never the page's main image; any other product's first
 * photo. Reads no extra data, so generateMetadata can call it for free.
 */
export function primaryPhotoUrl(product: Pick<Product, "variants" | "imageUrl">): string | null {
  const colours = colourVariantsOf(product.variants);
  return (colours && defaultColourVariant(colours).imageUrl) || product.imageUrl;
}

/** Every photo, the main one first and the rest in their gallery order. */
export function photosPrimaryFirst(photos: string[], primary: string | null): string[] {
  if (!primary || !photos.includes(primary)) return photos;
  return [primary, ...photos.filter((photo) => photo !== primary)];
}
