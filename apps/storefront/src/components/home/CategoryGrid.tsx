import Link from "next/link";
import Image from "next/image";
import type { NavCategory } from "@/lib/types";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { publicImageUrl } from "@/lib/storage/urls";

const TONES = ["clay", "sage", "stone", "linen"] as const;

export function CategoryGrid({
  categories,
  heading = "Ψώνισε κατά κατηγορία",
}: {
  categories: NavCategory[];
  heading?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <section className="container-shell mt-16 md:mt-24">
      <h2 className="text-2xl text-ink md:text-3xl">{heading}</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat, i) => {
          // The category owns its image (Category Management → Εικόνα);
          // this grid never lets an admin pick a second image for the same
          // tile — replacing it in one place updates every Category Grid
          // that shows this category, on the next cache revalidation.
          const imageUrl = publicImageUrl(cat.imagePath);
          return (
            <Link key={cat.handle} href={`/${cat.handle}`} className="group flex flex-col gap-2">
              {imageUrl ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-md">
                  <Image
                    src={imageUrl}
                    alt={cat.name}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 768px) 30vw, 45vw"
                    className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <PlaceholderTile
                  label={cat.name}
                  tone={TONES[i % TONES.length]}
                  className="transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                />
              )}
              <span className="text-sm font-medium text-ink">{cat.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
