import Image from "next/image";
import type { Tone } from "@/lib/types";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";

// Shared by ProductCard and SearchResultRow so "real photo vs. placeholder
// tile" is decided in exactly one place — no real product has a photo yet,
// but every card/row already renders correctly the moment one does, without
// each caller re-implementing the same null check.
export function ProductImage({
  imageUrl,
  label,
  tone,
  sizes,
  // Opt-in, defaulting to next/image's own lazy loading, because that is the
  // right behaviour for all but a handful of images on any page: this
  // component renders in listing grids, the cart drawer, the checkout summary
  // and the search dropdown, none of which are above the fold. It exists for
  // the ones that are — Next's dev overlay flagged the first listing card as
  // the Largest Contentful Paint element and asked for exactly this — and
  // priority is a preload, so it is only ever a win while it stays scarce:
  // marking a whole grid would put every card ahead of the one image the
  // shopper is actually waiting for. Callers pass it for a first row, never
  // for a page.
  priority = false,
  // The product page's gentle hover zoom (ProductGallery), for listing
  // cards: the photo eases up to 105% while the pointer is over the nearest
  // `group` — the caller's card. Off for the small thumbnails (cart, search
  // dropdown, checkout), where a moving photo is noise rather than polish.
  hoverZoom = false,
}: {
  imageUrl: string | null;
  label: string;
  tone: Tone;
  sizes: string;
  priority?: boolean;
  hoverZoom?: boolean;
}) {
  if (!imageUrl) {
    return <PlaceholderTile label={label} tone={tone} />;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md">
      {/* next/image's own `priority` is deprecated since Next 16 in favour of
          `preload`, which is the same behaviour (get-img-props.js maps one
          onto the other); this component keeps its `priority` name so its
          callers don't have to change. */}
      <Image
        src={imageUrl}
        alt={label}
        fill
        sizes={sizes}
        preload={priority}
        // Same timing as ProductGallery. `scale`, not `transform` (Tailwind
        // v4's scale-* sets the separate CSS property); group-hover only
        // fires on devices that really hover, so a tap never leaves a photo
        // stuck zoomed.
        className={
          hoverZoom
            ? "object-cover [transition:scale_700ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-safe:group-hover:scale-[1.05]"
            : "object-cover"
        }
      />
    </div>
  );
}
