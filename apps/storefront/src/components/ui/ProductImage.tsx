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
}: {
  imageUrl: string | null;
  label: string;
  tone: Tone;
  sizes: string;
}) {
  if (!imageUrl) {
    return <PlaceholderTile label={label} tone={tone} />;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md">
      <Image src={imageUrl} alt={label} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
