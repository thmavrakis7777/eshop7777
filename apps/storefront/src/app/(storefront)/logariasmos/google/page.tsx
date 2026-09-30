import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerId } from "@/lib/data/customer";
import { isSafeRedirectPath } from "@/lib/checkout-validation";
import { GoogleSignInFinish } from "@/components/account/GoogleSignInFinish";

export const metadata: Metadata = {
  title: "Σύνδεση",
  robots: { index: false, follow: false },
};

// The last stop of "Συνέχεια με Google" (app/api/auth/google/callback): the
// session already exists; this page only merges the guest wishlist, which
// lives in localStorage and so needs the browser, then continues to `to`.
// Deliberately outside the (auth) group, whose layout would bounce a
// signed-in customer to /logariasmos before the merge could run.
export default async function GoogleSignInFinishPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  if (!(await getCustomerId())) redirect("/logariasmos/eisodos");
  const { to } = await searchParams;

  return (
    <div className="container-shell flex justify-center py-12 md:py-20">
      <GoogleSignInFinish to={isSafeRedirectPath(to) ? to : "/logariasmos"} />
    </div>
  );
}
