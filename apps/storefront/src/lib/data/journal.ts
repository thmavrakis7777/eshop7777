import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import { publicImageUrl } from "@/lib/storage/urls";

/**
 * The Journal — storefront reads.
 *
 * Same shape as lib/data/navigation.ts: server-only, one cache tag the admin
 * writes invalidate, and a never-throw contract on the listing reads so an
 * unreachable database degrades the section rather than 500-ing the page it
 * sits on. The single-article read is the deliberate exception — it must be
 * able to distinguish "no such article" (→ 404) from "database down", so it
 * lets the error propagate rather than silently claiming the article is gone.
 *
 * PUBLISHING GATE, defined once here and nowhere else:
 *     status = 'published' AND published_at IS NOT NULL AND published_at <= now()
 * A draft is invisible to the storefront at the query level — its body never
 * reaches the render layer at all, so there is no way for one to leak through
 * a component that forgot to check. A future published_at is the whole of the
 * scheduling feature: no cron, no job runner. The 60s cache window means a
 * scheduled article appears within a minute of its time, which is the right
 * trade for a store that publishes a few articles a month.
 */

export const JOURNAL_CACHE_TAG = "journal";

const PER_PAGE = 12;

export type JournalCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  articleCount: number;
};

export type JournalArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  publishedAt: string;
  categorySlug: string | null;
  categoryName: string | null;
};

export type JournalArticle = JournalArticleCard & {
  body: string | null;
  author: string | null;
  categoryId: string | null;
  relatedProductSlugs: string[];
  updatedAt: string;
};

type CardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  hero_image_path: string | null;
  hero_image_alt: string | null;
  published_at: Date;
  category_slug: string | null;
  category_name: string | null;
};

const toCard = (r: CardRow): JournalArticleCard => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  heroImageUrl: publicImageUrl(r.hero_image_path),
  heroImageAlt: r.hero_image_alt,
  publishedAt: new Date(r.published_at).toISOString(),
  categorySlug: r.category_slug,
  categoryName: r.category_name,
});

// Repeated verbatim in five queries otherwise. `LIVE` is the publishing gate;
// keeping it as one fragment is what stops a future query from accidentally
// listing drafts.
const LIVE = sql`a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= now()`;

const CARD_FIELDS = sql`
  a.id, a.slug, a.title, a.excerpt, a.hero_image_path, a.hero_image_alt,
  a.published_at, c.slug AS category_slug, c.name AS category_name`;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Every category with at least one live article. Categories with nothing in
 * them are omitted on purpose: an empty category page is a thin page Google
 * would index and a dead end a reader would click, and neither is worth
 * having so the owner can see a label they already know exists.
 */
