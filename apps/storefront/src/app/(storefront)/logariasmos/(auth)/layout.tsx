import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCustomer } from "@/lib/data/customer";
import { isSafeRedirectPath } from "@/lib/checkout-validation";

// Login/register/forgot-password/reset-password share this simple centered
// card shell. If a visitor is already logged in and lands here (e.g. a
// bookmarked /logariasmos/eisodos), there's nothing for them to do here —
// send them straight on, same "arrived here without the prerequisite"
// redirect pattern as /checkout redirecting to /kalathi. Honors redirectTo
// when present (e.g. an already-open tab hits a stale
// /logariasmos/eisodos?redirectTo=/logariasmos/parangelies link) instead of
// always landing on the generic overview — same deep-link case QA-013 fixed
// for the logged-out path, just on the already-authenticated one. A layout
// has no searchParams prop, so this reads proxy.ts's x-pathname header
// (which already carries the query string) instead.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (customer) {
    const currentUrl = (await headers()).get("x-pathname") ?? "";
    const redirectTo = new URLSearchParams(currentUrl.split("?")[1] ?? "").get("redirectTo");
    redirect(isSafeRedirectPath(redirectTo) ? redirectTo : "/logariasmos");
  }

  return (
    <div className="container-shell flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
