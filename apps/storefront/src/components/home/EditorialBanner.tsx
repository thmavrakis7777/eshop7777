import Link from "next/link";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import type { HomepageSection } from "@/lib/content-types";

const DEFAULT_BLOCK: HomepageSection = {
  id: "default",
  kind: "promo",
  eyebrow: "Οδηγός Αγοράς",
  heading: "Πώς να διαλέξεις το σωστό αντικολλητικό τηγάνι",
  body: "Υλικό, μέγεθος, συμβατότητα με εστίες — ό,τι χρειάζεται να ξέρεις πριν αγοράσεις.",
  ctaLabel: "Διάβασε τον οδηγό",
  ctaHref: "/odigoi-agoron/tigania",
  imageUrl: null,
  mobileImageUrl: null,
  imageAlt: null,
  config: {},
};

function PromoSection({ block, imageFirst }: { block: HomepageSection; imageFirst: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <div
        className={`flex flex-col justify-center rounded-lg bg-surface p-8 md:p-12 ${
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
        {block.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, not part of the optimized product-image pipeline
          <img
            src={block.imageUrl}
            alt=""
            className="aspect-square w-full rounded-lg object-cover md:aspect-auto md:h-full"
          />
        ) : (
          <PlaceholderTile
            label={block.heading || "Διαφημιστική ενότητα"}
            tone="sage"
            className="aspect-square md:aspect-auto md:h-full"
          />
        )}
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

  return (
    <section className="container-shell mt-16 flex flex-col gap-10 md:mt-24 md:gap-16">
      {items.map((block, i) => (
        <PromoSection key={block.id} block={block} imageFirst={i % 2 === 0} />
      ))}
    </section>
  );
}
