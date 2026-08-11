import type { ProductExtra } from "@/lib/data/product-extras";

// Own labeled section, same pattern as ProductCharacteristics — renders
// nothing when neither field is set, the honest default until an admin
// fills it in via the product detail page's Merchandising widget.
export function ProductWarranty({ extra }: { extra: ProductExtra | null }) {
  if (!extra || (!extra.warrantyText && !extra.downloadsUrl)) return null;

  return (
    <section className="container-shell mt-12 max-w-2xl md:mt-16">
      <h2 className="font-display text-xl text-ink md:text-2xl">Εγγύηση &amp; Downloads</h2>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-6 text-sm">
        {extra.warrantyText && <p className="text-ink-muted">{extra.warrantyText}</p>}
        {extra.downloadsUrl && (
          <a
            href={extra.downloadsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline underline-offset-4 hover:text-accent"
          >
            Λήψη εγχειριδίου
          </a>
        )}
      </div>
    </section>
  );
}
