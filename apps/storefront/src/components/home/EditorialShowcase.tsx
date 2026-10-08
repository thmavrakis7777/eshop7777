import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  GALLERY_PRODUCT_COUNT,
  SHOWCASE_PRODUCT_COUNT,
  SPREAD_PRODUCT_COUNT,
  type HomepageSection,
  type ShowcaseConfig,
} from "@/lib/content-types";
import type { ShowcaseData } from "@/lib/data/homepage-sections";
import type { Product } from "@/lib/types";
import { formatPrice, formatPriceFrom } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage/urls";
import { AfterPageLoad } from "@/components/ui/AfterPageLoad";
import { AvifSource } from "@/components/ui/AvifSource";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { ShowcaseAddButton } from "@/components/home/ShowcaseAddButton";

/**
 * Editorial Showcase — the homepage's editorial section: an asymmetric
 * composition of a heading, generous whitespace, large imagery and real
 * products from a source the owner picks (category, collection, sale, new
 * arrivals, best sellers or hand-picked). Any number of them can sit on the
 * homepage, each with its own source and layout:
 *
 *   - "spread"  (default): a large image on one side (owner's choice), the
 *     heading and a list of products on the other, plus one product laid
 *     over the image's corner on desktop.
 *   - "gallery": the products themselves as large photos — one large, two
 *     smaller at staggered heights — on white or the warm surface tone.
 *   - "both": the spread, then the gallery straight under it as one
 *     section — one heading, the gallery continuing with the next products.
 *
 * Both share one vocabulary so several showcases read as one family: the
 * numbered rule above the heading, the display-serif heading, hairline
 * dividers, the underlined text link with an arrow, the quiet round "+"
 * and the sale-price treatment. No cards, boxes or carousel.
 *
 * Performance: a Server Component — the only JavaScript is the add-to-cart
 * button (ShowcaseAddButton). Every image sits in a box with fixed aspect
 * ratio or size, so nothing moves as photos arrive, and waits for the first
 * screen to finish loading (AfterPageLoad) unless this showcase opens the
 * page. The large «Spread» image is the owner's upload served as stored
 * (WebP + AVIF from the upload pipeline) through a plain <picture> — no
 * image-optimizer usage, the same choice as the Hero and promo banners
 * (HOMEPAGE_IMAGES_SPEC.md §0). Product photos go through next/image exactly
 * as they already do in every product card.
 *
 * SEO: everything is server HTML — a real <h2>, product names and prices as
 * text, alt text, and plain links to the products and the source's listing.
 */

const productHref = (p: Product) => `/proionta/${p.handle}`;

// A photo below the full-height opening Hero waits for the first screen
// (AfterPageLoad) — unless this showcase is the first section, where its
// photos are the first screen.
function Deferred({ eager, children }: { eager: boolean; children: ReactNode }) {
  return eager ? <>{children}</> : <AfterPageLoad placeholderClassName="absolute inset-0">{children}</AfterPageLoad>;
}

function ProductPhoto({
  product,
  alt,
  sizes,
  eager,
  className,
  zoom = false,
}: {
  product: Product;
  alt: string;
  sizes: string;
  eager: boolean;
  // The box: its size or aspect ratio, corners, border.
  className: string;
  // ProductCard's gentle hover zoom, on the large gallery photos.
  zoom?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {product.imageUrl ? (
        <Deferred eager={eager}>
          <Image
            src={product.imageUrl}
            alt={alt}
            fill
            sizes={sizes}
            className={
              zoom
                ? "object-cover [transition:scale_700ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-safe:group-hover:scale-[1.04]"
                : "object-cover"
            }
          />
        </Deferred>
      ) : (
        <PlaceholderTile label={product.title} tone={product.placeholderTone} className="absolute inset-0 h-full rounded-none" />
      )}
    </div>
  );
}

/**
 * "inline": price and the struck-through price side by side.
 * "stacked": one above the other, left-aligned (narrow captions).
 * "list": inline on phones, stacked and right-aligned on desktop, where the
 *   price is its own column in the Spread list.
 */
