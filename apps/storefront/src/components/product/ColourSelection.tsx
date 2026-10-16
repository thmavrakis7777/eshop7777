"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ProductVariant } from "@/lib/types";
import type { StockState } from "@/lib/stock";
import { stockStateOf } from "@/lib/stock";
import { colourVariantsOf, defaultColourVariant, recallColourChoice } from "@/lib/colour-variants";
import { StockStatus } from "@/components/product/StockStatus";

/**
 * The product page's chosen colour (COLOR_VARIANTS_SPEC.md), shared by the
 * pieces of the page that follow it: the gallery (shows the colour's photo),
 * AddToCartButton (the dots, quantity limit and what gets added), and the
 * stock line and product code. They sit in different parts of a Server
 * Component page, hence a context rather than props.
 *
 * Which colour, in order: the one picked on this page; else the one picked
 * on a product card earlier in this visit (rememberColourChoice); else the
 * first in stock.
 *
 * For a product without colours the context is null and every consumer
 * renders exactly what it did before.
 */
type ColourSelection = { colours: ProductVariant[]; selected: ProductVariant; pick: (id: string) => void } | null;

const Ctx = createContext<ColourSelection>(null);

export function ColourSelectionProvider({
  handle,
  variants,
  children,
}: {
  handle: string;
  variants: ProductVariant[];
  children: ReactNode;
}) {
  const colours = colourVariantsOf(variants);
  // Read once, when the page mounts. On a full page load nothing is
  // remembered yet (on the server or in the browser), so the server HTML
  // and hydration agree; a card's choice only exists after an in-app
  // navigation, which renders in the browser alone.
  const [picked, setPicked] = useState<string | null>(() => recallColourChoice(handle));

  let value: ColourSelection = null;
  if (colours) {
    const selected = colours.find((v) => v.id === picked) ?? defaultColourVariant(colours);
    value = { colours, selected, pick: setPicked };
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useColourSelection(): ColourSelection {
  return useContext(Ctx);
}

/** The page's stock line: the chosen colour's, or the product's as before. */
export function SelectedStockStatus({ fallback, className }: { fallback: StockState; className?: string }) {
  const selection = useColourSelection();
  return <StockStatus state={selection ? stockStateOf([selection.selected]) : fallback} className={className} />;
}

/** The page's «Κωδικός προϊόντος»: the chosen colour's own code. */
export function SelectedVariantCode({ fallback }: { fallback: string }) {
  const selection = useColourSelection();
  return <>{selection?.selected.code ?? fallback}</>;
}
