import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/category/Breadcrumbs";
import { Pagination } from "@/components/category/Pagination";
import { JournalCategoryNav, JournalGrid, JournalHero } from "@/components/journal/JournalCard";
import { getFeaturedJournalArticle, getJournalArticles, getJournalCategories } from "@/lib/data/journal";
import { siteUrl } from "@/lib/site-config";

/**
 * /journal — the Journal landing page.
 *
 * A literal route folder, so it takes precedence over the catch-all
 * `[category]` segment that sits beside it in this route group; "journal" is
 * therefore a reserved top-level slug and a category could not shadow it.
 *
 * Inside the (storefront) group, so header, footer, announcement bar and
 * cart drawer come from the shared layout — the Journal is part of the shop,
 * not a separate site.
 */

const TITLE = "Journal — Ιδέες, Οδηγοί & Έμπνευση για το Σπίτι";
const DESCRIPTION =
  "Οδηγοί αγοράς, ιδέες οργάνωσης, συμβουλές για την κουζίνα, τον κήπο και το σπίτι — από την ομάδα του MAVRAKIS HOME.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/journal" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${siteUrl}/journal`,
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const featured = await getFeaturedJournalArticle();
  // The lead article is excluded from the grid on every page, not just the
  // first — otherwise page 2 would silently repeat it and the totals would
  // disagree with the number of cards actually shown.
  const [{ articles, total, perPage }, categories] = await Promise.all([
    getJournalArticles({ page, excludeSlug: featured?.slug }),
    getJournalCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const isFirstPage = page === 1;

  return (
    <>
      <Breadcrumbs items={[{ label: "Journal", href: "/journal" }]} />

      <div className="container-shell mt-6 md:mt-10">
        <header className="max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">JOURNAL</h1>
          <p className="mt-3 text-base text-ink-muted md:text-lg">
            Ιδέες, οδηγοί και έμπνευση για το σπίτι
          </p>
        </header>

        <div className="mt-8">
          <JournalCategoryNav categories={categories} />
        </div>

        {featured && isFirstPage && (
          <section aria-label="Επιλογή σύνταξης" className="mt-10 border-t border-border pt-10 md:mt-14 md:pt-14">
            <JournalHero article={featured} />
          </section>
        )}

        <section aria-label="Πρόσφατα άρθρα" className="mt-14 border-t border-border pt-10 md:mt-20 md:pt-14">
          {articles.length > 0 ? (
            <>
              <h2 className="mb-8 text-sm font-medium tracking-widest text-ink-muted uppercase">
                {isFirstPage ? "Πρόσφατα άρθρα" : `Άρθρα — σελίδα ${page}`}
              </h2>
              <JournalGrid articles={articles} />
            </>
          ) : (
            // Not an error state: a Journal with a single article is a normal
            // early state, and so is one whose only article is the lead above.
            <p className="text-sm text-ink-muted">
              {featured
                ? "Δεν υπάρχουν άλλα άρθρα προς το παρόν. Επιστρέψτε σύντομα."
                : "Το Journal ετοιμάζεται. Σύντομα θα βρείτε εδώ οδηγούς και ιδέες για το σπίτι."}
            </p>
          )}
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          buildHref={(p) => (p === 1 ? "/journal" : `/journal?page=${p}`)}
        />
      </div>

      <div className="h-16" />
    </>
  );
}
