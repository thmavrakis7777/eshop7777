// Shaped to line up with Medusa's product/category response objects,
// so the Phase 2 swap to real data is an adapter change, not a UI rewrite.

export type Money = {
  amount: number; // in whole euros for the mock layer (Medusa uses minor units)
  currencyCode: "EUR";
};

export type Category = {
  id: string;
  name: string;
  handle: string;
  parentHandle?: string;
  description?: string;
};

export type ProductVariant = {
  id: string;
  title: string;
  price: Money;
  inventoryQuantity: number;
};

export type Product = {
  id: string;
  title: string;
  handle: string;
  categoryHandle: string;
  shortDescription: string;
  price: Money;
  compareAtPrice?: Money;
  rating: number;
  reviewCount: number;
  badges?: Array<"new" | "sale" | "bestseller">;
  variants: ProductVariant[];
  placeholderTone: "clay" | "sage" | "stone" | "linen";
};

export type NavCategory = Category & {
  children: Category[];
  featured?: { title: string; ctaLabel: string; href: string };
};
