import { medusaFetch, type MedusaCategory } from "@/lib/medusa";
import type { Category, NavCategory } from "@/lib/types";

// Curated marketing copy for the mega menu's featured tile. This is
// presentation content, not catalog data — it has no Medusa equivalent
// and belongs here rather than in the product/category API.
const FEATURED_COPY: Record<string, NavCategory["featured"]> = {
  kouzina: { title: "Το σετ μαγειρικής της σεζόν", ctaLabel: "Δες τη συλλογή", href: "/kouzina" },
  "apothikefsi-organosi": { title: "Οργανώστε κάθε γωνιά του σπιτιού", ctaLabel: "Ανακάλυψε", href: "/apothikefsi-organosi" },
  banio: { title: "Ένα μπάνιο σαν spa", ctaLabel: "Δες τη συλλογή", href: "/banio" },
  katharismos: { title: "Καθαριότητα χωρίς κόπο", ctaLabel: "Δες τα προϊόντα", href: "/katharismos" },
  kipos: { title: "Ο κήπος σου, αναζωογονημένος", ctaLabel: "Δες τη συλλογή", href: "/kipos" },
  "eidi-spitiou": { title: "Διακόσμηση με χαρακτήρα", ctaLabel: "Ανακάλυψε", href: "/eidi-spitiou" },
};

function toCategory(c: MedusaCategory, parentHandle?: string): Category {
  return {
    id: c.id,
    name: c.name,
    handle: c.handle,
    parentHandle,
    description: c.description ?? undefined,
  };
}

// Revalidated frequently rather than cached indefinitely: category edits made
// in the admin should show up on the storefront within a minute, not require
// a redeploy.
async function fetchAllCategories(): Promise<MedusaCategory[]> {
  const { product_categories } = await medusaFetch<{ product_categories: MedusaCategory[] }>(
    "/store/product-categories?limit=200&fields=id,name,handle,description,parent_category_id",
    { next: { revalidate: 60 } }
  );
  return product_categories;
}

export async function getNavCategories(): Promise<NavCategory[]> {
  const all = await fetchAllCategories();
  const topLevel = all.filter((c) => !c.parent_category_id);

  return topLevel.map((top) => ({
    ...toCategory(top),
    children: all
      .filter((c) => c.parent_category_id === top.id)
      .map((c) => toCategory(c, top.handle)),
    featured: FEATURED_COPY[top.handle],
  }));
}

export async function getCategoryByHandle(handle: string): Promise<Category | undefined> {
  const all = await fetchAllCategories();
  const found = all.find((c) => c.handle === handle);
  if (!found) return undefined;
  const parent = found.parent_category_id
    ? all.find((c) => c.id === found.parent_category_id)
    : undefined;
  return toCategory(found, parent?.handle);
}

export async function getCategoryIdByHandle(handle: string): Promise<string | undefined> {
  const all = await fetchAllCategories();
  return all.find((c) => c.handle === handle)?.id;
}

// Products are tagged with one specific (usually leaf) category, not every
// ancestor — Medusa does not implicitly include descendants when filtering
// `/store/products?category_id[]=`. Browsing a top-level category (e.g.
// "Κουζίνα") must show every product from its subcategories too, so this
// resolves the full set of relevant category IDs to filter by: the category
// itself, plus its direct children when it has none (i.e. it's top-level).
export async function getCategoryIdsForHandle(handle: string): Promise<string[]> {
  const all = await fetchAllCategories();
  const found = all.find((c) => c.handle === handle);
  if (!found) return [];
  const children = all.filter((c) => c.parent_category_id === found.id);
  return [found.id, ...children.map((c) => c.id)];
}