function Price({ product, variant, className = "" }: { product: Product; variant: "inline" | "stacked" | "list"; className?: string }) {
  if (product.priceRange) {
    return <span className={`whitespace-nowrap font-semibold tabular-nums text-ink ${className}`}>{formatPriceFrom(product.priceRange.min)}</span>;
  }
  if (!product.compareAtPrice) {
    return <span className={`whitespace-nowrap font-semibold tabular-nums text-ink ${className}`}>{formatPrice(product.price)}</span>;
  }
  const layout =
    variant === "inline"
      ? "items-baseline gap-2"
      : variant === "stacked"
        ? "flex-col items-start gap-0.5"
        : "items-baseline gap-2 lg:flex-col lg:items-end lg:gap-0.5";
  return (
    <span className={`flex whitespace-nowrap tabular-nums ${layout} ${className}`}>
      <span className="font-semibold text-accent">
        <span className="sr-only">Τιμή προσφοράς: </span>
        {formatPrice(product.price)}
      </span>
      <s className="text-xs text-ink-muted">
        <span className="sr-only">Αρχική τιμή: </span>
        {formatPrice(product.compareAtPrice)}
      </s>
    </span>
  );
}

// The round "+" for a product that can be quick-added; a round arrow to the
// product page when it has options to choose; a plain note when sold out.
const ROUND_ACTION =
  "flex size-11 flex-none items-center justify-center rounded-full border border-ink/15 text-ink transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-white";

function ProductAction({ product }: { product: Product }) {
  if (!product.isAvailable) {
    return <span className="flex-none text-xs text-ink-muted">Εξαντλήθηκε</span>;
  }
  if (product.variants.length !== 1) {
    return (
      <Link href={productHref(product)} aria-label={`Επιλογές: ${product.title}`} className={ROUND_ACTION}>
        <ArrowRightIcon className="size-4" />
      </Link>
    );
  }
  return (
    <ShowcaseAddButton product={{ title: product.title, isAvailable: product.isAvailable, variants: product.variants }} />
  );
}

function ShowcaseHeader({
  headingId,
  number,
  eyebrow,
  heading,
  body,
}: {
  headingId: string;
  number: number;
  eyebrow: string | null;
  heading: string;
  body: string | null;
}) {
  return (
    <>
      <div className="flex items-center gap-3 lg:gap-4">
        {/* The showcase's place among the page's showcases — decoration,
            so not read out. */}
        <span aria-hidden="true" className="font-display text-sm tabular-nums text-ink lg:text-[15px]">
          {String(number).padStart(2, "0")}
        </span>
        <span aria-hidden="true" className="h-px w-8 bg-ink lg:w-12" />
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-accent lg:text-xs">{eyebrow}</p>
        )}
      </div>
      <h2
        id={headingId}
        className="mt-5 text-[clamp(2.25rem,1.4rem+3vw,4rem)] leading-[1.05] tracking-[-0.02em] text-ink lg:mt-7"
      >
        {heading}
      </h2>
      {body && (
        <p className="mt-4 max-w-[27rem] whitespace-pre-line text-base leading-relaxed text-ink-muted lg:mt-6 lg:text-[17px]">
          {body}
        </p>
      )}
    </>
  );
}

