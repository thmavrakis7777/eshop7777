import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/category/Breadcrumbs";
import { ArticleBody, articleBodyToPlainText } from "@/components/journal/ArticleBody";
import { ArticleDate, JournalCardItem } from "@/components/journal/JournalCard";
import { ProductCard } from "@/components/product/ProductCard";
import { getBranding } from "@/lib/data/branding";
import { getJournalArticleBySlug, getRelatedJournalArticles } from "@/lib/data/journal";
import { getProductsByHandles } from "@/lib/data/products";
import { getSeoOverride } from "@/lib/data/seo";
import { safeJsonLd } from "@/lib/json-ld";
import { deriveMetaDescription } from "@/lib/seo-text";
import { siteUrl } from "@/lib/site-config";

/**
 * /journal/[slug] — one article.
 *
 * Drafts and scheduled articles never reach this file: getJournalArticleBySlug
 * applies the publishing gate in the WHERE clause, so an unpublished slug
 * resolves to null here and 404s — the same rule the eleven static content
 * pages already follow, and the reason a draft is not merely unlinked but
 * genuinely unreachable and unindexable.
 */

type Params = Promise<{ slug: string }>;

// generateMetadata and the page body both resolve the same article in the
// same request; getJournalArticleBySlug is unstable_cache'd, so the second
// call is served from that cache rather than hitting Postgres twice.
async function load(slug: string) {
  const article = await getJournalArticleBySlug(slug);
  if (!article) notFound();
  return article;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getJournalArticleBySlug(slug);
  if (!article) return {};

  // Per-article SEO lives in shop.seo_meta under resource_type
  // 'journal_article' — the same polymorphic table products and categories
  // use, read through the same helper.
  const seo = await getSeoOverride("journal_article", article.id);

  const title = seo?.seoTitle || article.title;
  const description =
    seo?.metaDescription ||
    article.excerpt ||
    deriveMetaDescription(articleBodyToPlainText(article.body)) ||
    undefined;
  const path = seo?.canonicalUrl || `/journal/${article.slug}`;
  const image = seo?.socialImageUrl || article.heroImageUrl;

  return {
    title: seo?.seoTitle ? { absolute: seo.seoTitle } : title,
    description,
    alternates: { canonical: path },
    ...(seo?.robots === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: path.startsWith("http") ? path : `${siteUrl}${path}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(image ? { images: [{ url: image, alt: article.heroImageAlt || article.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      ...(image ? { images: [image] } : {}),
    },
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
  };
}

export default async function JournalArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = await load(slug);

  const [related, products, branding, nonce] = await Promise.all([
    getRelatedJournalArticles(article.id, article.categoryId, 3),
    // Only queried when the owner actually attached products — an article
    // with none costs nothing extra.
    article.relatedProductSlugs.length > 0
      ? getProductsByHandles(article.relatedProductSlugs)
      : Promise.resolve([]),
    getBranding(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const pageUrl = `${siteUrl}/journal/${article.slug}`;
  const plainBody = articleBodyToPlainText(article.body);

  const breadcrumbs: Crumb[] = [
    { label: "Journal", href: "/journal" },
    ...(article.categorySlug && article.categoryName
      ? [{ label: article.categoryName, href: `/journal/kategoria/${article.categorySlug}` }]
      : []),
    { label: article.title, href: `/journal/${article.slug}` },
  ];

  // schema.org's own vocabulary for an editorial post. The public section is
  // called "Journal" — that is a branding decision about user-facing copy and
  // has no bearing on the type name a crawler reads.
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.heroImageUrl ? { image: [article.heroImageUrl] } : {}),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    // Author defaults to the store itself rather than inventing a person —
    // the owner can set a real byline per article in the dashboard.
    author: article.author
      ? { "@type": "Person", name: article.author }
      : { "@type": "Organization", name: branding.storeName, url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: branding.storeName,
      ...(branding.logoUrl ? { logo: { "@type": "ImageObject", url: branding.logoUrl } } : {}),
    },
    ...(article.categoryName ? { articleSection: article.categoryName } : {}),
    inLanguage: "el",
    ...(plainBody ? { wordCount: plainBody.split(/\s+/).filter(Boolean).length } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />

      <Breadcrumbs items={breadcrumbs} />

      {/* max-w-[42rem] ≈ 68 characters at this size — the readable measure an
          editorial page lives or dies by, and the reason the article column
          does not simply fill container-shell. */}
      <article className="container-shell mt-6 max-w-[42rem] md:mt-10">
        <header>
          {article.categorySlug && article.categoryName && (
            <Link
              href={`/journal/kategoria/${article.categorySlug}`}
              className="text-xs font-medium tracking-widest text-accent uppercase hover:underline"
            >
              {article.categoryName}
            </Link>
          )}
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
            {article.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            <ArticleDate iso={article.publishedAt} />
            {article.author && (
              <>
                <span aria-hidden="true">·</span>
                <span>{article.author}</span>
              </>
            )}
          </div>
        </header>

        {article.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered path/URL of unknown dimensions; the aspect box removes the layout shift next/image would be earning its keep on. Eager: this is the LCP element.
          <img
            src={article.heroImageUrl}
            alt={article.heroImageAlt || article.title}
            fetchPriority="high"
            className="mt-8 aspect-[3/2] w-full rounded-lg object-cover"
          />
        )}

        {article.excerpt && (
          <p className="mt-8 font-display text-lg leading-relaxed text-ink sm:text-xl">
            {article.excerpt}
          </p>
        )}

        {article.body && (
          <div className="mt-8">
            <ArticleBody body={article.body} />
          </div>
        )}
      </article>

      {products.length > 0 && (
        <section className="container-shell mt-16 md:mt-20">
          <div className="mx-auto max-w-6xl border-t border-border pt-10">
            <h2 className="font-display text-xl text-ink md:text-2xl">Προϊόντα από το άρθρο</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-shell mt-16 md:mt-20">
          <div className="mx-auto max-w-6xl border-t border-border pt-10">
            <h2 className="font-display text-xl text-ink md:text-2xl">Μπορεί να σας ενδιαφέρουν</h2>
            <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <JournalCardItem key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-shell mt-16 mb-16 md:mt-20">
        <div className="mx-auto flex max-w-[42rem] flex-col items-start gap-3 rounded-lg bg-surface p-6 md:p-8">
          <h2 className="font-display text-xl text-ink">Περισσότερα από το Journal</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Οδηγοί αγοράς, ιδέες οργάνωσης και πρακτικές συμβουλές για κάθε γωνιά του σπιτιού.
          </p>
          <Link
            href="/journal"
            className="mt-1 rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent"
          >
            Δείτε όλα τα άρθρα
          </Link>
        </div>
      </section>
    </>
  );
}