export const getJournalCategories = unstable_cache(
  async (): Promise<JournalCategory[]> => {
    try {
      const rows = await sql<
        { id: string; slug: string; name: string; description: string | null; article_count: number }[]
      >`
        SELECT c.id, c.slug, c.name, c.description, COUNT(a.id)::int AS article_count
          FROM shop.journal_category c
          JOIN shop.journal_article a ON a.category_id = c.id AND ${LIVE}
         GROUP BY c.id, c.slug, c.name, c.description, c.sort_order
         ORDER BY c.sort_order, c.name COLLATE "el-GR-x-icu"`;
      return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        articleCount: r.article_count,
      }));
    } catch {
      return [];
    }
  },
  ["journal-categories"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

export const getJournalCategoryBySlug = unstable_cache(
  async (slug: string): Promise<Omit<JournalCategory, "articleCount"> | null> => {
    try {
      const rows = await sql<{ id: string; slug: string; name: string; description: string | null }[]>`
        SELECT id, slug, name, description FROM shop.journal_category WHERE slug = ${slug} LIMIT 1`;
      return rows[0] ?? null;
    } catch {
      return null;
    }
  },
  ["journal-category"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/**
 * One page of live articles, newest first, optionally within a category.
 *
 * Paginated at the database rather than sliced in the component — the whole
 * point of a Journal is that it keeps growing, and "SELECT everything then
 * show twelve" is the version of this that gets slower every time the owner
 * writes something.
 */
export const getJournalArticles = unstable_cache(
  async (opts: {
    categorySlug?: string;
    page?: number;
    excludeSlug?: string;
  } = {}): Promise<{ articles: JournalArticleCard[]; total: number; perPage: number }> => {
    const page = Math.max(1, opts.page ?? 1);
    const offset = (page - 1) * PER_PAGE;
    const categorySlug = opts.categorySlug ?? null;
    const excludeSlug = opts.excludeSlug ?? null;
    try {
      const rows = await sql<(CardRow & { total: number })[]>`
        SELECT ${CARD_FIELDS}, COUNT(*) OVER ()::int AS total
          FROM shop.journal_article a
          LEFT JOIN shop.journal_category c ON c.id = a.category_id
         WHERE ${LIVE}
           AND (${categorySlug}::text IS NULL OR c.slug = ${categorySlug})
           AND (${excludeSlug}::text IS NULL OR a.slug <> ${excludeSlug})
         ORDER BY a.published_at DESC
         LIMIT ${PER_PAGE} OFFSET ${offset}`;
      return {
        articles: rows.map(toCard),
        total: rows[0]?.total ?? 0,
        perPage: PER_PAGE,
      };
    } catch {
      return { articles: [], total: 0, perPage: PER_PAGE };
    }
  },
  ["journal-articles"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

/**
 * The landing page's hero. The newest live article the owner flagged as
 * featured; falls back to the newest live article so the page is never
 * headless just because nobody ticked a box.
 */
export const getFeaturedJournalArticle = unstable_cache(
  async (): Promise<JournalArticleCard | null> => {
    try {
      const rows = await sql<CardRow[]>`
        SELECT ${CARD_FIELDS}
          FROM shop.journal_article a
          LEFT JOIN shop.journal_category c ON c.id = a.category_id
         WHERE ${LIVE}
         ORDER BY a.is_featured DESC, a.published_at DESC
         LIMIT 1`;
      return rows[0] ? toCard(rows[0]) : null;
    } catch {
      return null;
    }
  },
  ["journal-featured"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

/**
 * "Μπορεί να σας ενδιαφέρουν". Same category first, then anything else
 * recent to fill the row — so a brand-new category with one article still
 * gets a useful footer instead of an empty section. One query, one pass, no
 * per-article join table to maintain.
 */
export const getRelatedJournalArticles = unstable_cache(
  async (articleId: string, categoryId: string | null, limit = 3): Promise<JournalArticleCard[]> => {
    try {
      const rows = await sql<CardRow[]>`
        SELECT ${CARD_FIELDS}
          FROM shop.journal_article a
          LEFT JOIN shop.journal_category c ON c.id = a.category_id
         WHERE ${LIVE} AND a.id <> ${articleId}
         ORDER BY (a.category_id IS NOT DISTINCT FROM ${categoryId}) DESC, a.published_at DESC
         LIMIT ${limit}`;
      return rows.map(toCard);
    } catch {
      return [];
    }
  },
  ["journal-related"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

// ---------------------------------------------------------------------------
// Single article
// ---------------------------------------------------------------------------

/**
 * One live article by slug, or null when there is no such published article.
 *
 * Not wrapped in a try/catch: the caller turns null into notFound(), and a
 * database outage must not be reported to Google as "this article is gone".
 * An unhandled error yields a 500, which is the honest answer and the one
 * that keeps the URL indexable.
 */
export const getJournalArticleBySlug = unstable_cache(
  async (slug: string): Promise<JournalArticle | null> => {
    const rows = await sql<
      (CardRow & {
        body: string | null;
        author: string | null;
        category_id: string | null;
        related_product_slugs: string[] | null;
        updated_at: Date;
      })[]
    >`
      SELECT ${CARD_FIELDS}, a.body, a.author, a.category_id,
             a.related_product_slugs, a.updated_at
        FROM shop.journal_article a
        LEFT JOIN shop.journal_category c ON c.id = a.category_id
       WHERE a.slug = ${slug} AND ${LIVE}
       LIMIT 1`;
    const r = rows[0];
    if (!r) return null;
    return {
      ...toCard(r),
      body: r.body,
      author: r.author,
      categoryId: r.category_id,
      relatedProductSlugs: r.related_product_slugs ?? [],
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  },
  ["journal-article"],
  { revalidate: 60, tags: [JOURNAL_CACHE_TAG] }
);

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

/**
 * Live article and category slugs for sitemap.xml. Drafts and scheduled
 * articles are excluded by the same LIVE gate everything else uses — there
 * is no second definition of "published" that could drift out of step with
 * what the storefront will actually serve.
 *
 * Uncached: sitemap.ts runs this once per build/regeneration, so a cache
 * entry would only ever add a stale window.
 */
export async function getJournalSitemapEntries(): Promise<{
  articles: { slug: string; updatedAt: string }[];
  categories: { slug: string }[];
}> {
  const [articles, categories] = await Promise.all([
    sql<{ slug: string; updated_at: Date }[]>`
      SELECT a.slug, a.updated_at FROM shop.journal_article a
       WHERE ${LIVE} ORDER BY a.published_at DESC`,
    sql<{ slug: string }[]>`
      SELECT DISTINCT c.slug
        FROM shop.journal_category c
        JOIN shop.journal_article a ON a.category_id = c.id AND ${LIVE}`,
  ]);
  return {
    articles: articles.map((a) => ({ slug: a.slug, updatedAt: new Date(a.updated_at).toISOString() })),
    categories: categories.map((c) => ({ slug: c.slug })),
  };
}
