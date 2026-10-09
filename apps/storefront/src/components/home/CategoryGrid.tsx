import Link from "next/link";
import Image from "next/image";
import type { NavCategory } from "@/lib/types";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { HorizontalScroller } from "@/components/ui/HorizontalScroller";
import { AfterPageLoad } from "@/components/ui/AfterPageLoad";
import { publicImageUrl } from "@/lib/storage/urls";

const TONES = ["clay", "sage", "stone", "linen"] as const;

// One row at every screen size, never a wrapping grid. A fixed grid left a
// single category stranded on its own row whenever the count didn't divide
// evenly — 7 categories did that at all three sizes (2, 3 and 6 columns),
// and on phones the grid ran taller than a whole screen. The count is set in
// the admin, so any fixed column count would break again for some number.
//
// Widths per breakpoint — the same as the homepage product rails
// (RAIL_CARD_WIDTH.large), so both rows show photos at one large size:
//   - phones 75%: one card and a clearly cut-off second at the screen edge,
//     so a swipe is the obvious next move;
//   - sm 45%, md 31% and lg 23%: the same peek, with two, three and four
//     cards visible; anything further sits behind the arrow.
const CARD_WIDTH = "w-[75%] flex-none snap-start sm:w-[45%] md:w-[31%] lg:w-[23%]";

// Below lg the track runs full-bleed, so the peeking card is cut off by the
// screen edge rather than by the page padding: the negative margin cancels
// container-shell's padding-inline (1.25rem, then 2rem from md) and the
// matching padding + scroll-padding keep the first card and every snapped
// card aligned with the heading above. At lg the row sits inside the
// container like the rest of the page, with the arrows on its edges.
const TRACK_BLEED = "-mx-5 px-5 scroll-px-5 md:-mx-8 md:px-8 md:scroll-px-8 lg:mx-0 lg:px-0 lg:scroll-px-0";

// Mirrors CARD_WIDTH, so the browser never downloads a larger image than the
// card displays.
const CARD_SIZES = "(min-width: 1024px) 23vw, (min-width: 768px) 31vw, (min-width: 640px) 45vw, 75vw";

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
              <Link key={cat.handle} href={`/${cat.handle}`} className={`group relative block ${CARD_WIDTH}`}>
                {imageUrl ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-md">
                    {/* Below the full-height Hero — waits for the first
                        screen (AfterPageLoad). */}
                    <AfterPageLoad placeholderClassName="absolute inset-0">
                      <Image
                        src={imageUrl}
                        alt={cat.name}
                        fill
                        sizes={CARD_SIZES}
                        className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                      />
                    </AfterPageLoad>
                    {/* The name sits on the photo's lower part, white on a
                        gradient (the header menu's promo tiles do the same)
                        so it reads clearly on any photo while the top of
                        the photo stays untouched. */}
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <PlaceholderTile
                    label={cat.name}
                    tone={TONES[i % TONES.length]}
                    className="transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                  />
                )}
                {/* No gradient behind the name on the patterned placeholder:
                    it is light and already legible in ink. */}
                <span
                  className={`absolute inset-x-0 bottom-0 p-3 text-sm font-semibold tracking-wide md:p-4 md:text-base ${
                    imageUrl ? "text-white" : "text-ink"
                  }`}
                >
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </HorizontalScroller>
      </div>
    </section>
  );
}
