import Link from "next/link";
import type { HomepageBlock } from "@/lib/data/homepage-blocks";
import { HeroCarousel } from "@/components/home/HeroCarousel";

const DIAGONAL_PATTERN = {
  backgroundImage:
    "linear-gradient(135deg, #e9d9cf 25%, transparent 25%), linear-gradient(315deg, #e9d9cf 25%, transparent 25%)",
  backgroundSize: "22px 22px",
  opacity: 0.6,
} as const;

const DEFAULT_HERO: HomepageBlock = {
  id: "default",
  eyebrow: "Νέα Συλλογή",
  heading: "Το σπίτι σου, αναβαθμισμένο.",
  body: "Ποιοτικά είδη κουζίνας, μπάνιου και οργάνωσης — σχεδιασμένα να διαρκούν χρόνια, όχι σεζόν.",
  ctaLabel: "Ανακάλυψε τη συλλογή",
  ctaHref: "/kouzina",
  imageUrl: null,
};

// content is always a real, whole object — either the store's own default
// (DEFAULT_HERO, used when there are zero admin-published slides) or a
// real admin slide. Never mix fields from the two: a real slide that
// leaves one field blank must render that piece as absent, not silently
// substitute the *other* slide's/default's text — that was a real bug
// caught live in verification (a second slide's blank eyebrow rendered
// the default "Νέα Συλλογή" instead of nothing, via a per-field `??`
// fallback that made sense for "no admin content exists at all" but not
// for "this one real field is blank"). Same whole-object-fallback pattern
// as EditorialBanner's DEFAULT_BLOCK.
export function HeroSlide({ content }: { content: HomepageBlock }) {
  const { eyebrow, heading, body, ctaLabel, ctaHref, imageUrl } = content;

  return (
    <div
      className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-lg bg-surface-strong bg-cover bg-center p-8 md:min-h-[32rem] md:p-14"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {!imageUrl && <div className="pointer-events-none absolute inset-0" style={DIAGONAL_PATTERN} aria-hidden="true" />}
      <div className="relative max-w-xl">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">{eyebrow}</p>}
        {heading && <h1 className="mt-3 text-4xl text-ink md:text-6xl">{heading}</h1>}
        {body && <p className="mt-4 max-w-md text-base text-ink-muted md:text-lg">{body}</p>}
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="mt-8 inline-flex items-center rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// Admin-editable via the Homepage admin route (Admin-first platform,
// Phase E) — zero published slides falls back to the store's own default
// copy, one slide renders statically, two or more become a swipeable
// carousel (see HeroCarousel).
export function Hero({ slides }: { slides: HomepageBlock[] }) {
  return (
    <section className="container-shell pt-6 md:pt-10">
      {slides.length >= 2 ? <HeroCarousel slides={slides} /> : <HeroSlide content={slides[0] ?? DEFAULT_HERO} />}
    </section>
  );
}
