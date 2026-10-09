// Card widths for ProductRail and its Suspense skeleton, kept in one plain
// module because ProductRail is a client component: a server component
// importing a constant from a "use client" file gets a client reference, not
// the string.
//
//   - default: product page, cart and Recently Viewed rails — two cards and a
//     peek on phones, five and a peek on desktop.
//   - large: the homepage rails — bigger photos to sell from, the way large
//     fashion stores show theirs: one card and a peek on phones, four and a
//     peek on desktop. Phones get 3/4 of the screen, not less, because a
//     card at least 240px wide (75% of a 360px phone's content width) fits
//     every current title in two lines; narrower, the longest title wraps to
//     three and, since a rail lines its cards up as one row, leaves a blank
//     line under every other title.
export type RailCardSize = "default" | "large";

export const RAIL_CARD_WIDTH: Record<RailCardSize, string> = {
  default: "w-[45%] sm:w-[31%] md:w-[23%] lg:w-[18.5%]",
  large: "w-[75%] sm:w-[45%] md:w-[31%] lg:w-[23%]",
};

// Mirrors RAIL_CARD_WIDTH, the same way ProductCard's own default `sizes`
// mirrors its 2/3/4-column grid fractions — not a guess. A rail card is
// narrower than a grid column at every breakpoint, so requesting the grid's
// sizes here would fetch a larger image than the rail ever displays.
export const RAIL_CARD_SIZES: Record<RailCardSize, string> = {
  default: "(min-width: 1024px) 18.5vw, (min-width: 768px) 23vw, (min-width: 640px) 31vw, 45vw",
  large: "(min-width: 1024px) 23vw, (min-width: 768px) 31vw, (min-width: 640px) 45vw, 75vw",
};
