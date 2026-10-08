import type { ReactElement } from "react";
import { imageVariant } from "@/lib/images/names";

/**
 * The AVIF the upload pipeline stores beside an image's WebP
 * (IMAGE_UPLOAD_SPEC.md §2.5), as a `<source>` for a `<picture>`. Browsers
 * that read AVIF take it — about 30% lighter for the same look — and the
 * rest fall through to the next source or the `<img>`. Renders nothing for
 * images that have no AVIF (older uploads, pasted URLs).
 *
 * Goes immediately before the WebP source with the same `media`, so art
 * direction (desktop/tablet/mobile crops) picks exactly as before.
 */
export function AvifSource({ src, media }: { src: string | null | undefined; media?: string }) {
  const avif = imageVariant(src, "avif");
  return avif ? <source type="image/avif" media={media} srcSet={avif} /> : null;
}

/**
 * For a lone `<img>` of an uploaded image: wraps it in a `<picture>` with its
 * AVIF when there is one, and leaves it exactly as it was when there isn't.
 * `display: contents` takes the `<picture>` itself out of layout, so the
 * `<img>` sizes and positions against the same parent as before.
 */
export function WithAvif({ src, children }: { src: string | null | undefined; children: ReactElement }) {
  const avif = imageVariant(src, "avif");
  if (!avif) return children;
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={avif} />
      {children}
    </picture>
  );
}
