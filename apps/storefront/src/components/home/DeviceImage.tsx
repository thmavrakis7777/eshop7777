import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import type { Tone } from "@/lib/types";

/**
 * Desktop/tablet/mobile art-directed image with automatic fallback — the
 * Promotional Banner's device-specific images (Part 2.8–2.10 of the
 * homepage brief). Plain `<picture>`/`<source>`, not `next/image`: the same
 * choice already made for Hero.tsx and EditorialBanner.tsx's existing
 * single image, for the same two reasons documented there — the production
 * CSP blocks inline `background-image` styles, and `next/image` has no way
 * to swap `src` per breakpoint the way art direction (not just resizing)
 * needs. These are admin-uploaded images of arbitrary dimensions (unlike
 * product photos, which do go through `next/image`), so nothing here is
 * resized server-side — the admin UI's hint text says so explicitly.
 *
 * Fallback (Part 2.9): tablet falls back to desktop when empty, mobile
 * falls back to desktop when empty. Always renders exactly the same three
 * `<picture>` elements regardless of what's configured, so the cascade
 * itself — not conditional JSX — is what implements the fallback: the
 * browser only ever downloads ONE of the three, whichever matches its own
 * width, never all three "hidden by CSS".
 */
export function DeviceImage({
  desktopUrl,
  tabletUrl,
  mobileUrl,
  alt,
  className,
  placeholderLabel,
  placeholderTone = "sage",
}: {
  desktopUrl: string | null;
  tabletUrl?: string | null;
  mobileUrl?: string | null;
  alt: string;
  className?: string;
  placeholderLabel: string;
  placeholderTone?: Tone;
}) {
  if (!desktopUrl) {
    return <PlaceholderTile label={placeholderLabel} tone={placeholderTone} className={className} />;
  }

  const tabletResolved = tabletUrl || desktopUrl;
  const mobileResolved = mobileUrl || desktopUrl;

  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={desktopUrl} />
      <source media="(min-width: 768px)" srcSet={tabletResolved} />
      <img src={mobileResolved} alt={alt} loading="lazy" decoding="async" className={className} />
    </picture>
  );
}
