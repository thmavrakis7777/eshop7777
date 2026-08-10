import type { Metadata } from "next";
import { CategoryPLPView, PAGE_SIZE } from "@/components/category/CategoryPLPView";
import { searchProducts } from "@/lib/data/products";
import { parsePage } from "@/lib/search-params";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

// noindex: an internal search-results page is near-infinite, thin, duplicate
// content — and without an explicit canonical it inherits the root layout's
// `canonical: "/"`, which would point every query's results at the homepage.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Αναζήτηση: ${q}` : "Αναζήτηση",
    robots: { index: false, follow: true },
    alternates: { canonical: "/anazitisi" },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q: rawQuery, page: pageParam } = await searchParams;
  const query = (rawQuery ?? "").trim();
  const page = parsePage(pageParam);

  const { products, count } = query
    ? await searchProducts(query, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    : { products: [], count: 0 };

  return (
    <CategoryPLPView
      title={query ? `Αποτελέσματα για «${query}»` : "Αναζήτηση"}
      description={
        query
          ? undefined
          : "Αναζήτησε προϊόντα με βάση το όνομα ή τον κωδικό προϊόντος."
      }
      breadcrumbs={[{ label: "Αναζήτηση", href: "/anazitisi" }]}
      products={products}
      count={count}
      sort="newest"
      page={page}
      basePath="/anazitisi"
      source={{ type: "search", query }}
      extraParams={{ q: query }}
      emptyMessage={
        query
          ? `Δεν βρέθηκαν προϊόντα για «${query}». Δοκίμασε διαφορετική λέξη ή τον κωδικό προϊόντος.`
          : "Πληκτρολόγησε κάτι για να ξεκινήσεις την αναζήτηση."
      }
    />
  );
}
