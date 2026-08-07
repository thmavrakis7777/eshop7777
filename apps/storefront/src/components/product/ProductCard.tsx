"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { Stars } from "@/components/ui/Stars";

const BADGE_LABEL: Record<NonNullable<Product["badges"]>[number], string> = {
  new: "Νέο",
  sale: "Προσφορά",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-md">
        <Link href={`/proionta/${product.handle}`} className="block" tabIndex={-1} aria-hidden="true">
          {product.badges && product.badges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              {product.badges.map((b) => (
                <span
                  key={b}
                  className={`rounded-sm px-2 py-1 text-[11px] font-medium tracking-wide ${
                    b === "sale"
                      ? "bg-accent text-white"
                      : "bg-bg/90 text-ink backdrop-blur-sm"
                  }`}
                >
                  {BADGE_LABEL[b]}
                </span>
              ))}
            </div>
          )}
          <div className="transition-transform duration-200 ease-out group-hover:scale-[1.03]">
            <PlaceholderTile label={product.title} tone={product.placeholderTone} />
          </div>
        </Link>
        <button
          type="button"
          className="absolute bottom-2 right-2 hidden translate-y-1 items-center rounded-sm bg-ink px-3 py-2 text-xs font-medium text-white opacity-0 transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 md:flex"
          aria-label={`Γρήγορη προσθήκη ${product.title} στο καλάθι`}
          onClick={(e) => e.preventDefault()}
        >
          + Καλάθι
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <Link
          href={`/proionta/${product.handle}`}
          className="text-sm font-medium text-ink hover:underline underline-offset-2"
        >
          {product.title}
        </Link>
        {product.rating !== undefined && (
          <Stars rating={product.rating} count={product.reviewCount} />
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-ink-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
