import Link from "next/link";
import { DeviceImage } from "@/components/home/DeviceImage";
import { publicImageUrl } from "@/lib/storage/urls";
import type { HomepageSection, PromoBanner2Config } from "@/lib/content-types";

const DEFAULT_BLOCK: HomepageSection = {
  id: "default",
  kind: "promo",
  eyebrow: "Οδηγός Αγοράς",
  heading: "Πώς να διαλέξεις το σωστό αντικολλητικό τηγάνι",
  body: "Υλικό, μέγεθος, συμβατότητα με εστίες — ό,τι χρειάζεται να ξέρεις πριν αγοράσεις.",
  ctaLabel: "Διάβασε τον οδηγό",
  ctaHref: "/odigoi-agoron/tigania",
  imageUrl: null,
  tabletImageUrl: null,
  mobileImageUrl: null,
  imageAlt: null,
  config: {},
};

// True only once the owner has actually put something into Banner 2 — an
// absent/all-empty banner2 must render exactly like a promo block saved
// before Banner 2 existed (see parseConfig in cms-actions.ts, which only
// ever writes `config.banner2` under this same condition).
function hasBanner2Content(banner2: PromoBanner2Config | undefined): banner2 is PromoBanner2Config {
  if (!banner2) return false;
  return Boolean(
    banner2.desktopImagePath || banner2.tabletImagePath || banner2.mobileImagePath ||
      banner2.heading || banner2.body || banner2.ctaLabel || banner2.ctaHref
  );
}

/**
 * One banner's worth of content for the two-banner (side-by-side/stacked)
 * layout — image on top, copy below. Deliberately a different shape from
 * the single-banner layout's half-text/half-image split below: two of the
 * latter side by side would leave each banner's own text too cramped, so a
 * stacked card is the two-banner design instead of two half-width copies of
 * the existing single-banner layout.
 */
function PromoBannerCard({
  heading,
  body,
  ctaLabel,
  ctaHref,
  desktopUrl,
  tabletUrl,
  mobileUrl,
  imageAlt,
}: {
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  desktopUrl: string | null;
  tabletUrl: string | null;
  mobileUrl: string | null;
  imageAlt: string | null;
}) {
  // Both text and URL are required for the CTA — a label with no
  // destination (or vice versa) is not a usable link, so neither renders.
  const showCta = Boolean(ctaLabel && ctaHref);
  const hasCopy = Boolean(heading || body || showCta);

  return (
    <div className="flex flex-col overflow-hidden rounded-md bg-surface">
      <DeviceImage
        desktopUrl={desktopUrl}
        tabletUrl={tabletUrl}
        mobileUrl={mobileUrl}
        alt={imageAlt ?? ""}
        placeholderLabel={heading || "Banner"}
        className="aspect-[4/3] w-full object-cover"
      />
      {hasCopy && (
        <div className="flex flex-col gap-2 p-6">
          {heading && <h3 className="text-xl text-ink md:text-2xl">{heading}</h3>}
          {body && <p className="text-sm text-ink-muted">{body}</p>}
          {showCta && (
            <Link href={ctaHref!} className="mt-2 w-fit text-sm font-medium text-ink underline underline-offset-4">
              {ctaLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function PromoSection({ block, imageFirst }: { block: HomepageSection; imageFirst: boolean }) {
  const banner2 = hasBanner2Content(block.config.banner2) ? block.config.banner2 : null;

  // Two independently-configured banners, side by side on desktop/tablet
  // and stacked on mobile — only once Banner 2 actually has content.
  if (banner2) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <PromoBannerCard
          heading={block.heading}
          body={block.body}
          ctaLabel={block.ctaLabel}
          ctaHref={block.ctaHref}
          desktopUrl={block.imageUrl}
          tabletUrl={block.tabletImageUrl}
          mobileUrl={block.mobileImageUrl}
          imageAlt={block.imageAlt}
        />
        <PromoBannerCard
          heading={banner2.heading}
          body={banner2.body}
          ctaLabel={banner2.ctaLabel}
          ctaHref={banner2.ctaHref}
          desktopUrl={publicImageUrl(banner2.desktopImagePath)}
          tabletUrl={publicImageUrl(banner2.tabletImagePath)}
          mobileUrl={publicImageUrl(banner2.mobileImagePath)}
          imageAlt={banner2.imageAlt}
        />
      </div>
    );
  }

  // The original single-banner layout — unchanged for every block that
  // predates Banner 2 (or simply never uses it): half-width copy panel,
  // half-width image, alternating side. Now goes through DeviceImage
  // instead of a plain <img src={imageUrl}>, so the mobile/tablet image
  // fields (already present in the admin form) actually take effect —
  // previously mobileImageUrl was silently ignored here.
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <div
        className={`flex flex-col justify-center bg-surface p-8 md:p-12 ${
          imageFirst ? "order-2 md:order-1" : "order-2"
        }`}
      >
        {block.eyebrow && <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">{block.eyebrow}</p>}
        {block.heading && <h2 className="mt-3 text-2xl text-ink md:text-3xl">{block.heading}</h2>}
        {block.body && <p className="mt-3 text-sm text-ink-muted md:text-base">{block.body}</p>}
        {block.ctaLabel && block.ctaHref && (
          <Link href={block.ctaHref} className="mt-6 text-sm font-medium text-ink underline underline-offset-4">
            {block.ctaLabel}
          </Link>
        )}
      </div>
      <div className={imageFirst ? "order-1 md:order-2" : "order-1"}>
        <DeviceImage
          desktopUrl={block.imageUrl}
          tabletUrl={block.tabletImageUrl}
          mobileUrl={block.mobileImageUrl}
          alt={block.imageAlt ?? ""}
          placeholderLabel={block.heading || "Διαφημιστική ενότητα"}
          className="aspect-square w-full object-cover md:aspect-auto md:h-full"
        />
      </div>
    </div>
  );
}

// Admin-editable via the Homepage admin route (Admin-first platform,
// Phase E) — zero published blocks falls back to the store's original
// promo copy, one or more render in sort_order, alternating image side
// for visual rhythm when there's more than one.
export function EditorialBanner({ blocks }: { blocks: HomepageSection[] }) {
  const items = blocks.length > 0 ? blocks : [DEFAULT_BLOCK];

  // Not container-shell — same reasoning as Hero: nothing between here and
  // <body> constrains width, so the promo banner already runs edge to edge
  // without it. The text half keeps its own p-8/p-12 padding either way.
  return (
    <section className="mt-16 flex flex-col gap-10 md:mt-24 md:gap-16">
      {items.map((block, i) => (
        <PromoSection key={block.id} block={block} imageFirst={i % 2 === 0} />
      ))}
    </section>
  );
}
