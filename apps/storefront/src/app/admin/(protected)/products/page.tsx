import Link from "next/link";
import { listCategoryOptions, listCollectionOptions, listProducts } from "@/lib/admin/products";
import { ProductListTable } from "@/components/admin/ProductListTable";
import { ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Προϊόντα" };

/**
 * Filters live in the URL, not in component state: every view is linkable,
 * the back button works, and an operator can bookmark "out of stock, sorted
 * by name" without the app needing a concept of saved views.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const status = (one(sp.status) ?? "all") as "all" | "active" | "inactive";
  const stock = (one(sp.stock) ?? "all") as "all" | "low" | "out";
  const sort = (one(sp.sort) ?? "newest") as "newest" | "title" | "price-asc" | "price-desc" | "stock-asc";
  const categoryId = one(sp.category) || undefined;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);

  const [{ products, total, perPage }, categories, collections] = await Promise.all([
    listProducts({ q, status, stock, categoryId, sort, page }),
    listCategoryOptions(),
    listCollectionOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasFilters = Boolean(q || status !== "all" || stock !== "all" || categoryId);

  // Preserves every other filter when one changes — otherwise switching sort
  // would silently drop the search the operator just typed.
  const withParam = (key: string, value: string) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (stock !== "all") next.set("stock", stock);
    if (categoryId) next.set("category", categoryId);
    if (sort !== "newest") next.set("sort", sort);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    return `/admin/products?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Προϊόντα"
        description={`${total} ${total === 1 ? "προϊόν" : "προϊόντα"}${hasFilters ? " με τα τρέχοντα φίλτρα" : ""}`}
        action={
          <ButtonLink href="/admin/products/new" variant="primary">
            Νέο προϊόν
          </ButtonLink>
        }
      />

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Αναζήτηση τίτλου, slug ή SKU…"
          aria-label="Αναζήτηση προϊόντων"
          className="min-w-[16rem] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <Select name="status" value={status} label="Κατάσταση">
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργά</option>
          <option value="inactive">Ανενεργά</option>
        </Select>
        <Select name="stock" value={stock} label="Απόθεμα">
          <option value="all">Κάθε απόθεμα</option>
          <option value="low">Χαμηλό (≤5)</option>
          <option value="out">Εξαντλημένα</option>
        </Select>
        <Select name="category" value={categoryId ?? ""} label="Κατηγορία">
          <option value="">Όλες οι κατηγορίες</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </Select>
        <Select name="sort" value={sort} label="Ταξινόμηση">
          <option value="newest">Νεότερα πρώτα</option>
          <option value="title">Αλφαβητικά</option>
          <option value="price-asc">Τιμή ↑</option>
          <option value="price-desc">Τιμή ↓</option>
          <option value="stock-asc">Απόθεμα ↑</option>
        </Select>
        <button
          type="submit"
          className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface"
        >
          Εφαρμογή
        </button>
        {hasFilters && (
          <Link href="/admin/products" className="px-2 text-sm text-ink-muted hover:text-ink">
            Καθαρισμός
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Κανένα προϊόν δεν ταιριάζει" : "Δεν υπάρχουν προϊόντα ακόμα"}
          description={
            hasFilters
              ? "Δοκίμασε διαφορετικά φίλτρα ή καθάρισε την αναζήτηση."
              : "Πρόσθεσε το πρώτο σου προϊόν για να ξεκινήσεις."
          }
          action={
            hasFilters ? (
              <ButtonLink href="/admin/products">Καθαρισμός φίλτρων</ButtonLink>
            ) : (
              <ButtonLink href="/admin/products/new" variant="primary">
                Νέο προϊόν
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <ProductListTable products={products} categories={categories} collections={collections} />
          {totalPages > 1 && (
            <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Σελιδοποίηση">
              <span className="text-ink-muted">
                Σελίδα {page} από {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`${withParam("page", String(page - 1))}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Προηγούμενη
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`${withParam("page", String(page + 1))}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Επόμενη
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function Select({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="rounded-md border border-border bg-bg px-2.5 py-2 text-sm outline-none focus:border-ink"
    >
      {children}
    </select>
  );
}
