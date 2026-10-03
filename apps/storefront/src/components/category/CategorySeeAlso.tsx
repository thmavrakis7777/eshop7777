import { HoverPrefetchLink } from "@/components/ui/HoverPrefetchLink";
import type { ChildCategoryLink } from "@/components/category/CategoryChildNav";

/**
 * «Δείτε επίσης» on a leaf category page (one with no subcategories): the
 * other subcategories of the same parent, e.g. Πολύπριζα → Μπαλαντέζες,
 * Αντάπτορες, Λάμπες LED…
 *
 * Before this a leaf page only linked upwards (breadcrumb), so shoppers and
 * crawlers reached a sibling only through the mega menu — and an empty leaf
 * was a dead end apart from «Επιστροφή σε …». Same parent is the honest
 * definition of "related" this catalog has; the list is not hand-picked or
 * ranked, so nothing here can turn into keyword-padded link lists.
 *
 * Deliberately not CategoryChildNav: that is the picker at the top of a
 * parent page, with an image card per category — 19 of those at the foot of
 * a leaf page (ΣΠΙΤΙ - ΟΡΓΑΝΩΣΗ has 20 subcategories) would outweigh the
 * page. Here it's one wrapping row of plain text links in the page's own
 * border/accent styling, no product counts (most would read «0» until the
 * real catalog is in).
 *
 * HoverPrefetchLink, not Link: up to ~19 links enter the viewport together,
 * which with viewport prefetching fires one request per category route —
 * the mega-menu problem from the Speed audit (SPD-13). Only the link the
 * shopper points at or focuses prefetches.
 */
export function CategorySeeAlso({ items }: { items: Pick<ChildCategoryLink, "name" | "href">[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-labelledby="category-see-also-heading" className="mt-14">
      <h2 id="category-see-also-heading" className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Δείτε επίσης
      </h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <HoverPrefetchLink
              href={item.href}
              // 44px tall — the touch-target minimum, same as the other
              // tappable rows on category pages.
              className="inline-flex min-h-11 items-center rounded-md border border-border px-3.5 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {item.name}
            </HoverPrefetchLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
