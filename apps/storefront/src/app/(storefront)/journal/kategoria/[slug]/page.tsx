import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/category/Breadcrumbs";
import { Pagination } from "@/components/category/Pagination";
import { JournalCategoryNav, JournalGrid } from "@/components/journal/JournalCard";
import { getJournalArticles, getJournalCategories, getJournalCategoryBySlug } from "@/lib/data/journal";
import { siteUrl } from "@/lib/site-config";

/**
 * /journal/kategoria/[slug] — one Journal category.
 *
 * A real route rather than a `?category=` filter, deliberately: this repo's
 * established convention is that anything worth a sitemap entry is worth a
 * URL (see how three-level product categories and collection pages are
 * routed), and a topic page like "Οδηγοί Αγοράς" is exactly the kind of
 * page a search engine should be able to rank on its own.
 *
 * The literal `kategoria` segment sits beside `[slug]`, so it wins the match
 * — "kategoria" is therefore a reserved article slug, enforced in
 * lib/admin/journal.ts.
 */

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getJournalCategoryBySlug(slug);
  if (!category) return {};

  const title = `${category.name} — Journal`;
  const description =
    category.description ||
    `Άρθρα, οδηγοί και ιδέες για ${category.name.toLowerCase()} από το Journal του MAVRAKIS HOME.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/journal/kategoria/${category.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${siteUrl}/journal/kategoria/${category.slug}`,
    },
  };
}

export default async function JournalCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const category = await getJournalCategoryBySlug(slug);
  if (!category) notFound();

  const [{ articles, total, perPage }, categories] = await Promise.all([
    getJournalArticles({ categorySlug: slug, page }),
    getJournalCategories(),
  ]);

  // A category with no live articles is a thin page with nothing on it —
  // 404 rather than serve one, matching the rule that an unpublished content
  // page 404s instead of going live empty.
  if (total === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Journal", href: "/journal" },
          { label: category.name, href: `/journal/kategoria/${category.slug}` },
        ]}
      />

      <div className="container-shell mt-6 md:mt-10">
        <header className="max-w-2xl">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">Journal</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 text-base leading-relaxed text-ink-muted">{category.description}</p>
          )}
        </header>

        <div className="mt-8">
          <JournalCategoryNav categories={categories} activeSlug={category.slug} />
        </div>

        <section className="mt-10 border-t border-border pt-10 md:mt-14 md:pt-14">
          {/* A real heading, not a skipped level: the cards below are <h3>, so
              without this the page would jump h1 → h3. */}
          <h2 className="mb-8 text-sm font-medium tracking-widest text-ink-muted uppercase">
            {total === 1 ? "1 άρθρο" : `${total} άρθρα`}
          </h2>
          <JournalGrid articles={articles} />
        </section>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          buildHref={(p) =>
            p === 1 ? `/journal/kategoria/${category.slug}` : `/journal/kategoria/${category.slug}?page=${p}`
          }
        />
      </div>

      <div className="h-16" />
    </>
  );
}
