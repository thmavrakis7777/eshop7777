import type { ProductVariant } from "@/lib/types";

/**
 * Colour variants (COLOR_VARIANTS_SPEC.md) — the one place that decides
 * whether a product is chosen by colour, shared by the product card and the
 * product page so the two can't disagree.
 *
 * A product is a colour product only when it has more than one variant and
 * every one of them has a colour dot. A product with some other kind of
 * variant (a size, say) — or a half-converted one, mid-edit in the dashboard
 * — keeps the old behaviour: the card links to the product page and the page
 * shows plain text buttons.
 */
export function colourVariantsOf(variants: ProductVariant[]): ProductVariant[] | null {
  if (variants.length < 2) return null;
  return variants.every((v) => v.swatchHex) ? variants : null;
}

/**
 * The colour shown as selected before the shopper picks one: the first in
 * stock (owner's choice, 2026-10-16), so «Προσθήκη στο καλάθι» works in one
 * tap and the dot shows exactly which colour it adds. Every colour sold
 * out: the first, and the button reads «Εξαντλήθηκε» as on any card.
 */
export function defaultColourVariant(colours: ProductVariant[]): ProductVariant {
  return colours.find((v) => v.isAvailable) ?? colours[0];
}

/**
 * The colour last picked on a product's card, so opening that product shows
 * the same colour rather than jumping back to the default. Browser memory
 * only, keyed by product handle: it lasts for this visit and survives the
 * app's own page changes (a full reload starts fresh, as does a new tab).
 * Not in the URL on purpose — the product page stays one cached page for
 * everyone, and the shopper's links stay clean.
 *
 * Only ever written from a click handler in the browser, so the server's
 * copy of this module stays empty.
 */
const colourChoices = new Map<string, string>();

export function rememberColourChoice(handle: string, variantId: string): void {
  colourChoices.set(handle, variantId);
}

export function recallColourChoice(handle: string): string | null {
  return colourChoices.get(handle) ?? null;
}
