import Link from "next/link";
import Image from "next/image";
import type { NavCategory } from "@/lib/types";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { HorizontalScroller } from "@/components/ui/HorizontalScroller";
import { publicImageUrl } from "@/lib/storage/urls";

const TONES = ["clay", "sage", "stone", "linen"] as const;

// One row at every screen size, never a wrapping grid. A fixed grid left a
// single category stranded on its own row whenever the count didn't divide
// evenly — 7 categories did that at all three sizes (2, 3 and 6 columns),
// and on phones the grid ran taller than a whole screen. The count is set in
// the admin, so any fixed column count would break again for some number.
//
// Widths per breakpoint:
//   - phones 40%: two cards and a clearly cut-off third at the screen edge,
//     so a swipe is the obvious next move;
//   - sm 28% and md 22%: the same peek, with more cards visible;
//   - lg: exactly six per row — the size the grid already used — so desktop
//     cards look unchanged and anything past six sits behind the arrow.
const CARD_WIDTH = "w-[40%] flex-none snap-start sm:w-[28%] md:w-[22%] lg:w-[calc((100%_-_5rem)/6)]";

// Below lg the track runs full-bleed, so the peeking card is cut off by the
// screen edge rather than by the page padding: the negative margin cancels
// container-shell's padding-inline (1.25rem, then 2rem from md) and the
// matching padding + scroll-padding keep the first card and every snapped
// card aligned with the heading above. At lg the row sits inside the
// container like the rest of the page, with the arrows on its edges.
const TRACK_BLEED = "-mx-5 px-5 scroll-px-5 md:-mx-8 md:px-8 md:scroll-px-8 lg:mx-0 lg:px-0 lg:scroll-px-0";

// Mirrors CARD_WIDTH, so the browser never downloads a larger image than the
// card displays (at lg, six cards inside a max-90rem container come to ~16vw).
const CARD_SIZES = "(min-width: 1024px) 16vw, (min-width: 768px) 22vw, (min-width: 640px) 28vw, 40vw";

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
      <div className="mt-6">
        <HorizontalScroller
          label={`${heading} — κύλιση με το πληκτρολόγιο ή αφή`}
          previousLabel={`${heading} — προηγούμενες κατηγορίες`}
          nextLabel={`${heading} — επόμενες κατηγορίες`}
          className={TRACK_BLEED}
        >
          {categories.map((cat, i) => {
            // The category owns its image (Category Management → Εικόνα);
            // this grid never lets an admin pick a second image for the same
            // tile — replacing it in one place updates every Category Grid
            // that shows this category, on the next cache revalidation.
            const imageUrl = publicImageUrl(cat.imagePath);
            return (
              <Link key={cat.handle} href={`/${cat.handle}`} className={`group flex flex-col gap-2 ${CARD_WIDTH}`}>
                {imageUrl ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-md">
                    <Image
                      src={imageUrl}
                      alt={cat.name}
                      fill
                      sizes={CARD_SIZES}
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
        </HorizontalScroller>
      </div>
    </section>
  );
}
