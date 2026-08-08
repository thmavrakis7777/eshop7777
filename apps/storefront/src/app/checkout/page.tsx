import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart } from "@/lib/data/cart";
import { getPaymentProviders } from "@/lib/data/checkout";
import { getDefaultRegionId } from "@/lib/medusa";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Ολοκλήρωση παραγγελίας",
  robots: { index: false, follow: true },
  alternates: { canonical: "/checkout" },
};

export default async function CheckoutPage() {
  const cart = await getCart();
  // No cart, or an empty one — nothing to check out. Same redirect target
  // as any other "arrived here without the prerequisite" case on this site.
  if (!cart || cart.items.length === 0) {
    redirect("/kalathi");
  }

  const regionId = await getDefaultRegionId();
  const paymentProviders = await getPaymentProviders(regionId);

  return (
    <div className="container-shell py-8 md:py-12">
      <h1 className="mb-8 font-display text-2xl md:text-3xl">Ολοκλήρωση παραγγελίας</h1>
      <CheckoutForm initialCart={cart} paymentProviders={paymentProviders} />
    </div>
  );
}
