import type { ContentPage } from "@/lib/data/content-pages";

// Plain-text body, never raw HTML — a blank line starts a new paragraph,
// a single newline within a paragraph becomes a line break. No markdown,
// no dangerouslySetInnerHTML: the admin-editable field is trusted-owner
// content (same trust level as the seo module's plain-text fields), but
// there is still no reason to parse or render HTML for what is, in every
// case built so far (About/Shipping/Returns/Privacy/Terms/FAQ), plain
// informational text.
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

export function ContentPageView({ page }: { page: ContentPage }) {
  return (
    <div className="container-shell max-w-3xl py-8 md:py-12">
      <h1 className="mb-6 font-display text-2xl md:text-3xl">{page.title}</h1>
      {page.body ? (
        <div className="flex flex-col gap-4 text-base leading-relaxed">{renderBody(page.body)}</div>
      ) : (
        <p className="text-ink-muted">Το περιεχόμενο αυτής της σελίδας δεν έχει προστεθεί ακόμα.</p>
      )}
    </div>
  );
}
