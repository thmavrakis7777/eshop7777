import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart } from "@/lib/data/cart";
import { getPaymentProviders, getShippingOptionsForCart } from "@/lib/data/checkout";
import { getCheckoutAccount } from "@/lib/data/customer";
import { getCartAddressFields } from "@/lib/db/cart";
import { buildCheckoutPrefill } from "@/lib/checkout-prefill";
import { googleSignInHref } from "@/lib/auth/google";
import { getSiteSettings } from "@/lib/data/site-settings";
import { resolveStockInquiryContact } from "@/lib/whatsapp";
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
  //
  // The form's starting values come from the cart's own saved address, else
  // the signed-in customer's address book (CHECKOUT_PREFILL_GOOGLE_SPEC.md
  // §2.1) — both reads never throw, and on failure the form just starts
  // empty, as it always did.
  const [paymentProviders, siteSettings, cartAddresses, account] = await Promise.all([
    getPaymentProviders(),
    getSiteSettings(),
    getCartAddressFields(cart.id),
    getCheckoutAccount(),
  ]);
  const stockInquiry = resolveStockInquiryContact(siteSettings);
  const prefill = buildCheckoutPrefill({
    cartEmail: cart.email,
    cartShipping: cartAddresses.shipping,
    cartBilling: cartAddresses.billing,
    customer: account?.customer ?? null,
    savedAddresses: account?.addresses ?? [],
  });

  // If the address (and possibly a shipping method) was already saved on an
  // earlier visit — a refresh, or navigating back into checkout — resolve
  // the options up front instead of always starting the shipping section at
  // "fill in your address" until the customer re-touches a field. Cheap:
  // Cheap either way: getShippingOptionsForCart reads this same cart's own
  // already-saved address (one extra indexed lookup) to decide whether the
  // Heraklion-only method belongs in the list, then one query over
  // shop.shipping_method — no external zone service involved.
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
      <CheckoutForm
        initialCart={cart}
        paymentProviders={paymentProviders}
        initialShippingOptions={initialShippingOptions}
        stockInquiry={stockInquiry}
        prefill={prefill}
        savedAddresses={account?.addresses ?? []}
        signedIn={account !== null}
        googleSignInHref={googleSignInHref("/checkout")}
      />
    </div>
  );
}
