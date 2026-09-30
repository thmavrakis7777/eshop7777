import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { SetPasswordByEmail } from "@/components/account/SetPasswordByEmail";
import { getCustomer } from "@/lib/data/customer";
import { customerHasPassword } from "@/lib/db/customer";

export const metadata: Metadata = {
  title: "Αλλαγή κωδικού",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/allagi-kodikou" },
};

// An account created by "Συνέχεια με Google" has no current password to
// type, so the change form could only ever fail for it. It gets a
// set-password link by email instead — the emailed link proves the address
// is theirs, which a signed-in session alone doesn't
// (CHECKOUT_PREFILL_GOOGLE_SPEC.md §3.3). The (dashboard) layout already
// guarantees a signed-in customer here.
export default async function ChangePasswordPage() {
  const customer = await getCustomer();
  const hasPassword = customer ? await customerHasPassword(customer.id) : true;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">{hasPassword ? "Αλλαγή κωδικού" : "Ορισμός κωδικού"}</h1>
      {hasPassword || !customer ? <ChangePasswordForm /> : <SetPasswordByEmail email={customer.email} />}
    </div>
  );
}
