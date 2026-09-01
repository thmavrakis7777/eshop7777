import Link from "next/link";
import type { HomepageSection } from "@/lib/content-types";
import { HeroCarousel } from "@/components/home/HeroCarousel";

const DIAGONAL_PATTERN = {
  backgroundImage:
    "linear-gradient(135deg, #e9d9cf 25%, transparent 25%), linear-gradient(315deg, #e9d9cf 25%, transparent 25%)",
  backgroundSize: "22px 22px",
  opacity: 0.6,
} as const;

const DEFAULT_HERO: HomepageSection = {
  id: "default",
  kind: "hero",
  eyebrow: "Νέα Συλλογή",
  heading: "Το σπίτι σου, αναβαθμισμένο.",
  body: "Ποιοτικά είδη κουζίνας, μπάνιου και οργάνωσης — σχεδιασμένα να διαρκούν χρόνια, όχι σεζόν.",
  ctaLabel: "Ανακάλυψε τη συλλογή",
  ctaHref: "/kouzina",
  imageUrl: null,
  mobileImageUrl: null,
  imageAlt: null,
  config: {},
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
// `asH1` is only true for the page's own first/only hero slide — a page
// must have exactly one real <h1>. HeroCarousel mounts every slide
// simultaneously (CSS scroll-snap, not a single-active-slide carousel), so
// slide 2+ renders its heading as a visually identical <p> instead, or the
// carousel would put a second (or third, or fourth) <h1> on the homepage
// the moment an admin publishes more than one slide.
export function HeroSlide({
  content,
  asH1 = true,
  storeName,
  isFirstSection = false,
}: {
  content: HomepageSection;
  asH1?: boolean;
  // Only ever rendered as the sr-only fallback <h1> when a slide has no
  // heading of its own — the page still needs exactly one real h1.
  storeName: string;
  // True only for the homepage's very first Hero group (see Hero() below) —
  // gives it the full-viewport-below-header treatment on mobile/tablet.
  // Any other Hero an admin adds further down the page keeps the plain
  // 26rem/32rem box, unaffected.
  isFirstSection?: boolean;
}) {
  const { eyebrow, heading, body, ctaLabel, ctaHref, imageUrl, mobileImageUrl, imageAlt } = content;
  const HeadingTag = asH1 ? "h1" : "p";
  // Optional by design: the same banner can be a plain image with no button.
  const showButton = content.config?.showButton !== false && Boolean(ctaLabel && ctaHref);
  // The full-screen first Hero puts tablets (768–1023px) in the same tall,
  // narrow box mobile gets, not the ~32rem box the desktop image was cropped
  // for — so a set mobile image should cover tablet too here, not hand off
  // to the wide desktop shot a whole breakpoint early.
  const mobileBreakpoint = isFirstSection ? "(min-width: 1024px)" : "(min-width: 768px)";

  return (
    <div
      className={`relative flex flex-col justify-end overflow-hidden bg-surface-strong p-8 md:p-14 ${
        isFirstSection ? "hero-viewport-fill lg:min-h-[32rem]" : "min-h-[26rem] md:min-h-[32rem]"
      }`}
    >
      {/* A real <img> rather than a CSS background-image: the latter is an
          inline `style="background-image:url(...)"` attribute, which a
          strict CSP without 'unsafe-inline' on style-src-elem blocks —
          confirmed live the moment a real image was first set here (never
          triggered before, since imageUrl was null on every production
          deploy until now). <picture>/<source> covers the art-directed
          two-image case; a plain <img> covers one image the same way. */}
      {imageUrl && !mobileImageUrl && (
        <img
          src={imageUrl}
          alt={imageAlt ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
      )}
      {imageUrl && mobileImageUrl && (
        <picture>
          <source media={mobileBreakpoint} srcSet={imageUrl} />
          <img
            src={mobileImageUrl}
            alt={imageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            // The hero is the LCP element — never lazy.
            fetchPriority="high"
          />
        </picture>
      )}
      {!imageUrl && <div className="pointer-events-none absolute inset-0" style={DIAGONAL_PATTERN} aria-hidden="true" />}
      <div className="relative max-w-xl">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">{eyebrow}</p>}
        {heading ? (
          <HeadingTag className="mt-3 text-4xl text-ink md:text-6xl">{heading}</HeadingTag>
        ) : (
          asH1 && <h1 className="sr-only">{storeName}</h1>
        )}
        {body && <p className="mt-4 max-w-md text-base text-ink-muted md:text-lg">{body}</p>}
        {showButton && (
          <Link
            href={ctaHref!}
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
export function Hero({
  slides,
  storeName,
  // Set by the two homepage call sites only when this Hero is literally the
  // page's first section — see HomepageSections.tsx and (storefront)/page.tsx.
  // A second Hero an admin adds further down the page never gets this, so it
  // keeps the original fixed-height box instead of also going full-screen.
  isFirstSection = false,
}: {
  slides: HomepageSection[];
  storeName: string;
  isFirstSection?: boolean;
}) {
  return (
    // Deliberately not container-shell: the hero is meant to run edge to
    // edge (no ancestor between here and <body> restricts width — see
    // (storefront)/layout.tsx — so simply not opting into the constraint
    // is the whole fix, no 100vw/negative-margin trick needed). The actual
    // heading/body/CTA inside HeroSlide keep their own max-w-xl, so text
    // never stretches just because the section now can.
    //
    // The first Hero drops its own top padding below lg so the full-screen
    // box sits flush under the sticky header (see hero-viewport-fill in
    // globals.css, which already accounts for --header-height) — lg+ keeps
    // the original pt-10 breathing room the desktop box has always had.
    <section className={isFirstSection ? "lg:pt-10" : "pt-6 md:pt-10"}>
      {slides.length >= 2 ? (
        <HeroCarousel slides={slides} storeName={storeName} isFirstSection={isFirstSection} />
      ) : (
        <HeroSlide content={slides[0] ?? DEFAULT_HERO} storeName={storeName} isFirstSection={isFirstSection} />
      )}
    </section>
  );
}
