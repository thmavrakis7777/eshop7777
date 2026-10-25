import { afterEach, describe, expect, it, vi } from "vitest";

// getProductSitemapImages with the database replaced by the rows it would
// return, so this checks what the function does with them. Which rows come
// back at all (active products, files really in Storage) is the query's job,
// checked against the live database when this was written.
const db = vi.hoisted(() => ({ rows: [] as { slug: string; storage_path: string }[], query: "" }));

vi.mock("@/lib/db/client", () => ({
  sql: async (strings: TemplateStringsArray) => {
    db.query = strings.join("?");
    return db.rows;
  },
}));

const { getProductSitemapImages } = await import("@/lib/db/catalog");

afterEach(() => {
  db.rows = [];
  vi.unstubAllEnvs();
});

describe("getProductSitemapImages", () => {
  it("groups photos by product in gallery order, each URL once", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co/");
    db.rows = [
      { slug: "kamineto-a", storage_path: "products/main.aaaaaaaaaa.webp" },
      { slug: "kamineto-a", storage_path: "/products/main.aaaaaaaaaa.webp" },
      { slug: "kamineto-a", storage_path: "products/side.bbbbbbbbbb.webp" },
      { slug: "petrogkaz-b", storage_path: "products/main.aaaaaaaaaa.webp" },
    ];
    const images = await getProductSitemapImages();
    const base = "https://x.supabase.co/storage/v1/object/public/product-images/products";
    expect(images.get("kamineto-a")).toEqual([`${base}/main.aaaaaaaaaa.webp`, `${base}/side.bbbbbbbbbb.webp`]);
    // The same photo on two products stays on both: it's a duplicate only
    // within one product's entry.
    expect(images.get("petrogkaz-b")).toEqual([`${base}/main.aaaaaaaaaa.webp`]);
  });

  it("only reads rows whose file exists in the product photo bucket", async () => {
    await getProductSitemapImages();
    expect(db.query).toContain("JOIN storage.objects");
    expect(db.query).toContain("WHERE p.is_active");
  });

  it("returns nothing when the public Storage URL isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    db.rows = [{ slug: "kamineto-a", storage_path: "products/main.aaaaaaaaaa.webp" }];
    expect((await getProductSitemapImages()).size).toBe(0);
  });
});
