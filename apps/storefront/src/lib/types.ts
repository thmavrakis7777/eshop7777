// Shaped to line up with Medusa's product/category response objects,
// so the Phase 2 swap to real data is an adapter change, not a UI rewrite.

export type Tone = "clay" | "sage" | "stone" | "linen";

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
  // No review system exists yet — real products carry no rating. Never
  // fabricate one; a fake trust signal is worse than showing none.
  rating?: number;
  reviewCount?: number;
  badges?: Array<"new" | "sale">;
  variants: ProductVariant[];
  placeholderTone: Tone;
};

export type NavCategory = Category & {
  children: Category[];
  featured?: { title: string; ctaLabel: string; href: string };
};
