import "server-only";
import { sql, transaction } from "@/lib/db/client";
import { slugify } from "@/lib/admin/products";

/**
 * The Journal — admin reads and writes.
 *
 * Mirrors lib/admin/products.ts throughout: a typed error with codes the
 * action layer maps to Greek copy, slug uniqueness checked inside the same
 * transaction as the write, and SEO stored in shop.seo_meta with the "all
 * fields empty ⇒ delete the row rather than leave an empty override"
 * behaviour that file established.
 */

export class JournalError extends Error {
  constructor(
    message: string,
    public code: "duplicate_slug" | "reserved_slug" | "not_found" | "invalid_slug"
  ) {
    super(message);
  }
}

/**
 * Slugs the Journal's own routing already claims. `/journal/kategoria/x` is a
 * literal route segment that wins the match against `/journal/[slug]`, so an
 * article slugged "kategoria" would exist in the database and 404 on the
 * storefront — caught here rather than becoming a mystery later.
 */
const RESERVED_ARTICLE_SLUGS = new Set(["kategoria"]);

export type JournalStatus = "draft" | "published";

export type AdminJournalArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: JournalStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  hasBody: boolean;
  hasHeroImage: boolean;
  categoryName: string | null;
  updatedAt: string;
};

export type AdminJournalArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  categoryId: string | null;
  heroImagePath: string | null;
  heroImageAlt: string | null;
  author: string | null;
  status: JournalStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  relatedProductSlugs: string[];
  seo: {
    seoTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    socialImagePath: string | null;
    keywords: string | null;
    robots: "index" | "noindex";
  };
};

export type AdminJournalCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  articleCount: number;
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listJournalCategories(): Promise<AdminJournalCategory[]> {
  const rows = await sql<
    {
      id: string; slug: string; name: string; description: string | null;
      sort_order: number; article_count: number;
    }[]
  >`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order,
           COUNT(a.id)::int AS article_count
      FROM shop.journal_category c
      LEFT JOIN shop.journal_article a ON a.category_id = c.id
     GROUP BY c.id, c.slug, c.name, c.description, c.sort_order
     ORDER BY c.sort_order, c.name COLLATE "el-GR-x-icu"`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    articleCount: r.article_count,
  }));
}

export async function saveJournalCategory(input: {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}): Promise<string> {
  const slug = input.slug || slugify(input.name);
  if (!slug) throw new JournalError("Slug is empty", "invalid_slug");

  return transaction(async (tx) => {
    const dupe = await tx<{ id: string }[]>`
      SELECT id FROM shop.journal_category
       WHERE slug = ${slug} ${input.id ? tx`AND id <> ${input.id}` : tx``}`;
    if (dupe.length > 0) throw new JournalError("Slug already in use", "duplicate_slug");

    if (input.id) {
      const updated = await tx`
        UPDATE shop.journal_category
           SET name = ${input.name}, slug = ${slug}, description = ${input.description},
               sort_order = ${input.sortOrder}
         WHERE id = ${input.id}`;
      if (updated.count === 0) throw new JournalError("Category not found", "not_found");
      return input.id;
    }

    const [row] = await tx<{ id: string }[]>`
      INSERT INTO shop.journal_category (name, slug, description, sort_order)
      VALUES (${input.name}, ${slug}, ${input.description}, ${input.sortOrder})
      RETURNING id`;
    return row.id;
  });
}

/**
 * Deleting a category does NOT delete its articles — the FK is ON DELETE SET
 * NULL, so they stay published and readable, just uncategorised. Losing a
 * label must never mean losing the writing.
 */
