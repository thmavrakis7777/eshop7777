import { safeJsonLd } from "@/lib/json-ld";
import type { FaqItem } from "@/lib/types";

function buildFaqPageJsonLd(faq: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // Mapped 1:1 from the same array the page renders below — this can
    // never drift into listing a question that isn't actually on the page.
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * The owner's «Συχνές Ερωτήσεις» for a category (shop.category.faq, up to 5
 * pairs edited in CategoryManager), with matching FAQPage structured data.
 * Shared by service pages (CategoryLandingView) and, since the ΥΓΡΑΕΡΙΟ
 * audit (CATEGORY_FAQ_SPEC.md), product categories (CategoryPLPView). Google
 * no longer shows FAQ rich results for shops, so the markup is there for
 * clarity and AI assistants, not for a different look in the results.
 * Renders nothing at all for a category without questions.
 */
export function CategoryFaq({ faq, className }: { faq: FaqItem[] | null | undefined; className: string }) {
  if (!faq || faq.length === 0) return null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(buildFaqPageJsonLd(faq)) }} />
      <section className={className}>
        <h2 className="font-display text-xl text-ink md:text-2xl">Συχνές Ερωτήσεις</h2>
        <div className="mt-6 flex flex-col divide-y divide-border border-t border-border">
          {faq.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span aria-hidden="true" className="shrink-0 text-ink-muted group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
