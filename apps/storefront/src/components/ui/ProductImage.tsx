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
}: {
  imageUrl: string | null;
  label: string;
  tone: Tone;
  sizes: string;
  priority?: boolean;
}) {
  if (!imageUrl) {
    return <PlaceholderTile label={label} tone={tone} />;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md">
      <Image src={imageUrl} alt={label} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
