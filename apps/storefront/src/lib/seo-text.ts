// Derives a real per-page meta description from a content page's own body
// text, for the 11 static pages (Σχετικά, Αποστολές, …) that have no admin
// SEO-override UI yet — every one otherwise inherited the root layout's
// generic storefront description verbatim, which is a real SEO gap (11
// indexable pages sharing one description) but not one to close by
// inventing marketing copy. This is genuinely that page's own content, just
// truncated to meta-description length — never fabricated.
const MAX_LENGTH = 160;

export function deriveMetaDescription(body: string | null): string | undefined {
  if (!body) return undefined;
  // Body is plain text (see ContentPageView.tsx) with blank lines separating
  // paragraphs — collapse to a single line before truncating.
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  if (flat.length <= MAX_LENGTH) return flat;
  // Cut at the last whole word inside the budget rather than mid-word.
  const cut = flat.slice(0, MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
