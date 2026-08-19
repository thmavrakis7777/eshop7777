import Link from "next/link";
import type { JournalArticleCard } from "@/lib/data/journal";

/**
 * Journal presentation pieces. All Server Components — an editorial page is
 * text and images, and nothing here needs a byte of client JavaScript.
 *
 * Images are plain <img> with an explicit aspect-ratio class rather than
 * next/image: the paths are admin-entered (storage path or external URL) and
 * of unknown dimensions, the aspect box already removes the layout shift
 * next/image would otherwise be earning its keep on, and `loading="lazy"`
 * keeps a long list of cards off the critical path. The hero image is the
 * one exception — it is eagerly loaded, being the LCP element.
 */

const dateFormatter = new Intl.DateTimeFormat("el-GR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function ArticleDate({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={className}>
      {dateFormatter.format(new Date(iso))}
    </time>
  );
}

/** Eyebrow above a title: category, then date. Category links out when set. */
function Meta({ article, tone = "muted" }: { article: JournalArticleCard; tone?: "muted" | "accent" }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tracking-wide uppercase">
      {article.categorySlug && article.categoryName && (
        <Link
          href={`/journal/kategoria/${article.categorySlug}`}
          className={tone === "accent" ? "text-accent hover:underline" : "text-ink hover:underline"}
        >
          {article.categoryName}
        </Link>
      )}
      {article.categorySlug && <span aria-hidden="true" className="text-border">·</span>}
      <ArticleDate iso={article.publishedAt} className="text-ink-muted normal-case" />
    </div>
  );
}

/**
 * The landing page's lead article. Two columns from `md` up, stacked below —
 * the image reads first on a phone, which is the order a magazine cover has
 * anyway, so no reversal trickery is needed.
 */
export function JournalHero({ article }: { article: JournalArticleCard }) {
  return (
    <article className="grid gap-6 md:grid-cols-2 md:items-center md:gap-10">
      <Link href={`/journal/${article.slug}`} className="group block overflow-hidden rounded-lg">
        {article.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered path/URL of unknown dimensions; the aspect box already prevents the layout shift next/image would be solving.
          <img
            src={article.heroImageUrl}
            alt={article.heroImageAlt || article.title}
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-surface-strong" aria-hidden="true" />
        )}
      </Link>

      <div className="flex flex-col gap-3">
        <Meta article={article} tone="accent" />
        <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl md:text-4xl">
          <Link href={`/journal/${article.slug}`} className="hover:underline underline-offset-4">
            {article.title}
          </Link>
        </h2>
        {article.excerpt && (
          <p className="text-base leading-relaxed text-ink-muted">{article.excerpt}</p>
        )}
        <Link
          href={`/journal/${article.slug}`}
          className="mt-1 w-fit text-sm font-medium text-accent hover:underline"
        >
          Διαβάστε περισσότερα →
        </Link>
      </div>
    </article>
  );
}

export function JournalCardItem({ article }: { article: JournalArticleCard }) {
  return (
    <article className="flex h-full flex-col">
      <Link href={`/journal/${article.slug}`} className="group block overflow-hidden rounded-lg">
        {article.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see JournalHero.
          <img
            src={article.heroImageUrl}
            alt={article.heroImageAlt || article.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-surface-strong" aria-hidden="true" />
        )}
      </Link>

      <div className="mt-4 flex flex-1 flex-col gap-2">
        <Meta article={article} />
        <h3 className="font-display text-lg leading-snug text-ink sm:text-xl">
          <Link href={`/journal/${article.slug}`} className="hover:underline underline-offset-4">
            {article.title}
          </Link>
        </h3>
        {article.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{article.excerpt}</p>
        )}
        <Link
          href={`/journal/${article.slug}`}
          className="mt-auto pt-3 text-sm font-medium text-accent hover:underline"
        >
          Διαβάστε περισσότερα →
        </Link>
      </div>
    </article>
  );
}

/**
 * The card grid. One column on a phone (a two-up grid of editorial cards at
 * 320px leaves neither the image nor the title legible), two from `sm`,
 * three from `lg`.
 */
export function JournalGrid({ articles }: { articles: JournalArticleCard[] }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <JournalCardItem key={a.id} article={a} />
      ))}
    </div>
  );
}

/** Category filter row, shown only when categories with content exist. */
export function JournalCategoryNav({
  categories,
  activeSlug,
}: {
  categories: { slug: string; name: string }[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;
  const chip = "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors";
  return (
    <nav aria-label="Κατηγορίες Journal" className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
      <Link
        href="/journal"
        aria-current={activeSlug ? undefined : "page"}
        className={`${chip} ${activeSlug ? "border-border text-ink-muted hover:border-ink hover:text-ink" : "border-ink bg-ink text-bg"}`}
      >
        Όλα
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/journal/kategoria/${c.slug}`}
          aria-current={activeSlug === c.slug ? "page" : undefined}
          className={`${chip} ${
            activeSlug === c.slug
              ? "border-ink bg-ink text-bg"
              : "border-border text-ink-muted hover:border-ink hover:text-ink"
          }`}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
