import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart } from "@/lib/data/cart";
import { getPaymentProviders, getShippingOptionsForCart } from "@/lib/data/checkout";
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

  // The cart already carries its own region — no need to resolve "the"
  // default region separately, which was both an extra request and wrong
  // the moment a second region exists.
  const paymentProviders = await getPaymentProviders();

  // If the address (and possibly a shipping method) was already saved on an
  // earlier visit — a refresh, or navigating back into checkout — resolve
  // the options up front instead of always starting the shipping section at
  // "fill in your address" until the customer re-touches a field. Cheap:
  // getShippingOptionsForCart doesn't do per-cart zone lookups, it's one
  // query for every active shop.shipping_method row.
  const initialShippingOptions = cart.shippingAddress ? await getShippingOptionsForCart(cart.id) : [];

  return (
    <div className="container-shell py-8 md:py-12">
      <h1 className="mb-8 font-display text-2xl md:text-3xl">Ολοκλήρωση παραγγελίας</h1>
      <CheckoutForm initialCart={cart} paymentProviders={paymentProviders} initialShippingOptions={initialShippingOptions} />
    </div>
  );
}
