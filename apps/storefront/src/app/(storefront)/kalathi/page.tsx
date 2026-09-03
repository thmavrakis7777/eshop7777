import type { Metadata } from "next";
import { getCart } from "@/lib/data/cart";
import { getCartCrossSell } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getNationwideFreeShippingThresholdCents } from "@/lib/data/checkout";
import { resolveStockInquiryContact } from "@/lib/whatsapp";
import { CartPageView } from "@/components/cart/CartPageView";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { ProductRail } from "@/components/home/ProductRail";

export const metadata: Metadata = {
  title: "Καλάθι",
  robots: { index: false, follow: true },
  alternates: { canonical: "/kalathi" },
};

export default async function CartPage() {
  const cart = await getCart();

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-shell py-8 md:py-12">
        <h1 className="mb-6 font-display text-2xl md:text-3xl">Το καλάθι σου</h1>
        <EmptyCartState />
      </div>
    );
  }

  const [crossSell, settings, freeShippingThresholdCents] = await Promise.all([
    getCartCrossSell(cart.items.map((item) => item.productHandle)),
    getSiteSettings(),
    getNationwideFreeShippingThresholdCents(),
  ]);

  return (
    <div className="container-shell py-8 md:py-12">
      <h1 className="mb-6 font-display text-2xl md:text-3xl">Το καλάθι σου</h1>
      <CartPageView
        initialCart={cart}
        cartMessage={settings?.cartMessage ?? null}
        freeShippingThresholdCents={freeShippingThresholdCents}
        stockInquiry={resolveStockInquiryContact(settings)}
      />
      <ProductRail title="Ταιριάζει καλά με ό,τι έχεις στο καλάθι" products={crossSell} />
    </div>
  );
}