function ShowcaseCta({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2.5 text-[15px] font-medium text-ink underline decoration-1 underline-offset-[7px] transition-colors hover:text-accent ${className}`}
    >
      {label}
      <ArrowRightIcon className="size-[18px]" />
    </Link>
  );
}

const DEFAULT_CTA_LABEL: Record<ShowcaseConfig["source"]["type"], string> = {
  category: "Δείτε όλα",
  collection: "Δείτε όλα",
  sale: "Όλες οι προσφορές",
  newest: "Όλες οι νέες αφίξεις",
  best_sellers: "Δείτε περισσότερα",
  manual: "Δείτε περισσότερα",
};

/**
 * The link under the copy. The owner's own label and destination win; left
 * blank, it goes to the source's listing page (none for best sellers and
 * hand-picked, so no link at all unless the owner sets one). For a category
 * or collection with more products than the section shows, the default
 * label carries the real total — "Δείτε και τα 9 προϊόντα" — never a
 * guessed one, and only when the link really goes to that listing.
 */
function resolveCta(section: HomepageSection, config: ShowcaseConfig, data: ShowcaseData, shown: number) {
  if (section.config.showButton === false) return null;
  const href = section.ctaHref || data.href;
  if (!href) return null;
  if (section.ctaLabel) return { href, label: section.ctaLabel };
  const isListing = config.source.type === "category" || config.source.type === "collection";
  if (!section.ctaHref && isListing && data.total != null && data.total > shown) {
    return { href, label: `Δείτε και τα ${data.total} προϊόντα` };
  }
  return { href, label: DEFAULT_CTA_LABEL[config.source.type] };
}

function defaultEyebrow(type: ShowcaseConfig["source"]["type"], label: string | null): string | null {
  if (!label) return null;
  if (type === "category") return `Κατηγορία · ${label}`;
  if (type === "collection") return `Συλλογή · ${label}`;
  return label;
}

type LayoutProps = {
  section: HomepageSection;
  config: ShowcaseConfig;
  data: ShowcaseData;
  products: Product[];
  headingId: string;
  header: ReactNode;
  cta: { href: string; label: string } | null;
  eager: boolean;
  // "both": this part sits inside the showcase's one <section> (see
  // EditorialShowcase), so it renders a plain block, not a landmark of its
  // own. The gallery part also drops its heading and link — the spread above
  // carries them — and sits closer, so the two read as one composition.
  embedded?: boolean;
};

// ---------------------------------------------------------------------------
// A · Spread
// ---------------------------------------------------------------------------

function SpreadLayout({ section, config, data, products, headingId, header, cta, eager, embedded = false }: LayoutProps) {
  const imageRight = config.imageSide === "right";
  const Wrapper = embedded ? "div" : "section";

  // The large image: the owner's upload; else the category's or
  // collection's own image; else the first product's photo — never empty.
  const ownImage = section.imageUrl ?? publicImageUrl(data.imagePath);
  const mobileImage = section.imageUrl ? (section.mobileImageUrl ?? section.imageUrl) : ownImage;
  const lead = ownImage ? null : products[0];

  // With a real image, the first product sits over its corner on desktop
  // (and heads the list on phones, where there's no corner to sit on);
  // with a product photo as the image, that product is captioned under it
  // instead, and the list is the rest.
  const inset = ownImage && products.length >= 2 ? products[0] : null;
  const listed = lead ? products.slice(1) : products;
  const rowVisibility = (i: number) => {
    if (!inset) return "flex";
    if (i === 0) return "flex lg:hidden"; // shown as the inset on desktop
    if (i === 4) return "hidden lg:flex"; // phones list four, like desktop
    return "flex";
  };

  const imageHref = section.ctaHref || data.href;

  const visualBox =
    "relative -mx-5 aspect-[4/5] overflow-hidden bg-surface md:mx-0 md:aspect-[3/2] md:rounded-sm lg:aspect-[4/5]";

  return (
    <Wrapper aria-labelledby={embedded ? undefined : headingId} className="container-shell mt-16 md:mt-24">
      <div
        className={`flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-0 ${
          imageRight ? "lg:flex-row-reverse" : ""
        }`}
      >
        {/* 49% / 40.7% of the row = six and five columns of a 12-column
            grid, with the ~10% between them the gutter the corner product
            hangs into. Room is kept below for that product's caption. */}
        <div className={`lg:w-[49%] lg:flex-none ${inset ? "lg:pb-24" : ""}`}>
          <div className="relative">
            {ownImage ? (
              <MaybeLink href={imageHref} className={`block ${visualBox}`}>
                <Deferred eager={eager}>
                  <picture>
                    <AvifSource media="(min-width: 768px)" src={ownImage} />
                    <source media="(min-width: 768px)" srcSet={ownImage} />
                    <AvifSource src={mobileImage} />
                    <img
                      src={mobileImage ?? ownImage}
                      alt={section.imageAlt ?? (section.imageUrl ? "" : (data.label ?? ""))}
                      className="absolute inset-0 h-full w-full object-cover"
                      {...(eager ? { fetchPriority: "high" as const } : { loading: "lazy" as const, decoding: "async" as const })}
                    />
                  </picture>
                </Deferred>
              </MaybeLink>
            ) : (
              lead && (
                <Link href={productHref(lead)} tabIndex={-1} aria-hidden="true" className="group block">
                  <ProductPhoto
                    product={lead}
                    alt={lead.title}
                    sizes="(min-width: 1440px) 676px, (min-width: 1024px) 49vw, 100vw"
                    eager={eager}
                    zoom
                    className={visualBox}
                  />
                </Link>
              )
            )}

            {inset && (
              // Hangs off the image's inner edge into the gutter: top-full
              // plus a negative margin of its own height (35.5% of the
              // column — margins resolve against width) less 24 px, so it
              // ends 24 px below the image. Desktop only.
              <figure
                className={`absolute top-full z-10 mt-[calc(-35.5%_+_24px)] hidden w-[35.5%] lg:block ${
                  imageRight ? "-left-[20.7%]" : "-right-[20.7%]"
                }`}
              >
                <Link href={productHref(inset)} tabIndex={-1} aria-hidden="true" className="block">
                  <ProductPhoto
                    product={inset}
                    alt={inset.title}
                    sizes="(min-width: 1440px) 240px, 17vw"
                    eager={eager}
                    className="aspect-square rounded-md border-[10px] border-bg"
                  />
                </Link>
                <figcaption className="mt-3 flex items-start justify-between gap-3 pl-2.5">
                  <div className="flex min-w-0 flex-col gap-1 text-[13px]">
                    <Link href={productHref(inset)} className="font-medium leading-snug text-ink underline-offset-2 hover:underline">
                      {inset.title}
                    </Link>
                    <Price product={inset} variant="inline" />
                  </div>
                  <ProductAction product={inset} />
                </figcaption>
              </figure>
            )}
          </div>

          {lead && <LeadCaption product={lead} number={null} />}
        </div>

        <div className="lg:w-[40.7%] lg:flex-none lg:pt-6">
          {header}

          {listed.length > 0 && (
            <ul className="mt-8 border-t border-border lg:mt-12">
              {listed.map((p, i) => (
                <li
                  key={p.id}
                  className={`items-center gap-4 border-b border-border py-3.5 lg:gap-5 lg:py-4 ${rowVisibility(i)}`}
                >
                  <Link href={productHref(p)} className="group flex min-w-0 flex-1 items-center gap-4 lg:gap-5">
                    {/* alt="" — the link's own text already names it. */}
                    <ProductPhoto
                      product={p}
                      alt=""
                      sizes="72px"
                      eager={eager}
                      className="size-16 flex-none rounded-sm lg:size-[72px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
                      <span className="text-sm font-medium leading-snug text-ink underline-offset-2 group-hover:underline lg:text-[15px]">
                        {p.title}
                      </span>
                      <Price product={p} variant="list" className="text-sm lg:text-[15px]" />
                    </span>
                  </Link>
                  <ProductAction product={p} />
                </li>
              ))}
            </ul>
          )}

          {cta && <ShowcaseCta href={cta.href} label={cta.label} className="mt-7 lg:mt-8" />}
        </div>
      </div>
    </Wrapper>
  );
}

// An image that links somewhere only when there is somewhere to link —
// aria-hidden and out of the tab order, since the heading's link and the
// CTA already carry the same destination as text.
function MaybeLink({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} tabIndex={-1} aria-hidden="true" className={className}>
      {children}
    </Link>
  );
}

// The caption under a large product photo: number, name, price, action.
function LeadCaption({ product, number }: { product: Product; number: string | null }) {
  return (
    <div className="mt-4 flex items-start justify-between gap-6 lg:mt-5">
      <div className="flex min-w-0 gap-3 lg:gap-4">
        {number && (
          <span aria-hidden="true" className="pt-0.5 font-display text-sm tabular-nums text-ink-muted lg:text-[15px]">
            {number}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1.5 lg:gap-2">
          <Link
            href={productHref(product)}
            className="text-[15px] font-medium leading-snug text-ink underline-offset-2 hover:underline lg:text-[17px]"
          >
            {product.title}
          </Link>
          <Price product={product} variant="inline" className="text-[15px] lg:text-base" />
        </div>
      </div>
      <ProductAction product={product} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · Gallery
// ---------------------------------------------------------------------------

function GalleryLayout({ config, products, headingId, header, cta, eager, embedded = false }: LayoutProps) {
  const [lead, ...rest] = products;
  const warm = config.tone === "warm";
  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper
      aria-labelledby={embedded ? undefined : headingId}
      className={`${embedded ? "mt-12 md:mt-16" : "mt-16 md:mt-24"} ${warm ? "bg-surface py-16 md:py-24" : ""}`}
    >
      {/* Phones: copy, the large product, the pair, then the link. Desktop:
          the large product spans the left six columns; copy, link and the
          staggered pair stack in the right five, the pair taking whatever
          height is left (grid-rows auto/auto/1fr). */}
      <div className="container-shell grid grid-cols-1 gap-y-8 lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:gap-x-6 lg:gap-y-0">
        {header && <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">{header}</div>}

        <figure className="lg:col-span-6 lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <Link href={productHref(lead)} tabIndex={-1} aria-hidden="true" className="group block">
            <ProductPhoto
              product={lead}
              alt={lead.title}
              sizes="(min-width: 1440px) 676px, (min-width: 1024px) 47vw, 100vw"
              eager={eager}
              zoom
              className="aspect-[4/5] rounded-sm md:aspect-[4/3] lg:aspect-[4/5]"
            />
          </Link>
          <figcaption>
            <LeadCaption product={lead} number="01" />
          </figcaption>
        </figure>

        {cta && (
          <div className="order-last lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:mt-7">
            <ShowcaseCta href={cta.href} label={cta.label} />
          </div>
        )}

        {rest.length > 0 && (
          <div className="grid grid-cols-2 items-start gap-4 lg:col-span-5 lg:col-start-8 lg:row-start-3 lg:mt-[4.5rem] lg:gap-6">
            {rest.map((p, i) => (
              <figure key={p.id} className={i === 1 ? "mt-12 lg:mt-24" : ""}>
                <Link href={productHref(p)} tabIndex={-1} aria-hidden="true" className="group block">
                  <ProductPhoto
                    product={p}
                    alt={p.title}
                    sizes="(min-width: 1440px) 268px, (min-width: 1024px) 19vw, 46vw"
                    eager={eager}
                    zoom
                    className="aspect-[4/5] rounded-sm"
                  />
                </Link>
                <figcaption className="mt-3 flex gap-2.5 lg:mt-4 lg:gap-3">
                  <span aria-hidden="true" className="pt-px font-display text-[13px] tabular-nums text-ink-muted lg:text-sm">
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Link
                      href={productHref(p)}
                      className="text-[13px] font-medium leading-snug text-ink underline-offset-2 hover:underline lg:text-sm"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <Price product={p} variant="stacked" className="text-sm" />
                      <ProductAction product={p} />
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------

export function EditorialShowcase({
  section,
  data,
  number,
  eager = false,
}: {
  section: HomepageSection;
  data: ShowcaseData;
  // This showcase's place among the page's showcases, for the numbered rule.
  number: number;
  // True only when this showcase is the first section on the page.
  eager?: boolean;
}) {
  const config = section.config.showcase;
  // Nothing to show renders nothing — same rule as an empty rail: a
  // category emptied or deleted later leaves no stray heading behind.
  if (!config) return null;
  const products = data.products.slice(0, SHOWCASE_PRODUCT_COUNT[config.layout]);
  if (products.length === 0) return null;

  // The owner always sets a heading (saving refuses without one); a row
  // edited by hand falls back to the source's name rather than an
  // untitled section.
  const heading = section.heading ?? data.label;
  if (!heading) return null;

  const headingId = `showcase-${section.id}`;
  const cta = resolveCta(section, config, data, products.length);
  const header = (
    <ShowcaseHeader
      headingId={headingId}
      number={number}
      eyebrow={section.eyebrow ?? defaultEyebrow(config.source.type, data.label)}
      heading={heading}
      body={section.body}
    />
  );

  const props: LayoutProps = { section, config, data, products, headingId, header, cta, eager };
  if (config.layout === "gallery") return <GalleryLayout {...props} />;
  if (config.layout === "spread") return <SpreadLayout {...props} />;

  // "both": the spread takes the first products, the gallery the next ones.
  // A source too small to reach the gallery shows the spread alone rather
  // than repeating products or leaving an empty band.
  const spreadProducts = products.slice(0, SPREAD_PRODUCT_COUNT);
  const galleryProducts = products.slice(SPREAD_PRODUCT_COUNT, SPREAD_PRODUCT_COUNT + GALLERY_PRODUCT_COUNT);
  return (
    <section aria-labelledby={headingId}>
      <SpreadLayout {...props} products={spreadProducts} embedded />
      {galleryProducts.length > 0 && (
        <GalleryLayout {...props} products={galleryProducts} header={null} cta={null} embedded />
      )}
    </section>
  );
}
