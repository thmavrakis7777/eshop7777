import type { ContentPage } from "@/lib/data/content-pages";
import { RichBody } from "@/components/content/RichBody";
import { Breadcrumbs } from "@/components/category/Breadcrumbs";

// Plain-text body, never raw HTML — a blank line starts a new paragraph,
// a single newline within a paragraph becomes a line break. Still used by
// category long-descriptions (CategoryPLPView/CategoryLandingView), which
// don't need headings/lists/links. ContentPageView itself (below) now uses
// the richer, shared RichBody parser instead — legal pages need real
// headings and lists, this simpler one is kept only for its other callers.
export function renderBody(body: string) {
  return body
    // Textarea input arrives CRLF-terminated from Windows browsers, which
    // splits a blank line into "\r\n\r\n" — no two consecutive \n, so the
    // paragraph split below silently matched nothing and ran the whole text
    // together. Normalising first is what makes owner-typed paragraphs hold.
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((paragraph, i) => (
      <p key={i} className="text-ink-muted">
        {paragraph.split("\n").map((line, j, arr) => (
          <span key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ))}
      </p>
    ));
}

// `path` is passed in rather than read off `page` (ContentPage has no slug
// field — getContentPage never selected one) so every route file's own
// already-declared PATH constant stays the single source of truth for its
// URL, instead of duplicating it onto the page row.
export async function ContentPageView({ page, path }: { page: ContentPage; path: string }) {
  return (
    <div className="container-shell max-w-3xl py-8 md:py-12">
      <Breadcrumbs items={[{ label: page.title, href: path }]} />
      <h1 className="mb-6 mt-4 font-display text-2xl md:text-3xl">{page.title}</h1>
      {page.imageUrl && (
        // A real <img>, never a CSS background-image — inline style
        // attributes are blocked by production's style-src-elem CSP
        // (commit 5095f74). Optional: most content pages have no image.
        // eslint-disable-next-line @next/next/no-img-element -- admin-entered storage path of unknown dimensions; the aspect-ratio class is what prevents layout shift, which is next/image's main benefit here.
        <img
          src={page.imageUrl}
          alt={page.imageAlt ?? ""}
          className="mb-6 aspect-[16/9] w-full rounded-lg object-cover"
        />
      )}
      {page.body ? (
        <RichBody body={page.body} />
      ) : (
        <p className="text-ink-muted">Το περιεχόμενο αυτής της σελίδας δεν έχει προστεθεί ακόμα.</p>
      )}
    </div>
  );
}
