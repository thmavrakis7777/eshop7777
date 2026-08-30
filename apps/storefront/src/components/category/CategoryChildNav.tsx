import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/Icons";
import type { CategoryNode } from "@/lib/types";
import { publicImageUrl } from "@/lib/storage/urls";

export type ChildCategoryLink = {
  name: string;
  href: string;
  imagePath?: string | null;
  productCount: number;
  /** 'landing' children are a service page, not a listing — see below. */
  pageType?: "products" | "landing";
};

// No basePath parameter: child.canonicalHref is already this child's real,
// complete URL. Concatenating basePath + child.handle was only ever correct
// because every child used to be a primary child of the page being viewed —
// a cross-listed child's real URL can live under a different category
// entirely (wherever its own primary parent puts it).
export function toChildLinks(children: CategoryNode[]): ChildCategoryLink[] {
  return children.map((child) => ({
    name: child.name,
    href: child.canonicalHref,
    imagePath: child.imagePath,
    productCount: child.productCount,
    pageType: child.pageType,
  }));
}

/**
 * The "shop by category" picker that sits between a category's H1 and its
 * product grid, listing that category's *direct* children only.
 *
 * One component, two shapes, no client JavaScript: a full-width tappable row
 * with a chevron on phones, an image card from `sm:` up. They are the same
 * markup under different flex/grid rules rather than two components behind a
 * media query, so a category can never appear in one and not the other, and
 * nothing has to be measured on the client to decide which to render.
 *
 * The depth limit lives in the data, not here — this renders whatever level
 * it is handed, which is what makes main → sub → sub-sub work without a
 * per-level variant.
 */
export function CategoryChildNav({
  title,
  items,
}: {
  title: string;
  items: ChildCategoryLink[];
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-labelledby="category-children-heading" className="mt-8">
      <h2 id="category-children-heading" className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        {title}
      </h2>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          // A 'landing' child is a service the shop performs in person, not
          // a listing. "0 προϊόντα / δες τα προϊόντα" is not merely
          // unhelpful there, it is false — it will always be zero, and there
          // are no products at the other end of the link.
          const isService = item.pageType === "landing";
          return (
          <li key={item.href}>
            <Link
              href={item.href}
              // Row on phones (min 56px tall — comfortably past the 44px
              // touch guidance), card from sm: up. `h-full` keeps cards in a
              // row the same height when one name wraps to two lines.
              className="group flex h-full items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0"
            >
              <CategoryThumb name={item.name} imagePath={item.imagePath} />

              <span className="flex min-w-0 flex-1 flex-col sm:p-4">
                {/* Wraps rather than truncates: a clipped Greek category
                    name is unreadable, and two lines cost less than a name
                    the shopper cannot identify. */}
                <span className="text-sm font-medium text-ink break-words group-hover:text-accent">{item.name}</span>
                <span className="mt-0.5 text-xs text-ink-muted tabular-nums">
                  {isService
                    ? "Υπηρεσία καταστήματος"
                    : item.productCount === 1
                      ? "1 προϊόν"
                      : `${item.productCount} προϊόντα`}
                </span>
                <span className="mt-3 hidden text-xs font-medium text-accent sm:block">
                  {isService ? "Μάθε περισσότερα" : "Δες τα προϊόντα"} <span aria-hidden="true">→</span>
                </span>
              </span>

              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-accent sm:hidden" />
            </Link>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The card's image, or a typographic stand-in. No category in the shop has
 * an image yet (the field is admin-editable, see CategoryManager), so the
 * fallback is the case that actually renders today — it has to look
 * deliberate rather than broken.
 */
function CategoryThumb({ name, imagePath }: { name: string; imagePath?: string | null }) {
  // imagePath is a bucket-relative path, not a URL (see lib/storage/urls) —
  // rendering it straight into src 404s for every uploaded image and only
  // ever worked by accident for a pasted external http(s) URL.
  const imageUrl = publicImageUrl(imagePath);
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-entered path or remote URL, not a known-dimension local asset; same call as CategoryLandingView's hero.
      <img
        src={imageUrl}
        alt=""
        className="hidden aspect-[4/3] w-full bg-surface object-cover sm:block"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="hidden aspect-[4/3] w-full place-items-center bg-surface font-display text-4xl text-ink/15 sm:grid"
    >
      {name.trim().charAt(0)}
    </span>
  );
}
