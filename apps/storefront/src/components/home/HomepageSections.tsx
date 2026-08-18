import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { ProductRailSkeleton } from "@/components/home/ProductRailSkeleton";
import { EditorialBanner } from "@/components/home/EditorialBanner";
import { ContentSection } from "@/components/home/ContentSection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Newsletter } from "@/components/home/Newsletter";
import { resolveRailProducts } from "@/lib/data/homepage-sections";
import type { HomepageSection } from "@/lib/content-types";
import type { NavCategory } from "@/lib/types";

/**
 * Renders one homepage section group.
 *
 * The homepage is a list of owner-arranged sections now, so this is the one
 * place that maps a stored `kind` onto real UI. Adding a section type means
 * a case here and a case in the admin form — nothing else.
 *
 * Sections that resolve to nothing render nothing: a rail whose category was
 * deleted, or a category grid whose picked categories no longer exist, must
 * leave no empty heading behind. That check lives in each leaf component so
 * the rule can't be forgotten at a call site.
 */

// Each rail resolves its own products inside its own Suspense boundary, so a
// slow rail streams in independently instead of gating the whole page.
async function RailSection({ section }: { section: HomepageSection }) {
  const products = await resolveRailProducts(section.config.source);
  if (products.length === 0) return null;
  return (
    <ProductRail
      title={section.heading ?? ""}
      viewAllHref={section.config.viewAllHref ?? undefined}
      products={products}
    />
  );
}

function pickCategories(all: NavCategory[], slugs: string[] | undefined): NavCategory[] {
  // No explicit picks = every top-level category in nav order, which is what
  // the hardcoded grid did before this was configurable.
  if (!slugs?.length) return all;
  // Ordered by the owner's arrangement, not nav order — and silently skips a
  // category that has since been deleted or deactivated.
  return slugs.flatMap((slug) => all.find((c) => c.handle === slug) ?? []);
}

export function HomepageSectionGroup({
  group,
  categories,
  storeName,
}: {
  group: HomepageSection[];
  categories: NavCategory[];
  storeName: string;
}) {
  const first = group[0];

  switch (first.kind) {
    // Consecutive heroes arrive here as one group and become a carousel —
    // see groupSections() in lib/data/homepage-sections.ts.
    case "hero":
      return <Hero slides={group} storeName={storeName} />;

    case "promo":
      return <EditorialBanner blocks={group} />;

    case "category_grid":
      return (
        <CategoryGrid
          categories={pickCategories(categories, first.config.categorySlugs)}
          heading={first.heading ?? undefined}
        />
      );

    case "product_rail":
      return (
        <Suspense fallback={<ProductRailSkeleton title={first.heading ?? ""} />}>
          <RailSection section={first} />
        </Suspense>
      );

    case "content":
      return <ContentSection section={first} />;

    // Content for these two is CMS-editable, with no migration needed: the
    // guarantee tiles live in the section's existing `config` jsonb and the
    // newsletter reuses its own eyebrow/heading/body/cta columns.
    case "trust":
      return <TrustStrip section={first} />;

    case "newsletter":
      return <Newsletter section={first} />;
  }
}
