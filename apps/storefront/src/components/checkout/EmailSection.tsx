"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";

// Email requested first, with a stated reason — CHECKOUT_UX_SPEC.md §4/§17:
// an unexplained field reads as data-harvesting, an explained one reads as
// "I understand why you're asking."
//
// `signInHref` is set for signed-out visitors only: one line offering to
// sign in, which fills the rest of the form from the account
// (CHECKOUT_PREFILL_GOOGLE_SPEC.md §2.5). Just a line, not a gate — guest
// checkout stays the default path.
export function EmailSection({
  value,
  onChange,
  onBlur,
  error,
  saving,
  signInHref,
}: {
  value: string;
  onChange: (value: string, autofilled: boolean) => void;
  onBlur: () => void;
  error?: string;
  saving?: boolean;
  signInHref?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={1} title="Email" saving={saving} />
      {signInHref && (
        <p className="text-sm text-ink-muted">
          Έχεις λογαριασμό;{" "}
          <Link href={signInHref} className="font-medium text-accent hover:underline">
            Σύνδεση
          </Link>
        </p>
      )}
      <FormField
        id="checkout-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
      />
      <p className="text-xs text-ink-muted">
        Θα σου στείλουμε την επιβεβαίωση της παραγγελίας σε αυτό το email.
      </p>
    </section>
  );
}