export async function deleteJournalCategory(id: string): Promise<void> {
  const result = await sql`DELETE FROM shop.journal_category WHERE id = ${id}`;
  if (result.count === 0) throw new JournalError("Category not found", "not_found");
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function listJournalArticles(): Promise<AdminJournalArticleRow[]> {
  const rows = await sql<
    {
      id: string; slug: string; title: string; status: JournalStatus;
      published_at: Date | null; is_featured: boolean; has_body: boolean;
      has_hero_image: boolean; category_name: string | null; updated_at: Date;
    }[]
  >`
    SELECT a.id, a.slug, a.title, a.status, a.published_at, a.is_featured,
           (a.body IS NOT NULL AND a.body <> '') AS has_body,
           (a.hero_image_path IS NOT NULL AND a.hero_image_path <> '') AS has_hero_image,
           c.name AS category_name, a.updated_at
      FROM shop.journal_article a
      LEFT JOIN shop.journal_category c ON c.id = a.category_id
     ORDER BY COALESCE(a.published_at, a.created_at) DESC`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    isFeatured: r.is_featured,
    hasBody: r.has_body,
    hasHeroImage: r.has_hero_image,
    categoryName: r.category_name,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function getJournalArticle(id: string): Promise<AdminJournalArticle | null> {
  const rows = await sql<
    {
      id: string; slug: string; title: string; excerpt: string | null; body: string | null;
      category_id: string | null; hero_image_path: string | null; hero_image_alt: string | null;
      author: string | null; status: JournalStatus; published_at: Date | null;
      is_featured: boolean; related_product_slugs: string[] | null;
      seo_title: string | null; meta_description: string | null; canonical_url: string | null;
      og_title: string | null; og_description: string | null; social_image_path: string | null;
      keywords: string | null; robots: "index" | "noindex" | null;
    }[]
  >`
    SELECT a.id, a.slug, a.title, a.excerpt, a.body, a.category_id, a.hero_image_path,
           a.hero_image_alt, a.author, a.status, a.published_at, a.is_featured,
           a.related_product_slugs,
           s.seo_title, s.meta_description, s.canonical_url, s.og_title, s.og_description,
           s.social_image_path, s.keywords, s.robots
      FROM shop.journal_article a
      LEFT JOIN shop.seo_meta s
        ON s.resource_type = 'journal_article' AND s.resource_id = a.id::text
     WHERE a.id = ${id}
     LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    categoryId: r.category_id,
    heroImagePath: r.hero_image_path,
    heroImageAlt: r.hero_image_alt,
    author: r.author,
    status: r.status,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    isFeatured: r.is_featured,
    relatedProductSlugs: r.related_product_slugs ?? [],
    seo: {
      seoTitle: r.seo_title,
      metaDescription: r.meta_description,
      canonicalUrl: r.canonical_url,
      ogTitle: r.og_title,
      ogDescription: r.og_description,
      socialImagePath: r.social_image_path,
      keywords: r.keywords,
      robots: r.robots ?? "index",
    },
  };
}

/**
 * Minimal create — title and slug only, always as a draft. Same reasoning as
 * NewProductForm: asking for twenty fields before an article can exist is how
 * articles stop getting written.
 */
export async function createJournalArticle(input: { title: string; slug: string }): Promise<string> {
  const slug = assertUsableSlug(input.slug || slugify(input.title));
  return transaction(async (tx) => {
    const dupe = await tx<{ id: string }[]>`
      SELECT id FROM shop.journal_article WHERE slug = ${slug}`;
    if (dupe.length > 0) throw new JournalError("Slug already in use", "duplicate_slug");

    const [row] = await tx<{ id: string }[]>`
      INSERT INTO shop.journal_article (title, slug, status)
      VALUES (${input.title}, ${slug}, 'draft')
      RETURNING id`;
    return row.id;
  });
}

export type JournalArticleInput = {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  categoryId: string | null;
  heroImagePath: string | null;
  heroImageAlt: string | null;
  author: string | null;
  status: JournalStatus;
  /**
   * Calendar date (YYYY-MM-DD) in the shop's timezone, or null to let a first
   * publish stamp `now()`. Day granularity, deliberately: an owner schedules
   * "this goes out on Monday", never "at 14:37", and a date carries no
   * timezone ambiguity between a UTC server and a Greek shop.
   */
  publishedDate: string | null;
  isFeatured: boolean;
  relatedProductSlugs: string[];
  seo: AdminJournalArticle["seo"];
};

function assertUsableSlug(slug: string): string {
  if (!slug) throw new JournalError("Slug is empty", "invalid_slug");
  if (RESERVED_ARTICLE_SLUGS.has(slug)) throw new JournalError("Slug is reserved", "reserved_slug");
  return slug;
}

export async function updateJournalArticle(id: string, input: JournalArticleInput): Promise<void> {
  const slug = assertUsableSlug(input.slug);

  await transaction(async (tx) => {
    const dupe = await tx<{ id: string }[]>`
      SELECT id FROM shop.journal_article WHERE slug = ${slug} AND id <> ${id}`;
    if (dupe.length > 0) throw new JournalError("Slug already in use", "duplicate_slug");

    // One CASE rather than three code paths, because all three are the same
    // rule seen from different angles:
    //
    //   no date given        → publishing stamps now(), otherwise leave it
    //                          alone (so re-publishing something previously
    //                          withdrawn keeps its original date instead of
    //                          silently claiming to be new)
    //   date unchanged       → keep the exact timestamp, so an ordinary save
    //                          never reshuffles same-day articles
    //   date given/changed   → 08:00 on that day, Athens time
    //
    // The timezone conversion is Postgres's job, not JavaScript's: `AT TIME
    // ZONE` knows about Greek DST, and the server runs UTC.
    const updated = await tx`
      UPDATE shop.journal_article SET
        title = ${input.title}, slug = ${slug}, excerpt = ${input.excerpt},
        body = ${input.body}, category_id = ${input.categoryId},
        hero_image_path = ${input.heroImagePath}, hero_image_alt = ${input.heroImageAlt},
        author = ${input.author}, status = ${input.status},
        published_at = CASE
          WHEN ${input.publishedDate}::date IS NULL THEN
            CASE WHEN ${input.status} = 'published' THEN COALESCE(published_at, now())
                 ELSE published_at END
          WHEN published_at IS NOT NULL
               AND (published_at AT TIME ZONE 'Europe/Athens')::date = ${input.publishedDate}::date
            THEN published_at
          ELSE (${input.publishedDate}::text || ' 08:00')::timestamp AT TIME ZONE 'Europe/Athens'
        END,
        is_featured = ${input.isFeatured},
        related_product_slugs = ${input.relatedProductSlugs}::text[]
      WHERE id = ${id}`;
    if (updated.count === 0) throw new JournalError("Article not found", "not_found");

    const s = input.seo;
    const hasSeo =
      s.seoTitle || s.metaDescription || s.canonicalUrl || s.ogTitle || s.ogDescription ||
      s.socialImagePath || s.keywords || s.robots === "noindex";
    if (hasSeo) {
      await tx`
        INSERT INTO shop.seo_meta (resource_type, resource_id, seo_title, meta_description,
                                   canonical_url, og_title, og_description, social_image_path,
                                   keywords, robots)
        VALUES ('journal_article', ${id}, ${s.seoTitle}, ${s.metaDescription}, ${s.canonicalUrl},
                ${s.ogTitle}, ${s.ogDescription}, ${s.socialImagePath}, ${s.keywords}, ${s.robots})
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET
          seo_title = EXCLUDED.seo_title, meta_description = EXCLUDED.meta_description,
          canonical_url = EXCLUDED.canonical_url, og_title = EXCLUDED.og_title,
          og_description = EXCLUDED.og_description,
          social_image_path = EXCLUDED.social_image_path,
          keywords = EXCLUDED.keywords, robots = EXCLUDED.robots, updated_at = now()`;
    } else {
      // All fields cleared — remove the row rather than leaving an empty
      // override that silently shadows the article's own metadata.
      await tx`DELETE FROM shop.seo_meta
                WHERE resource_type = 'journal_article' AND resource_id = ${id}`;
    }
  });
}

/** Publish/unpublish from the list, without opening the editor. */
export async function setJournalArticleStatus(id: string, status: JournalStatus): Promise<void> {
  const result = await sql`
    UPDATE shop.journal_article
       SET status = ${status},
           published_at = CASE
             WHEN ${status} = 'published' THEN COALESCE(published_at, now())
             ELSE published_at
           END
     WHERE id = ${id}`;
  if (result.count === 0) throw new JournalError("Article not found", "not_found");
}

export async function deleteJournalArticle(id: string): Promise<void> {
  await transaction(async (tx) => {
    // seo_meta is polymorphic with no FK to lean on, so its row has to be
    // removed explicitly or it would outlive the article and eventually be
    // inherited by an unrelated resource reusing the id.
    await tx`DELETE FROM shop.seo_meta
              WHERE resource_type = 'journal_article' AND resource_id = ${id}`;
    const result = await tx`DELETE FROM shop.journal_article WHERE id = ${id}`;
    if (result.count === 0) throw new JournalError("Article not found", "not_found");
  });
}
