import type { CartLineItem } from "@/lib/types";

/**
 * A cart line's colour (COLOR_VARIANTS_SPEC.md): a small dot and the colour's
 * name, under the title in the mini-cart, the cart page and the checkout
 * summary. Renders nothing for a product without colours.
 */
export function LineColour({ colour, className = "" }: { colour: CartLineItem["colour"]; className?: string }) {
  if (!colour) return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs text-ink-muted ${className}`}>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
        style={{ backgroundColor: colour.hex }}
      />
      Χρώμα: {colour.name}
    </span>
  );
}
