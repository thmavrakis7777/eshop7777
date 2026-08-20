import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart } from "@/lib/data/cart";
import { getPaymentProviders, getShippingOptionsForCart } from "@/lib/data/checkout";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { ShippingOption } from "@/lib/types";

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
  //
  // Every other data read on this route (getCart -> getCartById) already
  // swallows a database error and degrades rather than throwing — this repo
  // has no error.tsx anywhere, so an uncaught throw here would take down the
  // entire checkout page with Next's generic crash screen instead of the
  // customer just re-touching a field, exactly the kind of transient DB
  // hiccup this app sees in production. Falling back to [] here reproduces
  // the pre-existing "fill in your address" state, which is honest: it just
  // means this optimization didn't get to run, not that shipping is broken.
  let initialShippingOptions: ShippingOption[] = [];
  if (cart.shippingAddress) {
    try {
      initialShippingOptions = await getShippingOptionsForCart(cart.id);
    } catch (err) {
      // Diagnosable in server logs without exposing anything to the
      // customer — the UI degrades to the same "fill in your address"
      // state it already has for a customer who hasn't saved one yet.
      console.error("[checkout] SHIPPING_OPTIONS_PREFETCH_FAILED", { cartId: cart.id, error: String(err) });
      initialShippingOptions = [];
    }
  }

  return (
    <div className="container-shell py-8 md:py-12">
      <h1 className="mb-8 font-display text-2xl md:text-3xl">Ολοκλήρωση παραγγελίας</h1>
      <CheckoutForm initialCart={cart} paymentProviders={paymentProviders} initialShippingOptions={initialShippingOptions} />
    </div>
  );
}
